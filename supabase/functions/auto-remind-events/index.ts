import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Firebase OAuth2 (reused from send-push-notification) ──
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

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)));
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

  const encodedSignature = base64url(new Uint8Array(signature));
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

    // ── Find events happening in 23-25h window ──
    const now = new Date();
    const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const todayStr = in23h.toISOString().split('T')[0];
    const tomorrowStr = in25h.toISOString().split('T')[0];

    // Fetch events on these dates
    const { data: events, error: evError } = await supabase
      .from('events')
      .select('*')
      .in('date', [todayStr, tomorrowStr])
      .in('type', ['match', 'training']);

    if (evError) throw evError;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No events in 24h window', reminded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter events whose date+time falls in the 23-25h window
    const targetEvents = events.filter(ev => {
      const eventDate = new Date(ev.date);
      if (ev.time) {
        const [h, m] = ev.time.replace('H', ':').replace('h', ':').split(':').map(Number);
        eventDate.setHours(h || 0, m || 0, 0, 0);
      } else {
        // No time specified — assume midday
        eventDate.setHours(12, 0, 0, 0);
      }
      return eventDate >= in23h && eventDate <= in25h;
    });

    if (targetEvents.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No events in precise 24h window', reminded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Determine target user IDs for each event ──
    // For matches with published convocations → only convoked players
    // For training/matches without convocations → all players
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, player_id, name');

    const playerToUserId: Record<string, string> = {};
    const allUserIds: string[] = [];
    for (const p of (profiles || [])) {
      if (p.player_id) playerToUserId[p.player_id] = p.id;
      allUserIds.push(p.id);
    }

    // Collect { userId[], title, body } per event
    const notifications: { userIds: string[]; title: string; body: string; eventId: string }[] = [];

    for (const ev of targetEvents) {
      const dateLabel = new Date(ev.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeLabel = ev.time ? ` à ${ev.time}` : '';
      const typeLabel = ev.type === 'match' ? '⚽ Match' : '🏋️ Entraînement';

      let targetUserIds: string[] = [];

      if (ev.type === 'match' && ev.convocations_published && ev.convocations) {
        // Only convoked players
        const convocations = typeof ev.convocations === 'string' ? JSON.parse(ev.convocations) : ev.convocations;
        for (const [playerId, conv] of Object.entries(convocations)) {
          if ((conv as any)?.status === 'convoque' && playerToUserId[playerId]) {
            targetUserIds.push(playerToUserId[playerId]);
          }
        }
      } else {
        // All members with a player_id (i.e. all active players)
        targetUserIds = Object.values(playerToUserId);
      }

      if (targetUserIds.length > 0) {
        notifications.push({
          userIds: targetUserIds,
          title: `${typeLabel} demain`,
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
