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
            goalDiff: (entry.goals_for_count ?? entry.bp ?? entry.goals_for ?? 0) - (entry.goals_against_count ?? entry.bc ?? entry.goals_against ?? 0),
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

    return new Response(
      JSON.stringify({
        success: true,
        refreshed: refreshResults.length,
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
