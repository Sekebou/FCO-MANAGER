import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");

    // Verify the caller
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Non autorisé");

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get profile info for audit log
    const { data: profile } = await adminClient
      .from("profiles")
      .select("player_id, name, email, role")
      .eq("id", userId)
      .single();

    const playerId = profile?.player_id;

    // 1. Delete cards linked to player
    if (playerId) {
      await adminClient.from("cards").delete().eq("player_id", playerId);
    }

    // 2. Delete attendance records linked to player
    if (playerId) {
      await adminClient.from("attendance_records").delete().eq("player_id", playerId);
    }

    // 3. Clean presences/convocations from events (remove player from JSONB)
    if (playerId) {
      const { data: events } = await adminClient.from("events").select("id, presences, convocations, absence_reasons");
      if (events) {
        for (const evt of events) {
          const presences = evt.presences as Record<string, unknown> || {};
          const convocations = evt.convocations as Record<string, unknown> || {};
          const absenceReasons = evt.absence_reasons as Record<string, unknown> || {};
          const pid = playerId;
          if (presences[pid] !== undefined || convocations[pid] !== undefined || absenceReasons[pid] !== undefined) {
            delete presences[pid];
            delete convocations[pid];
            delete absenceReasons[pid];
            await adminClient.from("events").update({ presences, convocations, absence_reasons: absenceReasons }).eq("id", evt.id);
          }
        }
      }
    }

    // 4. Delete bets & points
    await adminClient.from("bets").delete().eq("user_id", userId);
    await adminClient.from("points_transactions").delete().eq("user_id", userId);
    await adminClient.from("user_points").delete().eq("user_id", userId);

    // 5. Delete chat messages
    await adminClient.from("chat_messages").delete().eq("user_id", userId);

    // 6. Delete conversation messages & clean conversations
    await adminClient.from("conversation_messages").delete().eq("sender_id", userId);
    const { data: convos } = await adminClient.from("conversations").select("id, participants").contains("participants", [userId]);
    if (convos) {
      for (const c of convos) {
        const remaining = (c.participants as string[]).filter((p: string) => p !== userId);
        if (remaining.length < 2) {
          await adminClient.from("conversation_messages").delete().eq("conversation_id", c.id);
          await adminClient.from("conversations").delete().eq("id", c.id);
        } else {
          await adminClient.from("conversations").update({ participants: remaining }).eq("id", c.id);
        }
      }
    }

    // 7. Delete news comments & photo comments
    await adminClient.from("news_comments").delete().eq("author_uid", userId);
    await adminClient.from("photo_comments").delete().eq("author_uid", userId);

    // 8. Delete FCM tokens & session
    await adminClient.from("fcm_tokens").delete().eq("user_id", userId);
    await adminClient.from("user_sessions").delete().eq("user_id", userId);

    // 9. Delete user_roles
    await adminClient.from("user_roles").delete().eq("user_id", userId);

    // 10. Delete profile
    await adminClient.from("profiles").delete().eq("id", userId);

    // 11. Delete player record
    if (playerId) {
      await adminClient.from("players").delete().eq("id", playerId);
    }

    // Audit log (before deleting auth user)
    await adminClient.from("audit_logs").insert({
      action: "self_delete_account",
      target_name: profile?.name || "Inconnu",
      target_email: profile?.email || null,
      target_role: profile?.role || null,
      performed_by: userId,
      performed_by_name: profile?.name || "Inconnu",
      details: { player_id: playerId || null, self_deletion: true },
    });

    // 12. Delete auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
