// Public OBS widget data endpoint
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

async function fetchTeam(supabase: any, team: string) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: champs } = await supabase
    .from("championships")
    .select("id,name,season,fff_standings,team_logos,team,fff_live_cache")
    .order("created_at", { ascending: false });

  const champ =
    champs?.find((c: any) => (c.team || "").toUpperCase() === team.toUpperCase()) ||
    champs?.find((c: any) => new RegExp(`\\b${team}\\b`, "i").test(c.name)) ||
    null;

  let standings: any[] = [];
  let matches: any[] = [];
  let logos: Record<string, string> = {};

  if (champ) {
    standings = Array.isArray(champ.fff_standings) ? champ.fff_standings : [];
    logos = { ...((champ.team_logos as any) || {}) };

    // Extract logos from fff_live_cache results
    const results = champ.fff_live_cache?.results || [];
    for (const r of results) {
      for (const m of (r.matchs || [])) {
        for (const side of ['home', 'away']) {
          const s = m[side];
          const url = s?.club?.logo;
          if (!url) continue;
          if (s.short_name) logos[s.short_name] = url;
          if (s.name) logos[s.name] = url;
        }
      }
    }

    const { data: cm } = await supabase
      .from("championship_matches")
      .select("*")
      .eq("championship_id", champ.id)
      .order("date", { ascending: true });
    matches = cm || [];
  }

  const { data: events } = await supabase
    .from("events")
    .select("id,title,date,time,type,location,home_logo,away_logo,team")
    .eq("type", "match")
    .order("date", { ascending: true });

  const teamEvents = (events || []).filter(
    (e: any) => !e.team || e.team.toUpperCase().endsWith(team.toUpperCase())
  );
  const next = teamEvents.find((e: any) => e.date >= today) || null;

  // Last played match WITH score (championship_matches filtered to oisemont)
  const playedOisemont = matches.filter(
    (m: any) => m.played && /oisemont/i.test(`${m.home_team} ${m.away_team}`)
  );
  const lastPlayed = playedOisemont[playedOisemont.length - 1] || null;

  return {
    team,
    championship: champ ? { name: champ.name, season: champ.season } : null,
    standings,
    logos,
    nextMatch: next,
    lastMatch: lastPlayed,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const teamParam = url.searchParams.get("team");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (teamParam) {
    const data = await fetchTeam(supabase, teamParam.toUpperCase());
    return new Response(
      JSON.stringify({ ...data, updatedAt: new Date().toISOString() }),
      { headers: cors }
    );
  }

  // All teams
  const [a, b, c] = await Promise.all([
    fetchTeam(supabase, "A"),
    fetchTeam(supabase, "B"),
    fetchTeam(supabase, "C"),
  ]);

  return new Response(
    JSON.stringify({ teams: { A: a, B: b, C: c }, updatedAt: new Date().toISOString() }),
    { headers: cors }
  );
});
