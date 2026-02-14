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
  const lines = markdown.split('\n').map(l => l.trim()).filter(Boolean);
  const teams: string[] = [];
  const seen = new Set<string>();

  // Common patterns on FFF pages: team names appear as list items, table rows, or standalone lines
  // Filter out common non-team strings
  const excludePatterns = [
    /^#{1,6}\s/,           // Headers
    /^classement/i,
    /^journée/i,
    /^poule/i,
    /^groupe/i,
    /^résultats/i,
    /^calendrier/i,
    /^\d+[eè]?me?\s+journée/i,
    /^\[/,                  // Links
    /^http/i,
    /^\|/,                  // Table separators
    /^---/,
    /^pts|^mj|^mg|^mn|^mp|^bp|^bc|^diff/i,
    /^\d+$/,                // Pure numbers
  ];

  for (const line of lines) {
    // Clean markdown formatting
    let cleaned = line
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\||\|$/g, '')
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .trim();

    if (!cleaned || cleaned.length < 3 || cleaned.length > 60) continue;
    if (excludePatterns.some(p => p.test(cleaned))) continue;
    if (/^\d+\s*\|/.test(cleaned)) {
      // Table row: extract team name (usually second column)
      const parts = cleaned.split('|').map(s => s.trim());
      const namePart = parts.find(p => p && !/^\d+$/.test(p) && p.length > 2);
      if (namePart) cleaned = namePart;
      else continue;
    }

    // Check if it looks like a team name (contains letters, possibly with numbers like "U15")
    if (/[a-zA-ZÀ-ÿ]{2,}/.test(cleaned) && !seen.has(cleaned.toLowerCase())) {
      seen.add(cleaned.toLowerCase());
      teams.push(cleaned);
    }
  }

  return teams;
}
