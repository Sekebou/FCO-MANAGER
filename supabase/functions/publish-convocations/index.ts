import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claimsData.claims.sub as string;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 2. Role check
    const { data: canManage } = await admin.rpc('can_manage', { _user_id: userId });
    if (!canManage) return json({ error: 'Forbidden: insufficient role' }, 403);

    // 3. Parse & validate body
    const body = await req.json();
    const { eventId, convocations, customNotif } = body;
    console.log('[publish-convocations] customNotif received:', JSON.stringify(customNotif));
    if (!eventId || typeof eventId !== 'string') return json({ error: 'eventId required' }, 400);
    if (!convocations || typeof convocations !== 'object') return json({ error: 'convocations required' }, 400);
    if (!customNotif || !customNotif.title || !customNotif.body) return json({ error: 'customNotif (title + body) required' }, 400);

    // 4. Fetch event
    const { data: event, error: fetchErr } = await admin
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();
    if (fetchErr || !event) return json({ error: 'Event not found' }, 404);

    // 5. Parse home/away from title
    const vsParts = (event.title as string).split(/\s+vs\s+/i);
    const homeTeam = (vsParts[0] || event.title).trim();
    const awayTeam = vsParts.length > 1 ? vsParts[1].trim() : null;

    // 6. Resolve publisher name
    const { data: publisherProfile } = await admin
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();
    const publisherName = publisherProfile?.name || 'Inconnu';

    // 6b. Update event: save convocations + mark published + publisher info
    const { error: updateErr } = await admin
      .from('events')
      .update({
        convocations,
        convocations_published: true,
        convocations_published_by: userId,
        convocations_published_by_name: publisherName,
        convocations_published_at: new Date().toISOString(),
      })
      .eq('id', eventId);
    if (updateErr) {
      console.error('Event update error:', updateErr);
      return json({ error: `Event update failed: ${updateErr.message}` }, 500);
    }

    // 7. Upsert match sheet (only for matches)
    let matchSheetCreated = false;
    if (event.type === 'match') {
      // Check if match sheet already exists for this event
      const { data: existingSheet } = await admin
        .from('match_sheets')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existingSheet) {
        // Update existing
        const { error: msErr } = await admin
          .from('match_sheets')
          .update({ convocations, home_team: homeTeam, away_team: awayTeam, team: event.team || 'A' })
          .eq('id', existingSheet.id);
        if (msErr) console.error('Match sheet update error:', msErr);
        matchSheetCreated = true;
      } else {
        // Insert new
        const { error: msErr } = await admin
          .from('match_sheets')
          .insert({
            event_id: eventId,
            title: event.title,
            date: event.date,
            time: event.time || null,
            location: event.location || null,
            team: event.team || 'A',
            home_team: homeTeam,
            away_team: awayTeam,
            home_logo: event.home_logo || null,
            away_logo: event.away_logo || null,
            convocations,
            created_by: userId,
          });
        if (msErr) {
          console.error('Match sheet insert error:', JSON.stringify(msErr));
        } else {
          matchSheetCreated = true;
        }
      }
    }

    // 8. Send push notifications to convoked players
    // Ghost events: only notify the creator (for testing), not all players
    const isGhostEvent = event.reason === '__ghost__';
    const convokedPlayerIds = Object.entries(convocations)
      .filter(([, c]: [string, any]) => c.status === 'convoque')
      .map(([playerId]) => playerId);

    let notifiedCount = 0;

    if (convokedPlayerIds.length > 0) {
      let targetUserIds: string[] = [];

      if (isGhostEvent) {
        // Ghost event: only notify the creator
        targetUserIds = [userId];
      } else {
        // Normal event: notify all convoked players
        const { data: profiles } = await admin
          .from('profiles')
          .select('id, player_id')
          .in('player_id', convokedPlayerIds);
        targetUserIds = profiles?.map((p: any) => p.id) || [];
      }

      if (targetUserIds.length > 0) {
        // Get FCM tokens
        const { data: tokenRows } = await admin
          .from('fcm_tokens')
          .select('token')
          .in('user_id', targetUserIds);

        const tokens = tokenRows?.map((r: any) => r.token).filter(Boolean) || [];

        if (tokens.length > 0) {
          // Send push via existing send-push-notification function internals
          // We'll call FCM directly here to avoid circular function calls
          const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
          if (serviceAccountJson) {
            try {
              const serviceAccount = JSON.parse(serviceAccountJson);
              const accessToken = await getFirebaseAccessToken(serviceAccount);
              const projectId = serviceAccount.project_id;
              const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

              const notifTitle = customNotif.title;
              const notifBody = customNotif.body;

              for (const fcmToken of tokens) {
                try {
                  const res = await fetch(fcmUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                      message: {
                        token: fcmToken,
                        notification: { title: notifTitle, body: notifBody },
                        data: { type: 'convocation', eventId },
                        apns: {
                          payload: {
                            aps: {
                              alert: { title: notifTitle, body: notifBody },
                              sound: 'default',
                              'mutable-content': 1,
                            },
                          },
                        },
                        android: {
                          notification: {
                            sound: 'default',
                            channel_id: 'convocations',
                          },
                        },
                      },
                    }),
                  });
                  if (res.ok) {
                    notifiedCount++;
                  } else {
                    const errData = await res.json();
                    console.error(`FCM error for token ${fcmToken.substring(0, 10)}...:`, JSON.stringify(errData));
                  }
                } catch (e) {
                  console.error('FCM send error:', e);
                }
              }
            } catch (e) {
              console.error('Firebase auth error:', e);
            }
          } else {
            console.error('FIREBASE_SERVICE_ACCOUNT not configured');
          }
        }
      }
    }

    console.log(`[publish-convocations] user=${userId} event=${eventId} convoked=${convokedPlayerIds.length} notified=${notifiedCount} matchSheet=${matchSheetCreated}`);

    // 8b. Send "Paris buteur ouverts" push to ALL users (only for real matches with a team category)
    let bettingNotifiedCount = 0;
    const isRealMatch = event.type === 'match' && !isGhostEvent && event.team && awayTeam;

    if (isRealMatch) {
      try {
        // Get all FCM tokens (everyone)
        const { data: allTokens } = await admin
          .from('fcm_tokens')
          .select('token');
        const bettingTokens = allTokens?.map((r: any) => r.token).filter(Boolean) || [];

        if (bettingTokens.length > 0) {
          const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
          if (serviceAccountJson) {
            const serviceAccount = JSON.parse(serviceAccountJson);
            const accessToken = await getFirebaseAccessToken(serviceAccount);
            const projectId = serviceAccount.project_id;
            const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

            const bettingTitle = '⚽ Paris buteur ouverts !';
            const bettingBody = `Équipe ${event.team} — ${homeTeam} vs ${awayTeam} : pariez sur le buteur du match !`;

            for (const fcmToken of bettingTokens) {
              try {
                const res = await fetch(fcmUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({
                    message: {
                      token: fcmToken,
                      notification: { title: bettingTitle, body: bettingBody },
                      data: { type: 'betting_open', eventId, team: event.team },
                      apns: {
                        payload: {
                          aps: {
                            alert: { title: bettingTitle, body: bettingBody },
                            sound: 'default',
                            'mutable-content': 1,
                          },
                        },
                      },
                      android: {
                        notification: {
                          sound: 'default',
                          channel_id: 'paris',
                        },
                      },
                    },
                  }),
                });
                if (res.ok) bettingNotifiedCount++;
              } catch (e) {
                console.error('FCM betting send error:', e);
              }
            }
          }
        }
      } catch (e) {
        console.error('Betting notification error:', e);
      }
    }

    console.log(`[publish-convocations] betting notif sent to ${bettingNotifiedCount} devices (isRealMatch=${isRealMatch})`);

    // 9. Log notification in audit_logs
    await admin.from('audit_logs').insert({
      action: 'publish_convocation',
      target_name: event.title,
      performed_by: userId,
      performed_by_name: publisherName,
      details: {
        event_id: eventId,
        event_date: event.date,
        notif_title: customNotif.title,
        notif_body: customNotif.body,
        convoked_count: convokedPlayerIds.length,
        notified_count: notifiedCount,
        match_sheet_created: matchSheetCreated,
        betting_notified_count: bettingNotifiedCount,
      },
    });

    return json({
      published: true,
      matchSheetCreated,
      convokedCount: convokedPlayerIds.length,
      notifiedCount,
    });

  } catch (err) {
    console.error('publish-convocations error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

// --- Firebase OAuth2 helper (copied from send-push-notification) ---
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

async function getFirebaseAccessToken(serviceAccount: any): Promise<string> {
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
  if (!tokenRes.ok) throw new Error(`OAuth token error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}
