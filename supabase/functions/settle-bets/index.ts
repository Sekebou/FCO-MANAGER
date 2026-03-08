import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OISEMONT_CL_NO = 3246;
const FFF_API_BASE = 'https://api-dofa.fff.fr/api';

async function callFFF(endpoint: string): Promise<any> {
  const url = `${FFF_API_BASE}${endpoint}`;
  console.log('Fetching FFF:', url);
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'FCO-Manager/1.0' },
  });
  if (!res.ok) throw new Error(`FFF API ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Get all unique pending bet matches
    const { data: pendingBets, error: betsError } = await supabase
      .from('bets')
      .select('home_team, away_team, match_date')
      .eq('status', 'pending');

    if (betsError) throw betsError;
    if (!pendingBets || pendingBets.length === 0) {
      console.log('No pending bets to settle');
      return new Response(
        JSON.stringify({ settled: 0, message: 'No pending bets' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate matches
    const uniqueMatches = new Map<string, { home_team: string; away_team: string; match_date: string }>();
    for (const bet of pendingBets) {
      const key = `${bet.home_team}|${bet.away_team}|${bet.match_date}`;
      if (!uniqueMatches.has(key)) {
        uniqueMatches.set(key, bet);
      }
    }

    console.log(`Found ${uniqueMatches.size} unique matches with pending bets`);

    // 2. Get all championships to know which competitions to check
    const { data: championships } = await supabase
      .from('championships')
      .select('fff_url');

    if (!championships || championships.length === 0) {
      console.log('No championships configured');
      return new Response(
        JSON.stringify({ settled: 0, message: 'No championships' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Fetch results from all championships
    const allResults: Array<{ homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; date: string }> = [];

    for (const champ of championships) {
      if (!champ.fff_url?.startsWith('fff-api::')) continue;
      const parts = champ.fff_url.split('::');
      if (parts.length !== 4) continue;
      const [, cpNo, phase, poule] = parts;

      try {
        const data = await callFFF(`/compets/${cpNo}/phases/${phase}/poules/${poule}/resultat`);
        const members = Array.isArray(data) ? data : data?.['hydra:member'] || [];

        for (const m of members) {
          const homeScore = m.home_score ?? m.score_home ?? null;
          const awayScore = m.away_score ?? m.score_away ?? null;
          if (homeScore === null || awayScore === null) continue;

          const homeTeam = m.home?.short_name || m.home?.name || '';
          const awayTeam = m.away?.short_name || m.away?.name || '';
          let date = '';
          if (m.date) {
            const d = new Date(m.date);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().split('T')[0];
            } else {
              date = m.date;
            }
          }

          if (homeTeam && awayTeam && date) {
            allResults.push({
              homeTeam,
              awayTeam,
              homeScore: Number(homeScore),
              awayScore: Number(awayScore),
              date,
            });
          }
        }
      } catch (e) {
        console.error(`Error fetching results for ${champ.fff_url}:`, e);
      }
    }

    console.log(`Fetched ${allResults.length} completed match results from FFF`);

    // 4. Match pending bets with FFF results and settle
    let totalSettled = 0;

    for (const [, match] of uniqueMatches) {
      // Find matching FFF result
      const result = allResults.find(r =>
        r.homeTeam === match.home_team &&
        r.awayTeam === match.away_team &&
        r.date === match.match_date
      );

      if (!result) continue;

      console.log(`Settling: ${match.home_team} vs ${match.away_team} (${result.homeScore}-${result.awayScore})`);

      const { data: settleResult, error: settleError } = await supabase.rpc('settle_match_bets', {
        p_home_team: match.home_team,
        p_away_team: match.away_team,
        p_match_date: match.match_date,
        p_home_score: result.homeScore,
        p_away_score: result.awayScore,
      });

      if (settleError) {
        console.error(`Error settling ${match.home_team} vs ${match.away_team}:`, settleError);
      } else {
        const settled = (settleResult as any)?.settled || 0;
        totalSettled += settled;
        console.log(`Settled ${settled} bets for this match`);
      }
    }

    console.log(`Total bets settled: ${totalSettled}`);

    return new Response(
      JSON.stringify({ settled: totalSettled, matches_checked: uniqueMatches.size }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in settle-bets:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
