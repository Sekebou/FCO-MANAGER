const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Fetch all championships with a fff_url starting with "fff-api::"
    const chRes = await fetch(`${supabaseUrl}/rest/v1/championships?fff_url=not.is.null&select=id,name,fff_url`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!chRes.ok) {
      const err = await chRes.text();
      console.error('Failed to fetch championships:', err);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch championships' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const championships: { id: string; name: string; fff_url: string }[] = await chRes.json();
    const apiChampionships = championships.filter(c => c.fff_url?.startsWith('fff-api::'));
    console.log(`Found ${apiChampionships.length} championships with FFF API ref`);

    const results: { id: string; name: string; success: boolean; error?: string }[] = [];

    for (const champ of apiChampionships) {
      try {
        console.log(`Refreshing championship: ${champ.name} (${champ.id})`);

        // Parse fff_url: "fff-api::{cpNo}::{phase}::{poule}"
        const parts = champ.fff_url.split('::');
        if (parts.length !== 4) {
          results.push({ id: champ.id, name: champ.name, success: false, error: 'Invalid fff_url format' });
          continue;
        }
        const cpNo = parseInt(parts[1], 10);
        const phase = parseInt(parts[2], 10);
        const poule = parseInt(parts[3], 10);

        // Call FFF API via fff-proxy
        const proxyUrl = `${supabaseUrl}/functions/v1/fff-proxy`;

        const [classementRes, resultatsRes, calendrierRes] = await Promise.all([
          fetch(proxyUrl, {
            method: 'POST',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: `/compets/${cpNo}/phases/${phase}/poules/${poule}/classement_journees` }),
          }).catch(() => null),
          fetch(proxyUrl, {
            method: 'POST',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: `/compets/${cpNo}/phases/${phase}/poules/${poule}/resultat` }),
          }).catch(() => null),
          fetch(proxyUrl, {
            method: 'POST',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: `/compets/${cpNo}/phases/${phase}/poules/${poule}/calendrier` }),
          }).catch(() => null),
        ]);

        const classementData = classementRes?.ok ? await classementRes.json() : null;
        const resultatsData = resultatsRes?.ok ? await resultatsRes.json() : null;
        const calendrierData = calendrierRes?.ok ? await calendrierRes.json() : null;

        // Process standings
        const updateBody: Record<string, unknown> = {};
        
        if (classementData) {
          // Extract standings from the latest journee
          const journees = Array.isArray(classementData) ? classementData : classementData.journees || [];
          if (journees.length > 0) {
            const latestJournee = journees[journees.length - 1];
            const classement = latestJournee?.classement_journee || latestJournee?.classement || latestJournee;
            if (Array.isArray(classement)) {
              const standings = classement.map((entry: any, index: number) => ({
                rank: entry.rank || entry.rang || index + 1,
                team: entry.equipe?.short_name || entry.equipe?.name || entry.club?.name || '',
                points: entry.pts ?? entry.points ?? 0,
                played: entry.mj ?? entry.played ?? entry.j ?? 0,
                won: entry.g ?? entry.won ?? entry.victoires ?? 0,
                drawn: entry.n ?? entry.drawn ?? entry.nuls ?? 0,
                lost: entry.p ?? entry.lost ?? entry.defaites ?? 0,
                forfeits: entry.f ?? entry.forfaits ?? 0,
                penalties: entry.pen ?? entry.penalties ?? 0,
                goalsFor: entry.bp ?? entry.goals_for ?? entry.buts_pour ?? 0,
                goalsAgainst: entry.bc ?? entry.goals_against ?? entry.buts_contre ?? 0,
                goalDiff: entry.diff ?? entry.goal_diff ?? (entry.bp ?? 0) - (entry.bc ?? 0),
              })).filter((s: any) => s.team);

              if (standings.length > 0) {
                updateBody.fff_standings = standings;
                updateBody.teams = standings.map((s: any) => s.team);
                
                // Extract logos
                const logos: Record<string, string> = {};
                for (const entry of classement) {
                  const name = entry.equipe?.short_name || entry.equipe?.name || entry.club?.name || '';
                  const logo = entry.equipe?.club?.logo || entry.club?.logo || '';
                  if (name && logo) logos[name.toUpperCase()] = logo;
                }
                if (Object.keys(logos).length > 0) updateBody.team_logos = logos;
              }
            }
          }
        }

        if (Object.keys(updateBody).length > 0) {
          await fetch(`${supabaseUrl}/rest/v1/championships?id=eq.${champ.id}`, {
            method: 'PATCH',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(updateBody),
          });
        }

        // Process matches
        const parseMatches = (data: any) => {
          if (!data) return [];
          const list = Array.isArray(data) ? data : data.results || data.matchs || data.calendrier || [];
          if (!Array.isArray(list)) return [];
          return list.map((m: any) => {
            const homeTeam = m.home?.short_name || m.home?.name || m.dom?.short_name || m.dom?.name || '';
            const awayTeam = m.away?.short_name || m.away?.name || m.ext?.short_name || m.ext?.name || '';
            const homeScore = m.home_score ?? m.score_home ?? m.dom_score ?? null;
            const awayScore = m.away_score ?? m.score_away ?? m.ext_score ?? null;
            let date = '';
            if (m.date) {
              const d = new Date(m.date);
              if (!isNaN(d.getTime())) date = d.toISOString().split('T')[0];
              else date = m.date;
            }
            const journee = m.journee?.number || m.journee?.numero || m.journee || 1;
            return {
              home_team: homeTeam, away_team: awayTeam,
              home_score: homeScore !== null ? Number(homeScore) : null,
              away_score: awayScore !== null ? Number(awayScore) : null,
              date, journee: typeof journee === 'number' ? journee : parseInt(journee, 10) || 1,
              played: homeScore !== null && awayScore !== null,
              championship_id: champ.id,
            };
          }).filter((m: any) => m.home_team && m.away_team);
        };

        const resultMatches = parseMatches(resultatsData);
        const calendarMatches = parseMatches(calendrierData);
        const allMatches = [...resultMatches];
        const seen = new Set(resultMatches.map((m: any) => `${m.home_team}-${m.away_team}-${m.date}`));
        for (const m of calendarMatches) {
          const key = `${m.home_team}-${m.away_team}-${m.date}`;
          if (!seen.has(key)) { allMatches.push(m); seen.add(key); }
        }

        if (allMatches.length > 0) {
          await fetch(`${supabaseUrl}/rest/v1/championship_matches?championship_id=eq.${champ.id}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
          });

          await fetch(`${supabaseUrl}/rest/v1/championship_matches`, {
            method: 'POST',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(allMatches),
          });
        }

        console.log(`Successfully refreshed: ${champ.name}`);
        results.push({ id: champ.id, name: champ.name, success: true });
      } catch (err) {
        console.error(`Error refreshing ${champ.name}:`, err);
        results.push({ id: champ.id, name: champ.name, success: false, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, refreshed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-refresh-championships:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
