import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const API_KEY = Deno.env.get("API_FOOTBALL_KEY")!;

// League IDs API-Football
const LEAGUES: Record<string, number> = {
  ligue1: 61,
  ligue2: 62,
  pl: 39,
  laliga: 140,
  seriea: 135,
  bundesliga: 78,
  ucl: 2,
  uel: 3,
  eredivisie: 88,
  primeira: 94,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { mode, date, league, search } = await req.json().catch(() => ({}));

    let url: string;
    if (mode === "search" && search) {
      url = `https://v3.football.api-sports.io/fixtures?search=${encodeURIComponent(search)}`;
    } else {
      const day = (date || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const lid = LEAGUES[league || "ligue1"] ?? 61;
      // Detect season from date (Aug+ → year, else year-1)
      const d = new Date(day);
      const season = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
      url = `https://v3.football.api-sports.io/fixtures?date=${day}&league=${lid}&season=${season}`;
    }

    const r = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
    const data = await r.json();
    console.log("API-Football URL:", url);
    console.log("API-Football response:", JSON.stringify({ results: data?.results, errors: data?.errors, sample: data?.response?.[0] }));
    const fixtures = (data?.response || []).map((f: any) => ({
      fixture_id: f?.fixture?.id,
      date: f?.fixture?.date,
      timestamp: f?.fixture?.timestamp,
      status: f?.fixture?.status?.short,
      league: f?.league?.name,
      league_logo: f?.league?.logo,
      home_team: f?.teams?.home?.name,
      home_logo: f?.teams?.home?.logo,
      away_team: f?.teams?.away?.name,
      away_logo: f?.teams?.away?.logo,
    }));

    return new Response(JSON.stringify({ fixtures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
