import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Firebase OAuth2 ──
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)).buffer as ArrayBuffer);
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)).buffer as ArrayBuffer);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const pemContent = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = base64url(signature as ArrayBuffer);
  const jwt = `${unsignedToken}.${encodedSignature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`OAuth error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

async function sendPush(
  fcmUrl: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    const res = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: data || {},
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Find training events happening tomorrow (runs once daily at 20h) ──
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Fetch training events for tomorrow that have NOT been reminded yet
    const { data: targetEvents, error: evError } = await supabase
      .from('events')
      .select('*')
      .eq('date', tomorrowStr)
      .eq('type', 'training')
      .is('reminded_at', null)
      .neq('reason', '__ghost__');

    if (evError) throw evError;
    if (!targetEvents || targetEvents.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No unreminded training events tomorrow', reminded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Profiles & player mapping ──
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, player_id, name');

    const playerToUserId: Record<string, string> = {};
    for (const p of (profiles || [])) {
      if (p.player_id) playerToUserId[p.player_id] = p.id;
    }

    const notifications: { userIds: string[]; title: string; body: string; eventId: string }[] = [];

    for (const ev of targetEvents) {
      const dateLabel = new Date(ev.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeLabel = ev.time ? ` à ${ev.time}` : '';

      const targetUserIds = Object.values(playerToUserId);

      if (targetUserIds.length > 0) {
        notifications.push({
          userIds: targetUserIds,
          title: '🏋️ Entraînement demain',
          body: `${ev.title} — ${dateLabel}${timeLabel}${ev.location ? ` 📍 ${ev.location}` : ''}`,
          eventId: ev.id,
        });
      }
    }

    if (notifications.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No notifications to send', reminded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Get FCM tokens ──
    const allTargetUserIds = [...new Set(notifications.flatMap(n => n.userIds))];
    const { data: tokenRows } = await supabase
      .from('fcm_tokens')
      .select('user_id, token')
      .in('user_id', allTargetUserIds);

    const userTokens: Record<string, string[]> = {};
    for (const row of (tokenRows || [])) {
      if (!userTokens[row.user_id]) userTokens[row.user_id] = [];
      userTokens[row.user_id].push(row.token);
    }

    // ── Send push notifications ──
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      return new Response(JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let totalSent = 0;
    let totalFailed = 0;

    for (const notif of notifications) {
      for (const userId of notif.userIds) {
        const tokens = userTokens[userId] || [];
        for (const fcmToken of tokens) {
          const ok = await sendPush(fcmUrl, accessToken, fcmToken, notif.title, notif.body, { eventId: notif.eventId, type: 'auto_reminder' });
          if (ok) totalSent++;
          else totalFailed++;
        }
      }

      // ── Mark event as reminded to prevent duplicates ──
      await supabase
        .from('events')
        .update({ reminded_at: new Date().toISOString() })
        .eq('id', notif.eventId);
    }

    console.log(`Auto-remind: ${totalSent} sent, ${totalFailed} failed, ${notifications.length} events`);

    return new Response(JSON.stringify({
      success: true,
      events: notifications.length,
      sent: totalSent,
      failed: totalFailed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Auto-remind error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
