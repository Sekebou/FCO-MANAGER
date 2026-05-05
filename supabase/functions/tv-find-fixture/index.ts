import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const API_KEY = Deno.env.get("API_FOOTBALL_KEY")!;

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { home_team, away_team, date } = await req.json();
    if (!home_team || !away_team || !date) {
      return new Response(JSON.stringify({ error: "missing params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const day = String(date).slice(0, 10);
    const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${day}`, {
      headers: { "x-apisports-key": API_KEY },
    });
    const data = await r.json();
    const fixtures = (data?.response || []) as any[];
    const nh = norm(home_team);
    const na = norm(away_team);

    let best: { id: number; score: number } | null = null;
    for (const f of fixtures) {
      const h = norm(f?.teams?.home?.name || "");
      const a = norm(f?.teams?.away?.name || "");
      let score = 0;
      if (h === nh) score += 3; else if (h.includes(nh) || nh.includes(h)) score += 1;
      if (a === na) score += 3; else if (a.includes(na) || na.includes(a)) score += 1;
      if (score > 0 && (!best || score > best.score)) {
        best = { id: f?.fixture?.id, score };
      }
    }

    return new Response(JSON.stringify({ fixture_id: best?.id ?? null, total_scanned: fixtures.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
