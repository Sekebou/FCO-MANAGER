import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const API_KEY = Deno.env.get("API_FOOTBALL_KEY")!;
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { fixture_id, channel_id } = await req.json();
    if (!fixture_id) {
      return new Response(JSON.stringify({ error: "fixture_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const r = await fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixture_id}`, {
      headers: { "x-apisports-key": API_KEY },
    });
    const data = await r.json();
    const teams = (data?.response || []) as any[];
    const players: { name: string; team: string; number?: number }[] = [];
    for (const t of teams) {
      const teamName = t?.team?.name || "";
      for (const p of (t?.startXI || [])) {
        if (p?.player?.name) players.push({ name: p.player.name, team: teamName, number: p.player.number });
      }
      for (const p of (t?.substitutes || [])) {
        if (p?.player?.name) players.push({ name: p.player.name, team: teamName, number: p.player.number });
      }
    }

    if (channel_id && players.length > 0) {
      const sb = createClient(SUPA_URL, SERVICE_KEY);
      await sb.from("tv_channels").update({
        lineup_cache: players,
        lineup_refreshed_at: new Date().toISOString(),
      }).eq("id", channel_id);
    }

    return new Response(JSON.stringify({ players, count: players.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
