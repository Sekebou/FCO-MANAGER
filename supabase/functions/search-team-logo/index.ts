import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// ESPN public search API — free, no key, returns logos for any soccer team worldwide.
// Endpoint: https://site.web.api.espn.com/apis/common/v3/search?query=...&type=team&sport=soccer

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
    const url = `https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(q)}&limit=20&type=team&sport=soccer`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await res.json();

    const items = (data?.items ?? []) as any[];
    const teams = items
      .filter((t) => t?.sport === "soccer" && Array.isArray(t.logos) && t.logos.length > 0)
      .slice(0, 15)
      .map((t) => {
        const logo = t.logos.find((l: any) => (l.rel || []).includes("default"))?.href || t.logos[0]?.href || "";
        // Country guess from league slug (e.g. "fra.1" -> "fra")
        const country = (t.league || "").split(".")[0]?.toUpperCase() || "";
        return {
          id: Number(t.id) || 0,
          name: t.displayName || t.name || "",
          country,
          logo,
        };
      })
      .filter((t) => t.logo && t.name);

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
