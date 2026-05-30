import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";

const SUPABASE_URL = "https://onlqjqaejvxcsinfmptx.supabase.co";

type Data = {
  team: string;
  championship: { name: string; season: string } | null;
  standings: any[];
  logos: Record<string, string>;
  lastMatches: any[];
  nextMatch: any | null;
  lastMatch: any | null;
};

const VIEWS = ["next", "last", "standings", "form"] as const;
type View = (typeof VIEWS)[number];

export default function ObsWidget() {
  const [params] = useSearchParams();
  const team = (params.get("team") || "A").toUpperCase();
  const interval = Number(params.get("interval") || 10) * 1000;
  const theme = params.get("theme") || "dark"; // dark|light|transparent

  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<View>("next");

  // fetch data
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/obs-widget-data?team=${team}`
        );
        const j = await r.json();
        if (alive) setData(j);
      } catch (e) {
        console.error(e);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [team]);

  // rotate views
  useEffect(() => {
    const id = setInterval(() => {
      setView((v) => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length]);
    }, interval);
    return () => clearInterval(id);
  }, [interval]);

  // transparent BG for OBS
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
  }, []);

  const isDark = theme !== "light";

  return (
    <div
      style={{
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        color: isDark ? "#fff" : "#0a0a0a",
        background: "transparent",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, x: 60, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -60, scale: 0.95 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: "min(680px, 100%)",
            borderRadius: 24,
            padding: 24,
            background: isDark
              ? "linear-gradient(135deg, rgba(14,43,160,0.92), rgba(8,20,70,0.92))"
              : "rgba(255,255,255,0.95)",
            boxShadow:
              "0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08) inset",
            backdropFilter: "blur(18px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <ShineBar />
          <Header team={team} championship={data?.championship} view={view} />
          {!data ? (
            <Loading />
          ) : view === "next" ? (
            <NextMatch ev={data.nextMatch} />
          ) : view === "last" ? (
            <LastMatch ev={data.lastMatch} />
          ) : view === "standings" ? (
            <Standings rows={data.standings} />
          ) : (
            <FormStrip matches={data.lastMatches} />
          )}
          <Footer view={view} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ShineBar() {
  return (
    <motion.div
      initial={{ x: "-150%" }}
      animate={{ x: "150%" }}
      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "60%",
        height: "100%",
        background:
          "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)",
        pointerEvents: "none",
      }}
    />
  );
}

function Header({
  team,
  championship,
  view,
}: {
  team: string;
  championship: Data["championship"];
  view: View;
}) {
  const titles: Record<View, string> = {
    next: "Prochain match",
    last: "Dernier résultat",
    standings: "Classement",
    form: "Forme récente",
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background:
              "linear-gradient(135deg, #ffb800, #ff7a00)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            color: "#1a1a1a",
            fontSize: 18,
          }}
        >
          {team}
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 1, textTransform: "uppercase" }}>
            FCO • Équipe {team}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{titles[view]}</div>
        </div>
      </div>
      {championship && (
        <div style={{ textAlign: "right", fontSize: 11, opacity: 0.7 }}>
          <div>{championship.name}</div>
          <div>{championship.season}</div>
        </div>
      )}
    </div>
  );
}

function Loading() {
  return <div style={{ padding: 40, textAlign: "center", opacity: 0.6 }}>Chargement…</div>;
}

function fmtDate(d?: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

function NextMatch({ ev }: { ev: any }) {
  if (!ev) return <Empty msg="Aucun match prévu" />;
  const [home, away] = (ev.title || "").split(/vs|VS|-/i).map((s: string) => s.trim());
  return (
    <div style={{ padding: "8px 0 4px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 12 }}>
        <TeamBlock name={home || "Domicile"} logo={ev.home_logo} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 2 }}>VS</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            {fmtDate(ev.date)} {ev.time ? `• ${ev.time}` : ""}
          </div>
          {ev.location && (
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{ev.location}</div>
          )}
        </div>
        <TeamBlock name={away || "Extérieur"} logo={ev.away_logo} />
      </div>
    </div>
  );
}

function LastMatch({ ev }: { ev: any }) {
  if (!ev) return <Empty msg="Aucun match récent" />;
  const [home, away] = (ev.title || "").split(/vs|VS|-/i).map((s: string) => s.trim());
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 12 }}>
        <TeamBlock name={home || "Domicile"} logo={ev.home_logo} />
        <div style={{ fontSize: 14, opacity: 0.7 }}>{fmtDate(ev.date)}</div>
        <TeamBlock name={away || "Extérieur"} logo={ev.away_logo} />
      </div>
    </div>
  );
}

function TeamBlock({ name, logo }: { name: string; logo?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, maxWidth: 180 }}>
      {logo ? (
        <img src={logo} style={{ width: 64, height: 64, objectFit: "contain" }} alt="" />
      ) : (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }}
        />
      )}
      <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center" }}>{name}</div>
    </div>
  );
}

function Standings({ rows }: { rows: any[] }) {
  if (!rows?.length) return <Empty msg="Classement indisponible" />;
  const top = rows.slice(0, 8);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {top.map((r, i) => {
        const name = r.team || r.name || r.club || "—";
        const isUs = /oisemont/i.test(name);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr 40px 40px",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: 8,
              background: isUs ? "rgba(255,184,0,0.2)" : "rgba(255,255,255,0.04)",
              fontWeight: isUs ? 800 : 500,
              fontSize: 13,
            }}
          >
            <div style={{ opacity: 0.7 }}>{r.rank || r.position || i + 1}</div>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            <div style={{ textAlign: "center", opacity: 0.7 }}>{r.played || r.mj || "-"}</div>
            <div style={{ textAlign: "center", fontWeight: 800 }}>{r.points ?? r.pts ?? "-"}</div>
          </motion.div>
        );
      })}
    </div>
  );
}

function FormStrip({ matches }: { matches: any[] }) {
  if (!matches?.length) return <Empty msg="Pas de résultats récents" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {matches.map((m, i) => {
        const isHome = /oisemont/i.test(m.home_team);
        const us = isHome ? m.home_score : m.away_score;
        const them = isHome ? m.away_score : m.home_score;
        const res = us > them ? "V" : us < them ? "D" : "N";
        const color = res === "V" ? "#22c55e" : res === "D" ? "#ef4444" : "#a3a3a3";
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: color,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {res}
              </div>
              <div style={{ opacity: 0.9 }}>
                {m.home_team} <span style={{ opacity: 0.4 }}>vs</span> {m.away_team}
              </div>
            </div>
            <div style={{ fontWeight: 800 }}>
              {m.home_score} - {m.away_score}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: 40, textAlign: "center", opacity: 0.6 }}>{msg}</div>;
}

function Footer({ view }: { view: View }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
      {VIEWS.map((v) => (
        <div
          key={v}
          style={{
            width: v === view ? 24 : 6,
            height: 6,
            borderRadius: 3,
            background: v === view ? "#ffb800" : "rgba(255,255,255,0.3)",
            transition: "width 0.4s",
          }}
        />
      ))}
    </div>
  );
}
