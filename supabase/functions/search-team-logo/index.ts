import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// TheSportsDB — free key "3" restricts searchteams.php (always returns Arsenal).
// Workaround: fetch all teams for major leagues (cached in-memory) and filter locally.

const LEAGUES = [
  "French Ligue 1", "French Ligue 2", "English Premier League", "English League Championship",
  "Spanish La Liga", "Spanish La Liga 2", "Italian Serie A", "Italian Serie B",
  "German Bundesliga", "German Bundesliga 2", "Portuguese Primeira Liga",
  "Dutch Eredivisie", "Belgian Pro League", "Turkish Super Lig",
  "UEFA Champions League", "Scottish Premiership",
  "American Major League Soccer", "Brazilian Serie A", "Argentinian Primera Division",
  "Saudi Pro League",
];

type Team = { id: number; name: string; alt: string; country: string; logo: string };
let CACHE: { at: number; teams: Team[] } | null = null;
const TTL = 1000 * 60 * 60 * 12; // 12h

async function loadAllTeams(): Promise<Team[]> {
  if (CACHE && Date.now() - CACHE.at < TTL) return CACHE.teams;
  const out: Team[] = [];
  const seen = new Set<number>();
  await Promise.all(LEAGUES.map(async (l) => {
    try {
      const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/search_all_teams.php?l=${encodeURIComponent(l)}`);
      const d = await r.json();
      for (const t of (d?.teams ?? [])) {
        const id = Number(t.idTeam);
        if (!id || seen.has(id)) continue;
        const logo = t.strBadge || t.strLogo || t.strTeamBadge || "";
        if (!logo) continue;
        seen.add(id);
        out.push({
          id, name: t.strTeam,
          alt: (t.strTeamAlternate || "").toLowerCase(),
          country: t.strCountry || "",
          logo,
        });
      }
    } catch (e) { console.warn("league fail", l, e); }
  }));
  CACHE = { at: Date.now(), teams: out };
  console.log(`Loaded ${out.length} teams`);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { search } = await req.json();
    if (!search || typeof search !== "string" || search.trim().length < 2) {
      return new Response(JSON.stringify({ teams: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const q = search.trim().toLowerCase();
    const all = await loadAllTeams();
    const matches = all
      .map((t) => {
        const n = t.name.toLowerCase();
        let score = 0;
        if (n === q) score = 100;
        else if (n.startsWith(q)) score = 80;
        else if (n.includes(q)) score = 60;
        else if (t.alt.includes(q)) score = 40;
        return { t, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(({ t }) => ({ id: t.id, name: t.name, country: t.country, logo: t.logo }));

    return new Response(JSON.stringify({ teams: matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("search-team-logo error", e);
    return new Response(JSON.stringify({ error: e.message ?? "error", teams: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
