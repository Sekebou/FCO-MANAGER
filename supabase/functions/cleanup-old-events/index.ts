const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    // Calculate 48h ago date string (events.date is stored as text YYYY-MM-DD)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const cutoffDate = cutoff.toISOString().split('T')[0];

    // 1. Find old events (match or training) with date < cutoff
    const eventsRes = await fetch(
      `${supabaseUrl}/rest/v1/events?date=lt.${cutoffDate}&type=in.(match,training)&select=id,type,date,presences`,
      { headers }
    );
    if (!eventsRes.ok) throw new Error(`Failed to fetch events: ${await eventsRes.text()}`);
    const oldEvents = await eventsRes.json();

    if (oldEvents.length === 0) {
      return new Response(JSON.stringify({ success: true, deleted: 0, archived: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Archive presences into attendance_records (if not already there)
    const attendanceRecords: any[] = [];
    for (const event of oldEvents) {
      const presences = event.presences || {};
      for (const [playerId, status] of Object.entries(presences)) {
        if (status && typeof status === 'string') {
          attendanceRecords.push({
            event_id: event.id,
            event_type: event.type,
            event_date: event.date,
            player_id: playerId,
            status,
          });
        }
      }
    }

    if (attendanceRecords.length > 0) {
      // Use upsert-like approach: insert ignoring duplicates by checking existing
      const existingRes = await fetch(
        `${supabaseUrl}/rest/v1/attendance_records?event_id=in.(${oldEvents.map((e: any) => e.id).join(',')})&select=event_id,player_id`,
        { headers }
      );
      const existing = existingRes.ok ? await existingRes.json() : [];
      const existingSet = new Set(existing.map((r: any) => `${r.event_id}_${r.player_id}`));
      const newRecords = attendanceRecords.filter(r => !existingSet.has(`${r.event_id}_${r.player_id}`));

      if (newRecords.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/attendance_records`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify(newRecords),
        });
      }
    }

    // 3. Delete old events
    const eventIds = oldEvents.map((e: any) => e.id);
    await fetch(
      `${supabaseUrl}/rest/v1/events?id=in.(${eventIds.join(',')})`,
      { method: 'DELETE', headers }
    );

    console.log(`Cleanup: archived ${attendanceRecords.length} presences, deleted ${eventIds.length} events`);

    return new Response(
      JSON.stringify({ success: true, deleted: eventIds.length, archived: attendanceRecords.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
