const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const OISEMONT_CL_NO = 3246;
const OISEMONT_AFFILIATION = 508456;

/** Call FFF API directly (no proxy needed since we're server-side) */
async function callFFFDirect(endpoint: string) {
  const url = `https://api-dofa.fff.fr/api${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'FCO-Manager/1.0' },
  });
  if (!res.ok) throw new Error(`FFF API ${res.status}`);
  return res.json();
}

/** Normalize a team name for comparison: uppercase, trim, remove accents */
function normalize(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().trim()
    .replace(/\s+/g, ' ');
}

/** Check if two team names likely refer to the same team */
function teamsMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Check if one contains the other (e.g. "OISEMONT FC" vs "OISEMONT")
  if (na.includes(nb) || nb.includes(na)) return true;
  // Check first word match (e.g. "BLANGY SEP" vs "BLANGY")
  const firstA = na.split(' ')[0];
  const firstB = nb.split(' ')[0];
  if (firstA.length >= 3 && firstA === firstB) return true;
  return false;
}

/** Extract YYYY-MM-DD from various date formats */
function extractDate(dateStr: string): string {
  if (!dateStr) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // ISO with time
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return dateStr;
}

/** Fetch all past results month by month for Oisemont */
async function fetchResults(cpNo: number, phase: number, poule: number, clubId = OISEMONT_CL_NO) {
  const mois: { after: string; before: string }[] = [];
  const now = new Date();
  const debut = new Date(now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
  const cursor = new Date(debut);
  while (cursor <= now) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, cursor.getMonth() + 1, 0).getDate();
    mois.push({ after: `${y}-${m}-01`, before: `${y}-${m}-${last}` });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const allMatches: any[] = [];
  await Promise.all(
    mois.map(async (m) => {
      try {
        const data = await callFFFDirect(
          `/compets/${cpNo}/phases/${phase}/poules/${poule}/resultat?ma_dat[after]=${m.after}&ma_dat[before]=${m.before}`
        );
        const members = Array.isArray(data) ? data : data?.['hydra:member'] || [];
        const matchs = members.filter(
          (match: any) => match.home?.club?.cl_no === clubId || match.away?.club?.cl_no === clubId
        );
        allMatches.push(...matchs);
      } catch {}
    })
  );
  return allMatches;
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

/** Get all Oisemont equipes to discover competitions */
async function getOisemontCompetitions(): Promise<{ cpNo: number; phase: number; poule: number; name: string }[]> {
  try {
    const data = await callFFFDirect(`/clubs/${OISEMONT_CL_NO}/equipes`);
    const equipes = Array.isArray(data) ? data : data?.['hydra:member'] || data?.equipes || [];
    const comps: { cpNo: number; phase: number; poule: number; name: string }[] = [];
    const seen = new Set<string>();
    for (const eq of equipes) {
      const engagements = eq.engagements || [];
      for (const eng of engagements) {
        const competition = eng.competition || eng.compet || {};
        const cpNo = competition.cp_no || competition.id;
        const phase = eng.phase?.nu || eng.ph_no || 1;
        const poule = eng.poule?.nu || eng.po_no || 1;
        if (cpNo && !seen.has(`${cpNo}-${phase}-${poule}`)) {
          seen.add(`${cpNo}-${phase}-${poule}`);
          comps.push({ cpNo, phase, poule, name: competition.name || competition.cp_nom || `Competition ${cpNo}` });
        }
      }
    }
    return comps;
  } catch (err) {
    console.error('Failed to get Oisemont competitions:', err);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

    // ═══════════════════════════════════════════════════════════
    // STEP 1: Refresh championships from DB (existing logic)
    // ═══════════════════════════════════════════════════════════
    const chRes = await fetch(`${supabaseUrl}/rest/v1/championships?fff_url=not.is.null&select=id,name,fff_url,team`, {
      headers,
    });
    const dbText = await chRes.text();
    let championships: { id: string; name: string; fff_url: string; team: string }[] = [];
    try { championships = JSON.parse(dbText); } catch {}
    const apiChampionships = championships.filter(c => c.fff_url?.startsWith('fff-api::'));
    console.log(`Found ${apiChampionships.length} championships in DB`);

    const refreshResults: any[] = [];

    for (const champ of apiChampionships) {
      try {
        const parts = champ.fff_url.split('::');
        if (parts.length !== 4) continue;
        const cpNo = parseInt(parts[1], 10);
        const phase = parseInt(parts[2], 10);
        const poule = parseInt(parts[3], 10);

        const [classementData, resultatsData, calendrierData, upcoming, pastResults] = await Promise.all([
          callFFFDirect(`/compets/${cpNo}/phases/${phase}/poules/${poule}/classement_journees`).catch(() => null),
          callFFFDirect(`/compets/${cpNo}/phases/${phase}/poules/${poule}/resultat`).catch(() => null),
          callFFFDirect(`/compets/${cpNo}/phases/${phase}/poules/${poule}/calendrier`).catch(() => null),
          fetchUpcoming(cpNo, phase, poule).catch(() => []),
          fetchResults(cpNo, phase, poule).catch(() => []),
        ]);

        const updateBody: Record<string, unknown> = {};
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
          const logos: Record<string, string> = {};
          for (const entry of members) {
            const name = entry.equipe?.short_name || entry.equipe?.name || entry.club?.name || '';
            const logo = entry.equipe?.club?.logo || entry.club?.logo || '';
            if (name && logo) logos[name.toUpperCase()] = logo;
          }
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

        // Build live cache
        const liveCache: Record<string, any> = {};
        if (Array.isArray(members) && members.length > 0) liveCache.classement = members;
        if (upcoming && (upcoming as any[]).length > 0) liveCache.upcoming = upcoming;
        if (pastResults && pastResults.length > 0) liveCache.results = pastResults.map((m: any) => ({
          mois: '', matchs: [m],
        }));

        const liveLogos: Record<number, string> = {};
        if (Array.isArray(members)) {
          for (const entry of members) {
            const clNo = entry.equipe?.club?.cl_no;
            const logo = entry.equipe?.club?.logo;
            if (clNo && logo) liveLogos[clNo] = logo;
          }
        }
        if (Object.keys(liveLogos).length > 0) liveCache.logos = liveLogos;

        updateBody.fff_live_cache = liveCache;
        updateBody.fff_refreshed_at = new Date().toISOString();

        if (Object.keys(updateBody).length > 0) {
          await fetch(`${supabaseUrl}/rest/v1/championships?id=eq.${champ.id}`, {
            method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify(updateBody),
          });
        }

        refreshResults.push({ id: champ.id, name: champ.name, success: true });
      } catch (err) {
        console.error(`Error refreshing ${champ.name}:`, err);
        refreshResults.push({ id: champ.id, name: champ.name, success: false, error: String(err) });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 2: AUTO-SETTLE BETS — works even without championships in DB
    // ═══════════════════════════════════════════════════════════
    console.log('=== Starting auto-settle for pending bets ===');

    // 2a. Get all pending bets
    const betsRes = await fetch(
      `${supabaseUrl}/rest/v1/bets?status=eq.pending&select=id,home_team,away_team,match_date`,
      { headers }
    );
    const betsText = await betsRes.text();
    let pendingBets: { id: string; home_team: string; away_team: string; match_date: string }[] = [];
    try { pendingBets = JSON.parse(betsText); } catch {}

    if (!Array.isArray(pendingBets) || pendingBets.length === 0) {
      console.log('No pending bets to settle');
      return new Response(
        JSON.stringify({ success: true, refreshed: refreshResults.length, settled: 0, refreshResults }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2b. Get unique matches from pending bets
    const uniqueMatches = new Map<string, { home: string; away: string; date: string }>();
    for (const bet of pendingBets) {
      const dateKey = extractDate(bet.match_date);
      const key = `${bet.home_team}||${bet.away_team}||${dateKey}`;
      if (!uniqueMatches.has(key)) {
        uniqueMatches.set(key, { home: bet.home_team, away: bet.away_team, date: dateKey });
      }
    }
    console.log(`Found ${pendingBets.length} pending bets across ${uniqueMatches.size} unique matches`);

    // 2c. Discover all Oisemont competitions and fetch results
    let allFFFResults: any[] = [];

    // First try from DB championships
    for (const champ of apiChampionships) {
      try {
        const parts = champ.fff_url.split('::');
        const cpNo = parseInt(parts[1], 10);
        const phase = parseInt(parts[2], 10);
        const poule = parseInt(parts[3], 10);
        const results = await fetchResults(cpNo, phase, poule);
        allFFFResults.push(...results);
      } catch {}
    }

    // If no DB championships, discover from FFF API
    if (apiChampionships.length === 0) {
      console.log('No championships in DB, discovering from FFF API...');
      const competitions = await getOisemontCompetitions();
      console.log(`Discovered ${competitions.length} competitions from FFF`);
      for (const comp of competitions) {
        try {
          const results = await fetchResults(comp.cpNo, comp.phase, comp.poule);
          allFFFResults.push(...results);
          console.log(`Fetched ${results.length} results for ${comp.name}`);
        } catch (err) {
          console.error(`Failed to fetch results for ${comp.name}:`, err);
        }
      }
    }

    console.log(`Total FFF results fetched: ${allFFFResults.length}`);

    // 2d. For each unique bet match, try to find a matching FFF result
    let totalSettled = 0;
    for (const [_key, match] of uniqueMatches) {
      const betDateNorm = extractDate(match.date);

      for (const fffMatch of allFFFResults) {
        const fffHome = fffMatch.home?.short_name || fffMatch.home?.name || '';
        const fffAway = fffMatch.away?.short_name || fffMatch.away?.name || '';
        const fffDate = extractDate(fffMatch.date || fffMatch.ma_dat || '');
        const fffHomeScore = fffMatch.home_score ?? fffMatch.score_home ?? null;
        const fffAwayScore = fffMatch.away_score ?? fffMatch.score_away ?? null;

        // Skip if no scores
        if (fffHomeScore === null || fffAwayScore === null) continue;

        // Check date match
        if (betDateNorm !== fffDate) continue;

        // Check team names match (flexible)
        const homeMatch = teamsMatch(match.home, fffHome);
        const awayMatch = teamsMatch(match.away, fffAway);

        if (homeMatch && awayMatch) {
          console.log(`Match found: ${match.home} vs ${match.away} (${betDateNorm}) → ${fffHomeScore}-${fffAwayScore}`);

          // Use the EXACT bet team names and match_date for settlement
          // The settle function matches on exact strings
          try {
            const settleRes = await fetch(`${supabaseUrl}/rest/v1/rpc/settle_match_bets`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                p_home_team: match.home,
                p_away_team: match.away,
                p_match_date: match.date, // Use original bet match_date format
                p_home_score: Number(fffHomeScore),
                p_away_score: Number(fffAwayScore),
              }),
            });
            const settleResult = await settleRes.json();
            console.log(`Settled:`, settleResult);
            totalSettled += settleResult?.settled || 0;
          } catch (err) {
            console.error(`Error settling ${match.home} vs ${match.away}:`, err);
          }

          // Also try with the raw match_date from bets (in case format differs)
          // Find all distinct match_date formats for this match in bets
          const distinctDates = [...new Set(
            pendingBets
              .filter(b => b.home_team === match.home && b.away_team === match.away)
              .map(b => b.match_date)
          )];

          for (const betDate of distinctDates) {
            if (betDate === match.date) continue; // already tried
            try {
              const settleRes2 = await fetch(`${supabaseUrl}/rest/v1/rpc/settle_match_bets`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  p_home_team: match.home,
                  p_away_team: match.away,
                  p_match_date: betDate,
                  p_home_score: Number(fffHomeScore),
                  p_away_score: Number(fffAwayScore),
                }),
              });
              const settleResult2 = await settleRes2.json();
              if (settleResult2?.settled > 0) {
                console.log(`Settled with alt date ${betDate}:`, settleResult2);
                totalSettled += settleResult2.settled;
              }
            } catch {}
          }

          break; // Found the match, stop searching
        }
      }
    }

    console.log(`=== Auto-settle complete: ${totalSettled} bets settled ===`);

    return new Response(
      JSON.stringify({
        success: true,
        refreshed: refreshResults.length,
        settled: totalSettled,
        pendingBetsChecked: pendingBets.length,
        fffResultsFetched: allFFFResults.length,
        refreshResults,
      }),
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
