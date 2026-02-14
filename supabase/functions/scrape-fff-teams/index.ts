const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping FFF URL:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract team names from the markdown content
    const markdown = data.data?.markdown || data.markdown || '';
    const teams = extractTeamNames(markdown);

    console.log(`Found ${teams.length} teams`);

    return new Response(
      JSON.stringify({ success: true, teams, rawMarkdown: markdown }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping FFF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractTeamNames(markdown: string): string[] {
  const teams: string[] = [];
  const seen = new Set<string>();

  // Pattern 1: Extract from FFF club links like [![TEAM NAME](logo)\\nTEAM NAME](url)
  // or [TEAM NAME](https://epreuves.fff.fr/competition/club/...)
  const clubLinkPattern = /\[!\[([^\]]+)\]\([^)]*\)\\\\\s*\n?\s*([^\]]+)\]\(https:\/\/epreuves\.fff\.fr\/competition\/club\//g;
  let match;
  while ((match = clubLinkPattern.exec(markdown)) !== null) {
    const name = match[2].trim();
    if (name && !seen.has(name.toUpperCase())) {
      seen.add(name.toUpperCase());
      teams.push(name);
    }
  }

  // Pattern 2: Extract from classement table rows like "| [![undefined](logo) TEAM NAME](url) |"
  const tablePattern = /\[!\[[^\]]*\]\([^)]*\)\s+([^\]]+)\]\(https:\/\/epreuves\.fff\.fr\/competition\/club\//g;
  while ((match = tablePattern.exec(markdown)) !== null) {
    const name = match[1].trim();
    if (name && !seen.has(name.toUpperCase())) {
      seen.add(name.toUpperCase());
      teams.push(name);
    }
  }

  return teams;
}
