import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_URL = "https://api.resend.com/emails";

// ─── Modern Dark Email Layout ───

const baseLayout = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:12px 24px;border-radius:14px;">
                    <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:1.5px;">⚽ FCO MANAGER</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#1e293b;border-radius:20px;overflow:hidden;border:1px solid #334155;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 16px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#475569;">Football Club Organisation · FCO Manager</p>
              <p style="margin:6px 0 0;font-size:10px;color:#334155;">Email automatique · Ne pas répondre</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const buttonStyle = `display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:14px;letter-spacing:0.5px;`;

// ─── Template: Invitation ───
function invitationEmail(params: {
  invite_link: string;
  role_label: string;
  inviter_name: string;
}) {
  return baseLayout(`
    <div style="padding:36px 32px 28px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="display:inline-block;font-size:44px;margin-bottom:8px;">🎉</span>
        <h2 style="margin:0;font-size:22px;font-weight:800;color:#f1f5f9;">Vous êtes invité !</h2>
      </div>
      <div style="background:#0f172a;border-radius:14px;padding:20px 24px;border:1px solid #334155;margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
              <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Invité par</span><br/>
              <span style="font-size:15px;font-weight:700;color:#e2e8f0;">${params.inviter_name}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;">
              <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Rôle</span><br/>
              <span style="display:inline-block;margin-top:4px;padding:4px 14px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border-radius:8px;font-size:13px;font-weight:700;">${params.role_label}</span>
            </td>
          </tr>
        </table>
      </div>
      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;text-align:center;">
        Créez votre compte pour rejoindre l'équipe et accéder à toutes les fonctionnalités.
      </p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="center">
            <a href="${params.invite_link}" target="_blank" style="${buttonStyle}">
              Créer mon compte →
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-size:11px;color:#475569;text-align:center;line-height:1.6;">
        Ou copiez ce lien :<br/>
        <a href="${params.invite_link}" style="color:#60a5fa;word-break:break-all;font-size:11px;">${params.invite_link}</a>
      </p>
    </div>
    <div style="padding:14px 32px;background:#0f172a;border-top:1px solid #334155;text-align:center;">
      <span style="font-size:12px;color:#f59e0b;font-weight:600;">⏳ Ce lien expire dans 48 heures</span>
    </div>
  `);
}

// ─── Template: Event Notification ───
function eventNotificationEmail(params: {
  event_title: string;
  event_type: string;
  event_date: string;
}) {
  const isMatch = params.event_type === 'match';
  const isTraining = params.event_type === 'training';
  const typeIcon = isMatch ? '🏟️' : isTraining ? '🏋️' : '📅';
  const typeLabel = isMatch ? 'Match' : isTraining ? 'Entraînement' : 'Événement';
  const accentColor = isMatch ? '#ef4444' : '#10b981';
  const accentBg = isMatch ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)';

  return baseLayout(`
    <div style="padding:36px 32px 28px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="display:inline-block;font-size:44px;margin-bottom:8px;">${typeIcon}</span>
        <h2 style="margin:0;font-size:22px;font-weight:800;color:#f1f5f9;">Nouvel événement</h2>
        <p style="margin:8px 0 0;font-size:14px;color:#64748b;">Un événement a été ajouté au calendrier</p>
      </div>
      <div style="background:#0f172a;border-radius:14px;padding:20px 24px;border:1px solid #334155;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #1e293b;">
              <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Événement</span><br/>
              <span style="font-size:17px;font-weight:800;color:#f1f5f9;">${params.event_title}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #1e293b;">
              <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Type</span><br/>
              <span style="display:inline-block;margin-top:4px;padding:4px 14px;background:${accentBg};color:${accentColor};border-radius:8px;font-size:13px;font-weight:700;border:1px solid ${accentColor}30;">${typeLabel}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Date</span><br/>
              <span style="font-size:15px;font-weight:700;color:#e2e8f0;">📅 ${params.event_date}</span>
            </td>
          </tr>
        </table>
      </div>
      <p style="margin:24px 0 0;font-size:13px;color:#475569;text-align:center;">Connectez-vous à FCO Manager pour plus de détails 💪</p>
    </div>
  `);
}

// ─── Template: Convocation ───
function convocationEmail(params: {
  player_name: string;
  match_title: string;
  match_date: string;
  status: string;
  position: string;
  jersey_number: string;
}) {
  const isConvoque = params.status === 'Convoqué';
  const statusColor = isConvoque ? '#10b981' : '#ef4444';
  const statusBg = isConvoque ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
  const statusIcon = isConvoque ? '✅' : '❌';

  return baseLayout(`
    <div style="padding:36px 32px 28px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="display:inline-block;font-size:44px;margin-bottom:8px;">🏟️</span>
        <h2 style="margin:0;font-size:22px;font-weight:800;color:#f1f5f9;">Convocation</h2>
        <p style="margin:8px 0 0;font-size:14px;color:#64748b;">Bonjour <strong style="color:#e2e8f0;">${params.player_name}</strong></p>
      </div>
      <!-- Status -->
      <div style="padding:18px 24px;background:${statusBg};border:1px solid ${statusColor}40;border-radius:14px;text-align:center;margin-bottom:24px;">
        <span style="font-size:32px;">${statusIcon}</span>
        <p style="margin:8px 0 0;font-size:20px;font-weight:800;color:${statusColor};">${params.status}</p>
      </div>
      <!-- Details -->
      <div style="background:#0f172a;border-radius:14px;padding:20px 24px;border:1px solid #334155;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #1e293b;">
              <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Match</span><br/>
              <span style="font-size:15px;font-weight:700;color:#f1f5f9;">${params.match_title}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;${isConvoque ? 'border-bottom:1px solid #1e293b;' : ''}">
              <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Date</span><br/>
              <span style="font-size:15px;font-weight:700;color:#e2e8f0;">📅 ${params.match_date}</span>
            </td>
          </tr>
          ${isConvoque ? `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #1e293b;">
              <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Poste</span><br/>
              <span style="font-size:15px;font-weight:700;color:#e2e8f0;">📍 ${params.position}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Numéro</span><br/>
              <span style="font-size:15px;font-weight:700;color:#e2e8f0;">🔢 ${params.jersey_number}</span>
            </td>
          </tr>
          ` : ''}
        </table>
      </div>
      <p style="margin:24px 0 0;font-size:13px;color:#475569;text-align:center;">Bonne préparation ! 💪</p>
    </div>
  `);
}

// ─── Main Handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { type, to, params } = await req.json();

    let subject = "";
    let html = "";

    switch (type) {
      case "invitation":
        subject = "⚽ FCO Manager — Vous êtes invité !";
        html = invitationEmail(params);
        break;
      case "event":
        subject = `⚽ FCO Manager — ${params.event_type === 'match' ? 'Nouveau match' : 'Nouvel entraînement'} : ${params.event_title}`;
        html = eventNotificationEmail(params);
        break;
      case "convocation":
        subject = `⚽ FCO Manager — Convocation : ${params.match_title}`;
        html = convocationEmail(params);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "FCO Manager <noreply@fco-manager.fr>",
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", JSON.stringify(data));
      throw new Error(`Resend error [${res.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Email sending error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
