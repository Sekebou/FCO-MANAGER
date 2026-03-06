import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as React from "npm:react@18.3.1";
import { renderToStaticMarkup } from "npm:react-dom@18.3.1/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_URL = "https://api.resend.com/emails";
const LOGO_URL = "https://fco-manager.fr/logo.png";

// ─── Design System ───
const ds = {
  // Colors
  blue: "#0e2ba0",
  blueDark: "#091d6e",
  blueLight: "#e8ecfa",
  blueSoft: "#3454d1",
  white: "#ffffff",
  gray50: "#fafbfc",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray900: "#111827",
  success: "#059669",
  successLight: "#ecfdf5",
  successBorder: "#a7f3d0",
  danger: "#dc2626",
  dangerLight: "#fef2f2",
  dangerBorder: "#fecaca",
  amber: "#d97706",
  amberLight: "#fffbeb",
  amberBorder: "#fde68a",
  // Typography
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

// ─── Reusable Elements ───
const e = React.createElement;

const Spacer = ({ h = 24 }: { h?: number }) => e("div", { style: { height: `${h}px` } });

const EmailShell = ({ preview, children }: { preview: string; children: React.ReactNode }) =>
  e("html", null,
    e("head", null,
      e("meta", { charSet: "utf-8" }),
      e("meta", { name: "viewport", content: "width=device-width, initial-scale=1.0" }),
      e("meta", { name: "x-apple-disable-message-reformatting" }),
      e("meta", { name: "color-scheme", content: "light" }),
      e("meta", { name: "supported-color-schemes", content: "light" }),
    ),
    e("body", {
      style: {
        margin: 0, padding: 0,
        backgroundColor: ds.gray100,
        fontFamily: ds.font,
        WebkitTextSizeAdjust: "100%",
        MsTextSizeAdjust: "100%",
      }
    },
      // Preview text
      e("div", {
        style: {
          display: "none", maxHeight: 0, overflow: "hidden",
          fontSize: "1px", lineHeight: "1px", color: ds.gray100,
        }
      }, preview),
      // Outer wrapper
      e("table", {
        role: "presentation", width: "100%", cellPadding: 0, cellSpacing: 0,
        style: { backgroundColor: ds.gray100, padding: "32px 16px" }
      },
        e("tr", null,
          e("td", { align: "center" },
            // Main container
            e("table", {
              role: "presentation", cellPadding: 0, cellSpacing: 0,
              style: { maxWidth: "520px", width: "100%" }
            },
              // ── Header with logo ──
              e("tr", null,
                e("td", { align: "center", style: { paddingBottom: "32px" } },
                  e("table", { role: "presentation", cellPadding: 0, cellSpacing: 0 },
                    e("tr", null,
                      e("td", { align: "center" },
                        e("img", {
                          src: LOGO_URL,
                          alt: "FCO Manager",
                          width: 56, height: 56,
                          style: {
                            display: "block",
                            width: "56px", height: "56px",
                            borderRadius: "16px",
                            objectFit: "contain" as const,
                          }
                        }),
                      ),
                    ),
                    e("tr", null,
                      e("td", {
                        align: "center",
                        style: { paddingTop: "12px" }
                      },
                        e("span", {
                          style: {
                            fontSize: "13px",
                            fontWeight: 700,
                            color: ds.blue,
                            letterSpacing: "2px",
                            textTransform: "uppercase" as const,
                          }
                        }, "FCO MANAGER")
                      )
                    )
                  )
                )
              ),
              // ── Card ──
              e("tr", null,
                e("td", null,
                  e("table", {
                    role: "presentation", cellPadding: 0, cellSpacing: 0, width: "100%",
                    style: {
                      backgroundColor: ds.white,
                      borderRadius: "16px",
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
                    }
                  },
                    e("tr", null,
                      e("td", null, children)
                    )
                  )
                )
              ),
              // ── Footer ──
              e("tr", null,
                e("td", {
                  style: { padding: "28px 20px 0", textAlign: "center" as const }
                },
                  e("p", {
                    style: { margin: 0, fontSize: "12px", color: ds.gray500, lineHeight: "1.5" }
                  }, "© 2026 FCO Manager · Football Club Organisation"),
                  e("p", {
                    style: { margin: "6px 0 0", fontSize: "11px", color: ds.gray300 }
                  }, "Cet email a été envoyé automatiquement. Merci de ne pas y répondre.")
                )
              )
            )
          )
        )
      )
    )
  );

// ── Accent bar (top of card) ──
const AccentBar = ({ color = ds.blue }: { color?: string }) =>
  e("div", { style: { height: "4px", background: `linear-gradient(90deg, ${color}, ${ds.blueSoft})` } });

// ── Section title with emoji icon ──
const SectionTitle = ({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) =>
  e("div", { style: { textAlign: "center" as const, padding: "32px 32px 0" } },
    e("div", {
      style: {
        display: "inline-block",
        width: "56px", height: "56px", lineHeight: "56px",
        borderRadius: "16px",
        backgroundColor: ds.blueLight,
        fontSize: "28px",
        textAlign: "center" as const,
      }
    }, emoji),
    e(Spacer, { h: 16 }),
    e("h1", {
      style: {
        margin: 0, fontSize: "22px", fontWeight: 800,
        color: ds.gray900, lineHeight: "1.3",
      }
    }, title),
    subtitle ? e("p", {
      style: { margin: "8px 0 0", fontSize: "14px", color: ds.gray500, lineHeight: "1.5" }
    }, subtitle) : null
  );

// ── Info row for detail boxes ──
const InfoRow = ({ icon, label, value, isLast = false }: {
  icon: string; label: string; value: React.ReactNode; isLast?: boolean;
}) =>
  e("tr", null,
    e("td", {
      style: {
        padding: "14px 20px",
        borderBottom: isLast ? "none" : `1px solid ${ds.gray200}`,
      }
    },
      e("table", { role: "presentation", cellPadding: 0, cellSpacing: 0, width: "100%" },
        e("tr", null,
          e("td", { style: { width: "28px", verticalAlign: "top", paddingTop: "2px" } },
            e("span", { style: { fontSize: "16px" } }, icon)
          ),
          e("td", null,
            e("div", {
              style: { fontSize: "10px", color: ds.gray500, textTransform: "uppercase" as const, letterSpacing: "1.2px", fontWeight: 600 }
            }, label),
            e("div", {
              style: { fontSize: "14px", fontWeight: 600, color: ds.gray900, marginTop: "3px" }
            }, value)
          )
        )
      )
    )
  );

// ── Detail card ──
const DetailCard = ({ children }: { children: React.ReactNode }) =>
  e("div", { style: { margin: "0 28px", borderRadius: "12px", border: `1px solid ${ds.gray200}`, overflow: "hidden", backgroundColor: ds.gray50 } },
    e("table", { role: "presentation", cellPadding: 0, cellSpacing: 0, width: "100%" }, children)
  );

// ── CTA Button ──
const CTAButton = ({ href, label }: { href: string; label: string }) =>
  e("table", { role: "presentation", cellPadding: 0, cellSpacing: 0, width: "100%" },
    e("tr", null,
      e("td", { align: "center", style: { padding: "0 28px" } },
        e("a", {
          href, target: "_blank",
          style: {
            display: "block",
            padding: "16px 32px",
            backgroundColor: ds.blue,
            color: ds.white,
            fontSize: "15px",
            fontWeight: 700,
            textDecoration: "none",
            borderRadius: "12px",
            textAlign: "center" as const,
            width: "100%",
            boxSizing: "border-box" as const,
          }
        }, label)
      )
    )
  );

// ── Status pill ──
const StatusPill = ({ isPositive, text }: { isPositive: boolean; text: string }) => {
  const bg = isPositive ? ds.successLight : ds.dangerLight;
  const border = isPositive ? ds.successBorder : ds.dangerBorder;
  const color = isPositive ? ds.success : ds.danger;
  const icon = isPositive ? "✅" : "❌";
  return e("div", {
    style: {
      margin: "0 28px",
      padding: "16px 20px",
      backgroundColor: bg,
      border: `1px solid ${border}`,
      borderRadius: "12px",
      textAlign: "center" as const,
    }
  },
    e("span", { style: { fontSize: "28px", display: "block", marginBottom: "6px" } }, icon),
    e("span", { style: { fontSize: "18px", fontWeight: 800, color } }, text),
  );
};

// ── Expiry banner ──
const ExpiryBanner = ({ text }: { text: string }) =>
  e("div", {
    style: {
      margin: "0 28px",
      padding: "12px 16px",
      backgroundColor: ds.amberLight,
      border: `1px solid ${ds.amberBorder}`,
      borderRadius: "10px",
      textAlign: "center" as const,
    }
  },
    e("span", { style: { fontSize: "12px", fontWeight: 600, color: ds.amber } }, `⏳ ${text}`)
  );

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEMPLATE: INVITATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function InvitationEmail({ invite_link, role_label, inviter_name }: {
  invite_link: string; role_label: string; inviter_name: string;
}) {
  return e(EmailShell, { preview: `${inviter_name} vous invite à rejoindre FCO Manager` },
    e(AccentBar, {}),
    e(SectionTitle, {
      emoji: "🎉",
      title: "Vous êtes invité !",
      subtitle: "Rejoignez votre équipe sur FCO Manager",
    }),
    e(Spacer, { h: 24 }),
    e(DetailCard, null,
      e(InfoRow, { icon: "👤", label: "Invité par", value: inviter_name }),
      e(InfoRow, {
        icon: "🛡️", label: "Rôle attribué", isLast: true,
        value: e("span", {
          style: {
            display: "inline-block",
            padding: "3px 12px",
            backgroundColor: ds.blueLight,
            color: ds.blue,
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 700,
          }
        }, role_label)
      }),
    ),
    e(Spacer, { h: 24 }),
    e("p", {
      style: { margin: "0 28px", fontSize: "14px", color: ds.gray600, lineHeight: "1.7", textAlign: "center" as const }
    }, "Créez votre compte en quelques secondes pour accéder au calendrier, aux convocations et à toutes les fonctionnalités du club."),
    e(Spacer, { h: 24 }),
    e(CTAButton, { href: invite_link, label: "Créer mon compte →" }),
    e(Spacer, { h: 16 }),
    e(ExpiryBanner, { text: "Ce lien expire dans 48 heures" }),
    e(Spacer, { h: 16 }),
    e("p", {
      style: { margin: "0 28px 28px", fontSize: "11px", color: ds.gray500, textAlign: "center" as const, lineHeight: "1.6" }
    },
      "Ou copiez ce lien : ",
      e("a", { href: invite_link, style: { color: ds.blueSoft, wordBreak: "break-all" as const } }, invite_link)
    ),
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEMPLATE: EVENT NOTIFICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function EventEmail({ event_title, event_type, event_date }: {
  event_title: string; event_type: string; event_date: string;
}) {
  const isMatch = event_type === "match";
  const isTraining = event_type === "training";
  const emoji = isMatch ? "🏟️" : isTraining ? "🏋️" : "📅";
  const typeLabel = isMatch ? "Match" : isTraining ? "Entraînement" : "Événement";
  const pillColor = isMatch ? ds.danger : ds.success;
  const pillBg = isMatch ? ds.dangerLight : ds.successLight;
  const pillBorder = isMatch ? ds.dangerBorder : ds.successBorder;

  return e(EmailShell, { preview: `Nouvel événement : ${event_title}` },
    e(AccentBar, { color: isMatch ? ds.danger : ds.success }),
    e(SectionTitle, {
      emoji,
      title: "Nouvel événement",
      subtitle: "Un événement a été ajouté au calendrier",
    }),
    e(Spacer, { h: 24 }),
    e(DetailCard, null,
      e(InfoRow, {
        icon: "📌", label: "Événement",
        value: e("span", { style: { fontSize: "15px" } }, event_title),
      }),
      e(InfoRow, {
        icon: "🏷️", label: "Type",
        value: e("span", {
          style: {
            display: "inline-block",
            padding: "3px 12px",
            backgroundColor: pillBg,
            color: pillColor,
            border: `1px solid ${pillBorder}`,
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 700,
          }
        }, typeLabel),
      }),
      e(InfoRow, { icon: "📅", label: "Date", value: event_date, isLast: true }),
    ),
    e(Spacer, { h: 24 }),
    e("p", {
      style: { margin: "0 28px 28px", fontSize: "14px", color: ds.gray500, textAlign: "center" as const, lineHeight: "1.6" }
    }, "Connectez-vous à FCO Manager pour consulter les détails et confirmer votre présence. 💪"),
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEMPLATE: CONVOCATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ConvocationEmail({ player_name, match_title, match_date, status, position, jersey_number }: {
  player_name: string; match_title: string; match_date: string;
  status: string; position: string; jersey_number: string;
}) {
  const isConvoque = status === "Convoqué";

  return e(EmailShell, { preview: `Convocation : ${match_title} — ${status}` },
    e(AccentBar, { color: isConvoque ? ds.success : ds.danger }),
    e(SectionTitle, {
      emoji: "🏟️",
      title: "Convocation",
      subtitle: `Bonjour ${player_name}`,
    }),
    e(Spacer, { h: 20 }),
    e(StatusPill, { isPositive: isConvoque, text: status }),
    e(Spacer, { h: 20 }),
    e(DetailCard, null,
      e(InfoRow, { icon: "⚽", label: "Match", value: match_title }),
      e(InfoRow, {
        icon: "📅", label: "Date", value: match_date,
        isLast: !isConvoque,
      }),
      ...(isConvoque ? [
        e(InfoRow, { key: "pos", icon: "📍", label: "Poste", value: position }),
        e(InfoRow, { key: "num", icon: "🔢", label: "Numéro", value: `#${jersey_number}`, isLast: true }),
      ] : []),
    ),
    e(Spacer, { h: 24 }),
    e("p", {
      style: { margin: "0 28px 28px", fontSize: "14px", color: ds.gray500, textAlign: "center" as const, lineHeight: "1.6" }
    }, isConvoque
      ? "Prépare-toi bien et sois au rendez-vous ! On compte sur toi. 💪🔥"
      : "Tu n'es pas convoqué pour ce match. Continue les efforts à l'entraînement ! 💪"
    ),
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEMPLATE: SUPPORT REQUEST
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SupportEmail({ name, email, subject, message }: {
  name: string; email: string; subject: string; message: string;
}) {
  return e(EmailShell, { preview: `Demande d'assistance : ${subject}` },
    e(AccentBar, { color: ds.amber }),
    e(SectionTitle, {
      emoji: "🆘",
      title: "Demande d'assistance",
      subtitle: "Un utilisateur a besoin d'aide",
    }),
    e(Spacer, { h: 24 }),
    e(DetailCard, null,
      e(InfoRow, { icon: "👤", label: "Nom", value: name }),
      e(InfoRow, { icon: "📧", label: "Email", value: e("a", { href: `mailto:${email}`, style: { color: ds.blueSoft, textDecoration: "none" } }, email) }),
      e(InfoRow, { icon: "📌", label: "Sujet", value: subject, isLast: true }),
    ),
    e(Spacer, { h: 20 }),
    e("div", { style: { margin: "0 28px", padding: "16px 20px", backgroundColor: ds.gray50, border: `1px solid ${ds.gray200}`, borderRadius: "12px" } },
      e("div", { style: { fontSize: "10px", color: ds.gray500, textTransform: "uppercase" as const, letterSpacing: "1.2px", fontWeight: 600, marginBottom: "8px" } }, "MESSAGE"),
      e("p", { style: { margin: 0, fontSize: "14px", color: ds.gray700, lineHeight: "1.7", whiteSpace: "pre-wrap" as const } }, message),
    ),
    e(Spacer, { h: 20 }),
    e(CTAButton, { href: `mailto:${email}?subject=Re: ${encodeURIComponent(subject)}`, label: `Répondre à ${name} →` }),
    e(Spacer, { h: 28 }),
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
        subject = "⚽ Vous êtes invité sur FCO Manager !";
        emailElement = e(InvitationEmail, params);
        break;
      case "event": {
        const isMatch = params.event_type === "match";
        subject = `${isMatch ? "🏟️" : "🏋️"} ${isMatch ? "Nouveau match" : "Nouvel entraînement"} — ${params.event_title}`;
        emailElement = e(EventEmail, params);
        break;
      }
      case "convocation":
        subject = `🏟️ Convocation — ${params.match_title}`;
        emailElement = e(ConvocationEmail, params);
        break;
      case "support":
        subject = `🆘 Assistance — ${params.subject}`;
        emailElement = e(SupportEmail, params);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const html = "<!DOCTYPE html>" + renderToStaticMarkup(emailElement);

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
