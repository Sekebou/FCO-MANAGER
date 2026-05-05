import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// TheSportsDB — free, no key required (public key "3" works for basic search)
// Endpoint: https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=PSG

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { search } = await req.json();
    if (!search || typeof search !== "string" || search.trim().length < 2) {
      return new Response(JSON.stringify({ teams: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const q = search.trim();
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    const data = await res.json();

    const teams = (data?.teams ?? [])
      .filter((t: any) => (t?.strSport || "").toLowerCase() === "soccer")
      .slice(0, 12)
      .map((t: any, i: number) => ({
        id: Number(t.idTeam) || i,
        name: t.strTeam,
        country: t.strCountry || "",
        logo: t.strBadge || t.strLogo || t.strTeamBadge || "",
      }))
      .filter((t: any) => t.logo);

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
