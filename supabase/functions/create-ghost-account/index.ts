import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const email = body.email || `fantome${Date.now()}@fco-manager.fr`;
    const password = body.password || crypto.randomUUID().slice(0, 12) + "Aa1!";
    const name = body.name || "Joueur Fantôme";

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "joueur" },
    });
    if (error) throw error;

    const uid = created.user!.id;

    // Insert player
    const { data: player, error: pErr } = await admin
      .from("players")
      .insert({ name, position: "Attaquant" })
      .select("id")
      .single();
    if (pErr) throw pErr;

    // Insert profile (mark as ghost)
    const { error: profErr } = await admin.from("profiles").insert({
      id: uid,
      email,
      name,
      role: "joueur",
      username: email.split("@")[0],
      player_id: player.id,
      is_ghost: true,
    });
    if (profErr) throw profErr;

    return new Response(JSON.stringify({ email, password, user_id: uid, player_id: player.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
