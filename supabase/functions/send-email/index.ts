import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_URL = "https://api.resend.com/emails";

// ─── Email Templates ───

const baseLayout = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:1px;">⚽ FCO MANAGER</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">Football Club Organisation · FCO Manager</p>
              <p style="margin:4px 0 0;font-size:11px;color:#cbd5e1;">Cet email a été envoyé automatiquement, merci de ne pas répondre.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const buttonStyle = `display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;`;

// ─── Template: Invitation ───
function invitationEmail(params: {
  invite_link: string;
  role_label: string;
  inviter_name: string;
}) {
  return baseLayout(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Vous êtes invité ! 🎉</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6;">
      <strong style="color:#1e293b;">${params.inviter_name}</strong> vous invite à rejoindre 
      <strong style="color:#1e293b;">FCO Manager</strong> en tant que 
      <span style="display:inline-block;padding:2px 10px;background:#dbeafe;color:#1e40af;border-radius:6px;font-size:13px;font-weight:600;">${params.role_label}</span>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
      Cliquez sur le bouton ci-dessous pour créer votre compte et rejoindre l'équipe.
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
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
      Ou copiez ce lien :<br/>
      <a href="${params.invite_link}" style="color:#3b82f6;word-break:break-all;font-size:12px;">${params.invite_link}</a>
    </p>
    <div style="margin:24px 0 0;padding:12px 16px;background:#fef3c7;border-radius:10px;border:1px solid #fde68a;">
      <p style="margin:0;font-size:12px;color:#92400e;">⏳ Ce lien expire dans <strong>48 heures</strong>.</p>
    </div>
  `);
}

// ─── Template: Event Notification ───
function eventNotificationEmail(params: {
  event_title: string;
  event_type: string;
  event_date: string;
}) {
  const typeIcon = params.event_type === 'match' ? '🏟️' : params.event_type === 'training' ? '🏋️' : '📅';
  const typeColor = params.event_type === 'match' ? '#dc2626' : '#059669';
  const typeBg = params.event_type === 'match' ? '#fef2f2' : '#ecfdf5';

  return baseLayout(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Nouvel événement ${typeIcon}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">Un événement a été ajouté au calendrier.</p>
    <div style="padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:20px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding:6px 0;">
            <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Événement</span><br/>
            <span style="font-size:16px;font-weight:700;color:#1e293b;">${params.event_title}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;">
            <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Type</span><br/>
            <span style="display:inline-block;padding:3px 12px;background:${typeBg};color:${typeColor};border-radius:6px;font-size:13px;font-weight:600;">${params.event_type === 'match' ? 'Match' : params.event_type === 'training' ? 'Entraînement' : 'Événement'}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;">
            <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Date</span><br/>
            <span style="font-size:15px;font-weight:600;color:#1e293b;">📅 ${params.event_date}</span>
          </td>
        </tr>
      </table>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Connectez-vous à FCO Manager pour plus de détails.</p>
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
  const statusColor = isConvoque ? '#059669' : '#dc2626';
  const statusBg = isConvoque ? '#ecfdf5' : '#fef2f2';
  const statusBorder = isConvoque ? '#a7f3d0' : '#fecaca';
  const statusIcon = isConvoque ? '✅' : '❌';

  return baseLayout(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Convocation 🏟️</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">
      Bonjour <strong style="color:#1e293b;">${params.player_name}</strong>, voici votre convocation.
    </p>
    <!-- Status Banner -->
    <div style="padding:16px 20px;background:${statusBg};border:2px solid ${statusBorder};border-radius:12px;text-align:center;margin-bottom:20px;">
      <span style="font-size:28px;">${statusIcon}</span>
      <p style="margin:8px 0 0;font-size:18px;font-weight:800;color:${statusColor};">${params.status}</p>
    </div>
    <!-- Match Details -->
    <div style="padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:20px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding:6px 0;">
            <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Match</span><br/>
            <span style="font-size:15px;font-weight:700;color:#1e293b;">${params.match_title}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;">
            <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Date</span><br/>
            <span style="font-size:14px;font-weight:600;color:#1e293b;">📅 ${params.match_date}</span>
          </td>
        </tr>
        ${isConvoque ? `
        <tr>
          <td style="padding:6px 0;">
            <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Poste</span><br/>
            <span style="font-size:14px;font-weight:600;color:#1e293b;">📍 ${params.position}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;">
            <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Numéro</span><br/>
            <span style="font-size:14px;font-weight:600;color:#1e293b;">🔢 ${params.jersey_number}</span>
          </td>
        </tr>
        ` : ''}
      </table>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Bonne préparation ! 💪</p>
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
        from: "FCO Manager <onboarding@resend.dev>",
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
