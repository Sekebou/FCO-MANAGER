import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as React from "npm:react@18.3.1";
import { renderToStaticMarkup } from "npm:react-dom@18.3.1/server";
import {
  Html, Head, Body, Container, Section, Row, Column,
  Text, Button, Link, Img, Hr, Preview, Font
} from "npm:@react-email/components@0.0.22";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_URL = "https://api.resend.com/emails";

// ─── Design tokens ───
const colors = {
  bg: "#0f172a",
  card: "#1e293b",
  cardBorder: "#334155",
  primary: "#3b82f6",
  primaryGlow: "#6366f1",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  textDark: "#475569",
  success: "#10b981",
  successBg: "rgba(16,185,129,0.15)",
  danger: "#ef4444",
  dangerBg: "rgba(239,68,68,0.15)",
  warning: "#f59e0b",
  divider: "#1e293b",
  innerBg: "#0f172a",
};

const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// ─── Shared Components ───
const EmailWrapper = ({ preview, children }: { preview: string; children: React.ReactNode }) => (
  React.createElement(Html, null,
    React.createElement(Head, null),
    React.createElement(Preview, null, preview),
    React.createElement(Body, { style: { margin: 0, padding: 0, backgroundColor: colors.bg, fontFamily: fontStack } },
      React.createElement(Container, { style: { maxWidth: "540px", margin: "0 auto", padding: "40px 16px" } },
        // Logo
        React.createElement(Section, { style: { textAlign: "center" as const, marginBottom: "24px" } },
          React.createElement("table", { cellPadding: 0, cellSpacing: 0, style: { margin: "0 auto" } },
            React.createElement("tr", null,
              React.createElement("td", {
                style: {
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryGlow})`,
                  padding: "12px 24px",
                  borderRadius: "14px",
                }
              },
                React.createElement("span", {
                  style: { color: "#ffffff", fontSize: "20px", fontWeight: 800, letterSpacing: "1.5px" }
                }, "⚽ FCO MANAGER")
              )
            )
          )
        ),
        // Card
        React.createElement(Section, {
          style: {
            backgroundColor: colors.card,
            borderRadius: "20px",
            overflow: "hidden",
            border: `1px solid ${colors.cardBorder}`,
          }
        }, children),
        // Footer
        React.createElement(Section, { style: { padding: "24px 16px", textAlign: "center" as const } },
          React.createElement(Text, { style: { margin: 0, fontSize: "11px", color: colors.textDark } }, "Football Club Organisation · FCO Manager"),
          React.createElement(Text, { style: { margin: "6px 0 0", fontSize: "10px", color: colors.cardBorder } }, "Email automatique · Ne pas répondre")
        )
      )
    )
  )
);

const InfoRow = ({ label, value, hasBorder = true }: { label: string; value: React.ReactNode; hasBorder?: boolean }) => (
  React.createElement("tr", null,
    React.createElement("td", {
      style: {
        padding: "10px 0",
        borderBottom: hasBorder ? `1px solid ${colors.divider}` : "none",
      }
    },
      React.createElement("span", {
        style: { fontSize: "11px", color: colors.textMuted, textTransform: "uppercase" as const, letterSpacing: "1.5px", fontWeight: 600 }
      }, label),
      React.createElement("br"),
      value
    )
  )
);

const DetailBox = ({ children }: { children: React.ReactNode }) => (
  React.createElement("div", {
    style: {
      background: colors.innerBg,
      borderRadius: "14px",
      padding: "20px 24px",
      border: `1px solid ${colors.cardBorder}`,
    }
  },
    React.createElement("table", { cellPadding: 0, cellSpacing: 0, width: "100%" }, children)
  )
);

const Badge = ({ color, bg, text }: { color: string; bg: string; text: string }) => (
  React.createElement("span", {
    style: {
      display: "inline-block",
      marginTop: "4px",
      padding: "4px 14px",
      background: bg,
      color,
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: 700,
      border: `1px solid ${color}30`,
    }
  }, text)
);

const PrimaryButton = ({ href, text }: { href: string; text: string }) => (
  React.createElement("table", { cellPadding: 0, cellSpacing: 0, border: 0, width: "100%" },
    React.createElement("tr", null,
      React.createElement("td", { align: "center" },
        React.createElement("a", {
          href,
          target: "_blank",
          style: {
            display: "inline-block",
            padding: "16px 40px",
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryGlow})`,
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 700,
            textDecoration: "none",
            borderRadius: "14px",
            letterSpacing: "0.5px",
          }
        }, text)
      )
    )
  )
);

// ─── Template: Invitation ───
function InvitationEmail({ invite_link, role_label, inviter_name }: {
  invite_link: string; role_label: string; inviter_name: string;
}) {
  return React.createElement(EmailWrapper, { preview: `${inviter_name} vous invite à rejoindre FCO Manager` },
    React.createElement("div", { style: { padding: "36px 32px 28px" } },
      // Header
      React.createElement("div", { style: { textAlign: "center" as const, marginBottom: "28px" } },
        React.createElement("div", { style: { fontSize: "44px", marginBottom: "8px" } }, "🎉"),
        React.createElement(Text, { style: { margin: 0, fontSize: "22px", fontWeight: 800, color: colors.textPrimary } }, "Vous êtes invité !"),
      ),
      // Details
      React.createElement("div", { style: { marginBottom: "24px" } },
        React.createElement(DetailBox, null,
          React.createElement(InfoRow, {
            label: "Invité par",
            value: React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: "#e2e8f0" } }, inviter_name),
          }),
          React.createElement(InfoRow, {
            label: "Rôle",
            hasBorder: false,
            value: React.createElement(Badge, {
              color: "#fff",
              bg: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryGlow})`,
              text: role_label,
            }),
          }),
        )
      ),
      React.createElement(Text, {
        style: { margin: "0 0 24px", fontSize: "14px", color: colors.textSecondary, lineHeight: "1.7", textAlign: "center" as const }
      }, "Créez votre compte pour rejoindre l'équipe et accéder à toutes les fonctionnalités."),
      React.createElement(PrimaryButton, { href: invite_link, text: "Créer mon compte →" }),
      React.createElement(Text, {
        style: { margin: "20px 0 0", fontSize: "11px", color: colors.textDark, textAlign: "center" as const, lineHeight: "1.6" }
      },
        "Ou copiez ce lien :",
        React.createElement("br"),
        React.createElement("a", { href: invite_link, style: { color: "#60a5fa", wordBreak: "break-all" as const, fontSize: "11px" } }, invite_link)
      ),
    ),
    // Expiry banner
    React.createElement("div", {
      style: { padding: "14px 32px", background: colors.innerBg, borderTop: `1px solid ${colors.cardBorder}`, textAlign: "center" as const }
    },
      React.createElement("span", { style: { fontSize: "12px", color: colors.warning, fontWeight: 600 } }, "⏳ Ce lien expire dans 48 heures")
    )
  );
}

// ─── Template: Event ───
function EventEmail({ event_title, event_type, event_date }: {
  event_title: string; event_type: string; event_date: string;
}) {
  const isMatch = event_type === "match";
  const typeIcon = isMatch ? "🏟️" : event_type === "training" ? "🏋️" : "📅";
  const typeLabel = isMatch ? "Match" : event_type === "training" ? "Entraînement" : "Événement";
  const accentColor = isMatch ? colors.danger : colors.success;
  const accentBg = isMatch ? colors.dangerBg : colors.successBg;

  return React.createElement(EmailWrapper, { preview: `Nouvel événement : ${event_title}` },
    React.createElement("div", { style: { padding: "36px 32px 28px" } },
      React.createElement("div", { style: { textAlign: "center" as const, marginBottom: "28px" } },
        React.createElement("div", { style: { fontSize: "44px", marginBottom: "8px" } }, typeIcon),
        React.createElement(Text, { style: { margin: 0, fontSize: "22px", fontWeight: 800, color: colors.textPrimary } }, "Nouvel événement"),
        React.createElement(Text, { style: { margin: "8px 0 0", fontSize: "14px", color: colors.textMuted } }, "Un événement a été ajouté au calendrier"),
      ),
      React.createElement(DetailBox, null,
        React.createElement(InfoRow, {
          label: "Événement",
          value: React.createElement("span", { style: { fontSize: "17px", fontWeight: 800, color: colors.textPrimary } }, event_title),
        }),
        React.createElement(InfoRow, {
          label: "Type",
          value: React.createElement(Badge, { color: accentColor, bg: accentBg, text: typeLabel }),
        }),
        React.createElement(InfoRow, {
          label: "Date",
          hasBorder: false,
          value: React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: "#e2e8f0" } }, `📅 ${event_date}`),
        }),
      ),
      React.createElement(Text, {
        style: { margin: "24px 0 0", fontSize: "13px", color: colors.textDark, textAlign: "center" as const }
      }, "Connectez-vous à FCO Manager pour plus de détails 💪"),
    )
  );
}

// ─── Template: Convocation ───
function ConvocationEmail({ player_name, match_title, match_date, status, position, jersey_number }: {
  player_name: string; match_title: string; match_date: string; status: string; position: string; jersey_number: string;
}) {
  const isConvoque = status === "Convoqué";
  const statusColor = isConvoque ? colors.success : colors.danger;
  const statusBg = isConvoque ? colors.successBg : colors.dangerBg;
  const statusIcon = isConvoque ? "✅" : "❌";

  return React.createElement(EmailWrapper, { preview: `Convocation : ${match_title}` },
    React.createElement("div", { style: { padding: "36px 32px 28px" } },
      React.createElement("div", { style: { textAlign: "center" as const, marginBottom: "28px" } },
        React.createElement("div", { style: { fontSize: "44px", marginBottom: "8px" } }, "🏟️"),
        React.createElement(Text, { style: { margin: 0, fontSize: "22px", fontWeight: 800, color: colors.textPrimary } }, "Convocation"),
        React.createElement(Text, { style: { margin: "8px 0 0", fontSize: "14px", color: colors.textMuted } },
          "Bonjour ",
          React.createElement("strong", { style: { color: "#e2e8f0" } }, player_name)
        ),
      ),
      // Status badge
      React.createElement("div", {
        style: {
          padding: "18px 24px",
          background: statusBg,
          border: `1px solid ${statusColor}40`,
          borderRadius: "14px",
          textAlign: "center" as const,
          marginBottom: "24px",
        }
      },
        React.createElement("div", { style: { fontSize: "32px" } }, statusIcon),
        React.createElement(Text, { style: { margin: "8px 0 0", fontSize: "20px", fontWeight: 800, color: statusColor } }, status),
      ),
      // Details
      React.createElement(DetailBox, null,
        React.createElement(InfoRow, {
          label: "Match",
          value: React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: colors.textPrimary } }, match_title),
        }),
        React.createElement(InfoRow, {
          label: "Date",
          hasBorder: isConvoque,
          value: React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: "#e2e8f0" } }, `📅 ${match_date}`),
        }),
        ...(isConvoque ? [
          React.createElement(InfoRow, {
            key: "pos",
            label: "Poste",
            value: React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: "#e2e8f0" } }, `📍 ${position}`),
          }),
          React.createElement(InfoRow, {
            key: "num",
            label: "Numéro",
            hasBorder: false,
            value: React.createElement("span", { style: { fontSize: "15px", fontWeight: 700, color: "#e2e8f0" } }, `🔢 ${jersey_number}`),
          }),
        ] : []),
      ),
      React.createElement(Text, {
        style: { margin: "24px 0 0", fontSize: "13px", color: colors.textDark, textAlign: "center" as const }
      }, "Bonne préparation ! 💪"),
    )
  );
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
    let emailElement: React.ReactElement;

    switch (type) {
      case "invitation":
        subject = "⚽ FCO Manager — Vous êtes invité !";
        emailElement = React.createElement(InvitationEmail, params);
        break;
      case "event":
        subject = `⚽ FCO Manager — ${params.event_type === "match" ? "Nouveau match" : "Nouvel entraînement"} : ${params.event_title}`;
        emailElement = React.createElement(EventEmail, params);
        break;
      case "convocation":
        subject = `⚽ FCO Manager — Convocation : ${params.match_title}`;
        emailElement = React.createElement(ConvocationEmail, params);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const html = renderToStaticMarkup(emailElement);

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
