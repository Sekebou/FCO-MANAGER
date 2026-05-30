import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";

const SUPABASE_URL = "https://onlqjqaejvxcsinfmptx.supabase.co";

type TeamData = {
  team: string;
  championship: { name: string; season: string } | null;
  standings: any[];
  logos: Record<string, string>;
  nextMatch: any | null;
  lastMatch: any | null;
};

const VIEWS = ["next", "last", "standings"] as const;
type View = (typeof VIEWS)[number];

type Slide = { team: string; view: View };

export default function ObsWidget() {
  const [params] = useSearchParams();
  const teamParam = params.get("team"); // si présent, ne montre qu'une équipe
  const interval = Number(params.get("interval") || 8) * 1000;
  // Pause entre 2 cycles (minutes) — défaut 6 min
  const pauseMinutes = Number(params.get("pause") || 6);

  const [teams, setTeams] = useState<Record<string, TeamData> | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const slides: Slide[] = useMemo(() => {
    const teamList = teamParam
      ? [teamParam.toUpperCase()]
      : ["A", "B", "C"];
    const out: Slide[] = [];
    for (const t of teamList) {
      for (const v of VIEWS) out.push({ team: t, view: v });
    }
    return out;
  }, [teamParam]);

  // fetch data
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const url = teamParam
          ? `${SUPABASE_URL}/functions/v1/obs-widget-data?team=${teamParam}`
          : `${SUPABASE_URL}/functions/v1/obs-widget-data`;
        const r = await fetch(url);
        const j = await r.json();
        if (!alive) return;
        if (j.teams) setTeams(j.teams);
        else setTeams({ [j.team]: j });
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
  }, [teamParam]);

  // rotation + pause à la fin d'un cycle
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => {
        const next = i + 1;
        if (next >= slides.length) {
          setPaused(true);
          setTimeout(() => {
            setPaused(false);
            setIndex(0);
          }, pauseMinutes * 60 * 1000);
          return i; // reste sur la dernière slide pendant la pause
        }
        return next;
      });
    }, interval);
    return () => clearInterval(id);
  }, [interval, slides.length, paused, pauseMinutes]);

  // fond transparent pour OBS
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
  }, []);

  const slide = slides[Math.min(index, slides.length - 1)];
  const data = teams?.[slide?.team];

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
        padding: 16,
        color: "#fff",
        background: "transparent",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${slide?.team}-${slide?.view}-${paused ? "p" : "a"}`}
          initial={{ opacity: 0, x: 60, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -60, scale: 0.95 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: "min(720px, 100%)",
            borderRadius: 28,
            padding: 28,
            background:
              "linear-gradient(135deg, rgba(14,43,160,0.95), rgba(8,20,70,0.95))",
            boxShadow:
              "0 30px 60px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08) inset",
            backdropFilter: "blur(18px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <ShineBar />
          <Header team={slide?.team} championship={data?.championship} view={slide?.view} />
          {!data ? (
            <Loading />
          ) : slide.view === "next" ? (
            <NextMatch ev={data.nextMatch} />
          ) : slide.view === "last" ? (
            <LastMatch m={data.lastMatch} logos={data.logos} />
          ) : (
            <Standings rows={data.standings} />
          )}
          <Footer index={index} total={slides.length} />
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
  team?: string;
  championship?: TeamData["championship"];
  view?: View;
}) {
  const titles: Record<View, string> = {
    next: "Prochain match",
    last: "Dernier résultat",
    standings: "Classement",
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "linear-gradient(135deg, #ffb800, #ff7a00)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            color: "#1a1a1a",
            fontSize: 22,
          }}
        >
          {team}
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              opacity: 0.75,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            FCO • Équipe {team}
          </div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{view ? titles[view] : ""}</div>
        </div>
      </div>
      {championship && (
        <div style={{ textAlign: "right", fontSize: 13, opacity: 0.8, fontWeight: 600 }}>
          <div>{championship.name}</div>
          <div style={{ opacity: 0.7 }}>{championship.season}</div>
        </div>
      )}
    </div>
  );
}

function Loading() {
  return <div style={{ padding: 48, textAlign: "center", opacity: 0.6, fontSize: 16 }}>Chargement…</div>;
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
    <div style={{ padding: "12px 0 6px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 12 }}>
        <TeamBlock name={home || "Domicile"} logo={ev.home_logo} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 3 }}>VS</div>
          <div style={{ fontSize: 16, opacity: 0.9, marginTop: 6, fontWeight: 600 }}>
            {fmtDate(ev.date)} {ev.time ? `• ${ev.time}` : ""}
          </div>
          {ev.location && (
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{ev.location}</div>
          )}
        </div>
        <TeamBlock name={away || "Extérieur"} logo={ev.away_logo} />
      </div>
    </div>
  );
}

function LastMatch({ m, logos }: { m: any; logos: Record<string, string> }) {
  if (!m) return <Empty msg="Aucun match récent" />;
  const homeLogo = logos?.[m.home_team];
  const awayLogo = logos?.[m.away_team];
  const isHome = /oisemont/i.test(m.home_team);
  const us = isHome ? m.home_score : m.away_score;
  const them = isHome ? m.away_score : m.home_score;
  const res = us > them ? "V" : us < them ? "D" : "N";
  const resColor = res === "V" ? "#22c55e" : res === "D" ? "#ef4444" : "#a3a3a3";
  const resLabel = res === "V" ? "Victoire" : res === "D" ? "Défaite" : "Nul";
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 12 }}>
        <TeamBlock name={m.home_team} logo={homeLogo} />
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              letterSpacing: 2,
              lineHeight: 1,
            }}
          >
            {m.home_score} <span style={{ opacity: 0.5 }}>-</span> {m.away_score}
          </div>
          <div
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: "4px 12px",
              borderRadius: 999,
              background: resColor,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {resLabel}
          </div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
            J{m.journee} • {fmtDate(m.date)}
          </div>
        </div>
        <TeamBlock name={m.away_team} logo={awayLogo} />
      </div>
    </div>
  );
}

function TeamBlock({ name, logo }: { name: string; logo?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 180 }}>
      {logo ? (
        <img src={logo} style={{ width: 72, height: 72, objectFit: "contain" }} alt="" />
      ) : (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }}
        />
      )}
      <div style={{ fontSize: 15, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>
        {name}
      </div>
    </div>
  );
}

function Standings({ rows }: { rows: any[] }) {
  if (!rows?.length) return <Empty msg="Classement indisponible" />;
  const top = rows.slice(0, 8);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
              gridTemplateColumns: "34px 1fr 48px 48px",
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 10,
              background: isUs ? "rgba(255,184,0,0.25)" : "rgba(255,255,255,0.05)",
              fontWeight: isUs ? 900 : 600,
              fontSize: 15,
            }}
          >
            <div style={{ opacity: 0.7, fontWeight: 800 }}>{r.rank || r.position || i + 1}</div>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </div>
            <div style={{ textAlign: "center", opacity: 0.75 }}>{r.played || r.mj || "-"}</div>
            <div style={{ textAlign: "center", fontWeight: 900 }}>{r.points ?? r.pts ?? "-"}</div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: 48, textAlign: "center", opacity: 0.6, fontSize: 16 }}>{msg}</div>;
}

function Footer({ index, total }: { index: number; total: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === index ? 28 : 8,
            height: 8,
            borderRadius: 4,
            background: i === index ? "#ffb800" : "rgba(255,255,255,0.25)",
            transition: "width 0.4s",
          }}
        />
      ))}
    </div>
  );
}
