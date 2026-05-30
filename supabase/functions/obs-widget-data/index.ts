// Public OBS widget data endpoint
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const team = url.searchParams.get("team") || "A"; // A | B | C

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date().toISOString().slice(0, 10);

  // Championnat actif pour cette équipe (par suffixe dans le nom)
  const { data: champs } = await supabase
    .from("championships")
    .select("id,name,season,fff_standings,team_logos,team")
    .order("created_at", { ascending: false });

  const champ =
    champs?.find((c) => (c.team || "").toUpperCase() === team.toUpperCase()) ||
    champs?.find((c) => new RegExp(`\\b${team}\\b`, "i").test(c.name)) ||
    champs?.[0];

  let standings: any[] = [];
  let matches: any[] = [];
  let logos: Record<string, string> = {};

  if (champ) {
    standings = Array.isArray(champ.fff_standings) ? champ.fff_standings : [];
    logos = (champ.team_logos as any) || {};
    const { data: cm } = await supabase
      .from("championship_matches")
      .select("*")
      .eq("championship_id", champ.id)
      .order("date", { ascending: true });
    matches = cm || [];
  }

  // Prochain & dernier match (events ciblant l'équipe)
  const { data: events } = await supabase
    .from("events")
    .select("id,title,date,time,type,location,home_logo,away_logo,team")
    .eq("type", "match")
    .order("date", { ascending: true });

  const teamEvents = (events || []).filter(
    (e) => !e.team || e.team.toUpperCase().endsWith(team.toUpperCase())
  );
  const next = teamEvents.find((e) => e.date >= today) || null;
  const last = [...teamEvents].reverse().find((e) => e.date < today) || null;

  return new Response(
    JSON.stringify({
      team,
      championship: champ
        ? { name: champ.name, season: champ.season }
        : null,
      standings,
      logos,
      lastMatches: matches.filter((m) => m.played).slice(-5),
      nextMatch: next,
      lastMatch: last,
      updatedAt: new Date().toISOString(),
    }),
    { headers: cors }
  );
});
