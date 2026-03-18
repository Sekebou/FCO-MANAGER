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
      `${supabaseUrl}/rest/v1/events?date=lte.${todayStr}&type=in.(match,training)&select=id,type,date,presences,time,duration,title,home_logo,away_logo`,
      { headers }
    );
    if (!eventsRes.ok) throw new Error(`Failed to fetch events: ${await eventsRes.text()}`);
    const events = await eventsRes.json();

    // Determine which events are terminated
    const terminatedEvents = events.filter((e: any) => {
      if (e.date < todayStr) return true;
      if (!e.time) {
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
      return new Response(JSON.stringify({ success: true, deleted: 0, archived: 0, scoresUpdated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Archive presences into attendance_records for ALL terminated events
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

    // ── Auto-fetch scores from FFF API for terminated match events ──
    let scoresUpdated = 0;
    const terminatedMatchEvents = terminatedEvents.filter((e: any) => e.type === 'match');

    if (terminatedMatchEvents.length > 0) {
      const eventIds = terminatedMatchEvents.map((e: any) => e.id);
      const msRes = await fetch(
        `${supabaseUrl}/rest/v1/match_sheets?event_id=in.(${eventIds.join(',')})&select=id,event_id,home_team,away_team,home_score,away_score,date`,
        { headers }
      );
      const matchSheets = msRes.ok ? await msRes.json() : [];
      const sheetsNeedingScores = matchSheets.filter((ms: any) => ms.home_score == null || ms.away_score == null);

      if (sheetsNeedingScores.length > 0) {
        const champRes = await fetch(
          `${supabaseUrl}/rest/v1/championships?fff_url=not.is.null&select=id,fff_url,team`,
          { headers }
        );
        const championships = champRes.ok ? await champRes.json() : [];

        const allFffResults: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; date: string }[] = [];

        for (const champ of championships) {
          if (!champ.fff_url?.startsWith('fff-api::')) continue;
          const parts = champ.fff_url.split('::');
          if (parts.length !== 4) continue;
          const cpNo = parts[1];
          const phase = parts[2];
          const poule = parts[3];

          try {
            const fffUrl = `https://api-dofa.fff.fr/api/compets/${cpNo}/phases/${phase}/poules/${poule}/resultat`;
            const fffRes = await fetch(fffUrl, {
              headers: { 'Accept': 'application/json', 'User-Agent': 'FCO-Manager/1.0' },
            });
            if (fffRes.ok) {
              const fffData = await fffRes.json();
              const members = Array.isArray(fffData) ? fffData : fffData?.['hydra:member'] || [];
              for (const m of members) {
                if (m.home_score != null && m.away_score != null) {
                  const homeName = m.home?.short_name || m.home?.name || '';
                  const awayName = m.away?.short_name || m.away?.name || '';
                  let date = '';
                  if (m.date) {
                    const d = new Date(m.date);
                    date = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : m.date;
                  }
                  allFffResults.push({
                    homeTeam: homeName,
                    awayTeam: awayName,
                    homeScore: Number(m.home_score),
                    awayScore: Number(m.away_score),
                    date,
                  });
                }
              }
            }
          } catch (e) {
            console.error(`Failed to fetch FFF results for champ ${champ.id}:`, e);
          }
        }

        for (const ms of sheetsNeedingScores) {
          const home = (ms.home_team || '').toUpperCase().trim();
          const away = (ms.away_team || '').toUpperCase().trim();
          if (!home || !away) continue;

          const match = allFffResults.find(r => {
            const rHome = r.homeTeam.toUpperCase().trim();
            const rAway = r.awayTeam.toUpperCase().trim();
            return (
              ((rHome === home && rAway === away) || (rHome === away && rAway === home)) &&
              r.date === ms.date
            );
          });

          if (match) {
            const rHome = match.homeTeam.toUpperCase().trim();
            const isSwapped = rHome !== home;
            const finalHomeScore = isSwapped ? match.awayScore : match.homeScore;
            const finalAwayScore = isSwapped ? match.homeScore : match.awayScore;

            const updateRes = await fetch(
              `${supabaseUrl}/rest/v1/match_sheets?id=eq.${ms.id}`,
              {
                method: 'PATCH',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ home_score: finalHomeScore, away_score: finalAwayScore }),
              }
            );
            if (updateRes.ok) scoresUpdated++;
          }
        }
      }
    }

    // Events are NO LONGER deleted — they stay in the DB and are hidden in the UI.
    // Match sheets are still created separately for match archiving.

    console.log(`Cleanup: archived ${attendanceRecords.length} presences from ${terminatedEvents.length} terminated events, updated ${scoresUpdated} scores`);

    return new Response(
      JSON.stringify({ success: true, deleted: 0, archived: attendanceRecords.length, scoresUpdated }),
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
