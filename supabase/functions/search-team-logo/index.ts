import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const API_KEY = Deno.env.get("API_FOOTBALL_KEY");
    if (!API_KEY) throw new Error("API_FOOTBALL_KEY not configured");

    const { search } = await req.json();
    if (!search || typeof search !== "string" || search.trim().length < 2) {
      return new Response(JSON.stringify({ teams: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(search.trim())}`;
    const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
    const data = await res.json();
    console.log("search-team-logo:", JSON.stringify({ q: search, results: data?.results, errors: data?.errors }));

    const teams = (data?.response ?? []).slice(0, 10).map((t: any) => ({
      id: t.team?.id,
      name: t.team?.name,
      country: t.team?.country,
      logo: t.team?.logo,
    }));

    return new Response(JSON.stringify({ teams }), {
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
