const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const OISEMONT_CL_NO = 3246;

/** Call FFF API directly (no proxy needed since we're server-side) */
async function callFFFDirect(endpoint: string) {
  const url = `https://api-dofa.fff.fr/api${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'FCO-Manager/1.0' },
  });
  if (!res.ok) throw new Error(`FFF API ${res.status}`);
  return res.json();
}

/** Fetch all upcoming matches month by month */
async function fetchUpcoming(cpNo: number, phase: number, poule: number, clubId = OISEMONT_CL_NO) {
  const mois: { label: string; after: string; before: string }[] = [];
  const now = new Date();
  const fin = new Date(now.getFullYear(), 5, 30);
  if (fin < now) fin.setFullYear(fin.getFullYear() + 1);
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor <= fin) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, cursor.getMonth() + 1, 0).getDate();
    mois.push({
      label: cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      after: `${y}-${m}-01`,
      before: `${y}-${m}-${last}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const results = await Promise.all(
    mois.map(async (m) => {
      try {
        const data = await callFFFDirect(
          `/compets/${cpNo}/phases/${phase}/poules/${poule}/calendrier?ma_dat[after]=${m.after}&ma_dat[before]=${m.before}`
        );
        const members = Array.isArray(data) ? data : data?.['hydra:member'] || [];
        const matchs = members.filter(
          (match: any) => match.home?.club?.cl_no === clubId || match.away?.club?.cl_no === clubId
        );
        return { mois: m.label, matchs };
      } catch { return { mois: m.label, matchs: [] }; }
    })
  );
  return results.filter(r => r.matchs.length > 0);
}

/** Fetch all past results month by month */
async function fetchResults(cpNo: number, phase: number, poule: number, clubId = OISEMONT_CL_NO) {
  const mois: { label: string; after: string; before: string }[] = [];
  const now = new Date();
  const debut = new Date(now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
  const cursor = new Date(debut);
  while (cursor <= now) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, cursor.getMonth() + 1, 0).getDate();
    mois.push({
      label: cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      after: `${y}-${m}-01`,
      before: `${y}-${m}-${last}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const results = await Promise.all(
    mois.map(async (m) => {
      try {
        const data = await callFFFDirect(
          `/compets/${cpNo}/phases/${phase}/poules/${poule}/resultat?ma_dat[after]=${m.after}&ma_dat[before]=${m.before}`
        );
        const members = Array.isArray(data) ? data : data?.['hydra:member'] || [];
        const matchs = members.filter(
          (match: any) => match.home?.club?.cl_no === clubId || match.away?.club?.cl_no === clubId
        );
        return { mois: m.label, matchs };
      } catch { return { mois: m.label, matchs: [] }; }
    })
  );
  return results.filter(r => r.matchs.length > 0).reverse();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const chRes = await fetch(`${supabaseUrl}/rest/v1/championships?fff_url=not.is.null&select=id,name,fff_url`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    });

    if (!chRes.ok) {
      const err = await chRes.text();
      console.error('Failed to fetch championships:', err);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch championships' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const championships: { id: string; name: string; fff_url: string }[] = await chRes.json();
    const apiChampionships = championships.filter(c => c.fff_url?.startsWith('fff-api::'));
    console.log(`Found ${apiChampionships.length} championships with FFF API ref`);

    const results: { id: string; name: string; success: boolean; error?: string }[] = [];

    for (const champ of apiChampionships) {
      try {
        console.log(`Refreshing championship: ${champ.name} (${champ.id})`);

        const parts = champ.fff_url.split('::');
        if (parts.length !== 4) {
          results.push({ id: champ.id, name: champ.name, success: false, error: 'Invalid fff_url format' });
          continue;
        }
        const cpNo = parseInt(parts[1], 10);
        const phase = parseInt(parts[2], 10);
        const poule = parseInt(parts[3], 10);

        // Fetch all data directly from FFF API (no proxy needed server-side)
        const [classementData, resultatsData, calendrierData, upcoming, pastResults] = await Promise.all([
          callFFFDirect(`/compets/${cpNo}/phases/${phase}/poules/${poule}/classement_journees`).catch(() => null),
          callFFFDirect(`/compets/${cpNo}/phases/${phase}/poules/${poule}/resultat`).catch(() => null),
          callFFFDirect(`/compets/${cpNo}/phases/${phase}/poules/${poule}/calendrier`).catch(() => null),
          fetchUpcoming(cpNo, phase, poule).catch(() => []),
          fetchResults(cpNo, phase, poule).catch(() => []),
        ]);

        const updateBody: Record<string, unknown> = {};

        // Process classement for standings
        const members = classementData ? (Array.isArray(classementData) ? classementData : classementData['hydra:member'] || []) : [];

        if (Array.isArray(members) && members.length > 0) {
          const standings = members.map((entry: any, index: number) => ({
            rank: entry.rang ?? entry.rank ?? index + 1,
            team: entry.equipe?.short_name || entry.equipe?.name || entry.club?.name || '',
            clNo: entry.equipe?.club?.cl_no ?? undefined,
            points: entry.point_count ?? entry.pts ?? entry.points ?? 0,
            played: entry.total_games_count ?? entry.mj ?? entry.played ?? 0,
            won: entry.won_games_count ?? entry.g ?? entry.won ?? 0,
            drawn: entry.draw_games_count ?? entry.n ?? entry.drawn ?? 0,
            lost: entry.lost_games_count ?? entry.p ?? entry.lost ?? 0,
            forfeits: entry.f ?? entry.forfaits ?? 0,
            penalties: entry.pen ?? entry.penalties ?? 0,
            goalsFor: entry.goals_for_count ?? entry.bp ?? entry.goals_for ?? 0,
            goalsAgainst: entry.goals_against_count ?? entry.bc ?? entry.goals_against ?? 0,
            goalDiff: entry.goals_diff ?? entry.diff ?? entry.goal_diff ?? 0,
          })).filter((s: any) => s.team);

          if (standings.length > 0) {
            updateBody.fff_standings = standings;
            updateBody.teams = standings.map((s: any) => s.team);
          }

          // Extract logos from classement
          const logos: Record<string, string> = {};
          for (const entry of members) {
            const name = entry.equipe?.short_name || entry.equipe?.name || entry.club?.name || '';
            const logo = entry.equipe?.club?.logo || entry.club?.logo || '';
            if (name && logo) logos[name.toUpperCase()] = logo;
          }

          // Also extract logos from results/calendar
          const extractLogos = (data: any) => {
            const list = Array.isArray(data) ? data : data?.['hydra:member'] || [];
            for (const match of list) {
              if (match.home?.club?.cl_no && match.home?.club?.logo) logos[match.home.club.cl_no] = match.home.club.logo;
              if (match.away?.club?.cl_no && match.away?.club?.logo) logos[match.away.club.cl_no] = match.away.club.logo;
            }
          };
          if (resultatsData) extractLogos(resultatsData);
          if (calendrierData) extractLogos(calendrierData);

          if (Object.keys(logos).length > 0) updateBody.team_logos = logos;
        }

        // Build live cache with all data needed by the client
        const liveCache: Record<string, any> = {};

        // Store raw classement members for client-side mapping
        if (Array.isArray(members) && members.length > 0) {
          liveCache.classement = members;
        }

        // Store upcoming and results (already filtered for Oisemont)
        if (upcoming && (upcoming as any[]).length > 0) liveCache.upcoming = upcoming;
        if (pastResults && (pastResults as any[]).length > 0) liveCache.results = pastResults;

        // Extract cl_no-indexed logos for live display
        const liveLogos: Record<number, string> = {};
        if (Array.isArray(members)) {
          for (const entry of members) {
            const clNo = entry.equipe?.club?.cl_no;
            const logo = entry.equipe?.club?.logo;
            if (clNo && logo) liveLogos[clNo] = logo;
          }
        }
        // Also from match data
        for (const group of [...(upcoming || []), ...(pastResults || [])] as any[]) {
          for (const m of group.matchs || []) {
            if (m.home?.club?.cl_no && m.home?.club?.logo) liveLogos[m.home.club.cl_no] = m.home.club.logo;
            if (m.away?.club?.cl_no && m.away?.club?.logo) liveLogos[m.away.club.cl_no] = m.away.club.logo;
          }
        }
        if (Object.keys(liveLogos).length > 0) liveCache.logos = liveLogos;

        updateBody.fff_live_cache = liveCache;
        updateBody.fff_refreshed_at = new Date().toISOString();

        if (Object.keys(updateBody).length > 0) {
          await fetch(`${supabaseUrl}/rest/v1/championships?id=eq.${champ.id}`, {
            method: 'PATCH',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(updateBody),
          });
        }

        // Process matches for championship_matches table
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

        // ═══ AUTO-SETTLE BETS FROM FFF RESULTS ═══
        // Look at past results and settle any pending bets that match
        if (pastResults && (pastResults as any[]).length > 0) {
          for (const group of pastResults as any[]) {
            for (const m of group.matchs || []) {
              const homeScore = m.home_score ?? m.score_home ?? null;
              const awayScore = m.away_score ?? m.score_away ?? null;
              const homeName = m.home?.short_name || m.home?.name || '';
              const awayName = m.away?.short_name || m.away?.name || '';
              let matchDate = '';
              if (m.date) {
                const d = new Date(m.date);
                if (!isNaN(d.getTime())) matchDate = d.toISOString().split('T')[0];
                else matchDate = m.date;
              }

              // Only settle if we have scores and team names
              if (homeScore !== null && awayScore !== null && homeName && awayName && matchDate) {
                try {
                  // Check if there are pending bets for this match
                  const checkRes = await fetch(
                    `${supabaseUrl}/rest/v1/bets?home_team=eq.${encodeURIComponent(homeName)}&away_team=eq.${encodeURIComponent(awayName)}&match_date=eq.${encodeURIComponent(matchDate)}&status=eq.pending&select=id&limit=1`,
                    { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
                  );
                  const pendingBets = await checkRes.json();

                  if (Array.isArray(pendingBets) && pendingBets.length > 0) {
                    // Call settle_match_bets RPC
                    const settleRes = await fetch(`${supabaseUrl}/rest/v1/rpc/settle_match_bets`, {
                      method: 'POST',
                      headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        p_home_team: homeName,
                        p_away_team: awayName,
                        p_match_date: matchDate,
                        p_home_score: Number(homeScore),
                        p_away_score: Number(awayScore),
                      }),
                    });
                    const settleResult = await settleRes.json();
                    console.log(`Settled bets for ${homeName} vs ${awayName} (${matchDate}):`, settleResult);
                  }
                } catch (settleErr) {
                  console.error(`Error settling bets for ${homeName} vs ${awayName}:`, settleErr);
                }
              }
            }
          }
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
