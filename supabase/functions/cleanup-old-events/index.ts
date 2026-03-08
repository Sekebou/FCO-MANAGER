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

    // Current time in Europe/Paris
    const parisNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const todayStr = parisNow.toISOString().split('T')[0];

    // Fetch all match/training events up to today
    const eventsRes = await fetch(
      `${supabaseUrl}/rest/v1/events?date=lte.${todayStr}&type=in.(match,training)&select=id,type,date,presences,time,duration`,
      { headers }
    );
    if (!eventsRes.ok) throw new Error(`Failed to fetch events: ${await eventsRes.text()}`);
    const events = await eventsRes.json();

    // Determine which events are terminated
    const terminatedEvents = events.filter((e: any) => {
      if (e.date < todayStr) return true; // past days → always terminated
      // Today: check if event end time has passed
      if (!e.time) {
        // No time set → consider terminated after default duration from start of day
        const duration = (e.duration || 90) * 60 * 1000;
        const dayStart = new Date(parisNow);
        dayStart.setHours(0, 0, 0, 0);
        return parisNow.getTime() > dayStart.getTime() + duration;
      }
      const [h, m] = e.time.replace('H', ':').replace('h', ':').split(':').map(Number);
      const eventStart = new Date(parisNow);
      eventStart.setHours(h || 0, m || 0, 0, 0);
      const duration = (e.duration || 90) * 60 * 1000;
      return parisNow.getTime() > eventStart.getTime() + duration;
    });

    if (terminatedEvents.length === 0) {
      return new Response(JSON.stringify({ success: true, deleted: 0, archived: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Archive presences into attendance_records
    const attendanceRecords: any[] = [];
    for (const event of terminatedEvents) {
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
      const existingRes = await fetch(
        `${supabaseUrl}/rest/v1/attendance_records?event_id=in.(${terminatedEvents.map((e: any) => e.id).join(',')})&select=event_id,player_id`,
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

    // Delete terminated events
    const eventIds = terminatedEvents.map((e: any) => e.id);
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
