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

    // Fetch all championships with a fff_url
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
    console.log(`Found ${championships.length} championships with fff_url`);

    const results: { id: string; name: string; success: boolean; error?: string }[] = [];

    for (const champ of championships) {
      try {
        console.log(`Refreshing championship: ${champ.name} (${champ.id})`);

        // Call scrape-fff-teams edge function
        const scrapeRes = await fetch(`${supabaseUrl}/functions/v1/scrape-fff-teams`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: champ.fff_url }),
        });

        if (!scrapeRes.ok) {
          const err = await scrapeRes.text();
          console.error(`Scrape failed for ${champ.name}:`, err);
          results.push({ id: champ.id, name: champ.name, success: false, error: 'Scrape failed' });
          continue;
        }

        const scrapeData = await scrapeRes.json();

        if (!scrapeData.success) {
          console.error(`Scrape error for ${champ.name}:`, scrapeData.error);
          results.push({ id: champ.id, name: champ.name, success: false, error: scrapeData.error });
          continue;
        }

        // Update championship standings
        const updateBody: Record<string, unknown> = {};

        if (scrapeData.standings && scrapeData.standings.length > 0) {
          updateBody.fff_standings = scrapeData.standings;
        }
        if (scrapeData.teamLogos && Object.keys(scrapeData.teamLogos).length > 0) {
          updateBody.team_logos = scrapeData.teamLogos;
        }
        if (scrapeData.teams && scrapeData.teams.length > 0) {
          updateBody.teams = scrapeData.teams;
        }

        if (Object.keys(updateBody).length > 0) {
          const updateRes = await fetch(`${supabaseUrl}/rest/v1/championships?id=eq.${champ.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify(updateBody),
          });

          if (!updateRes.ok) {
            const err = await updateRes.text();
            console.error(`Update failed for ${champ.name}:`, err);
            results.push({ id: champ.id, name: champ.name, success: false, error: 'Update failed' });
            continue;
          }
        }

        // Upsert matches
        if (scrapeData.matches && scrapeData.matches.length > 0) {
          // Delete old matches and re-insert (simpler than upsert with composite keys)
          await fetch(`${supabaseUrl}/rest/v1/championship_matches?championship_id=eq.${champ.id}`, {
            method: 'DELETE',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          });

          const matchRows = scrapeData.matches.map((m: {
            homeTeam: string; awayTeam: string;
            homeScore: number | null; awayScore: number | null;
            date: string; journee: number; played: boolean;
          }) => ({
            championship_id: champ.id,
            home_team: m.homeTeam,
            away_team: m.awayTeam,
            home_score: m.homeScore,
            away_score: m.awayScore,
            date: m.date,
            journee: m.journee,
            played: m.played,
          }));

          await fetch(`${supabaseUrl}/rest/v1/championship_matches`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify(matchRows),
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
