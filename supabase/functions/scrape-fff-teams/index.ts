const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ScrapedMatch {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  date: string;
  journee: number;
  played: boolean;
}

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

    const markdown = data.data?.markdown || data.markdown || '';
    const teams = extractTeamNames(markdown);
    const matches = extractMatches(markdown);

    console.log(`Found ${teams.length} teams, ${matches.length} matches`);

    return new Response(
      JSON.stringify({ success: true, teams, matches, rawMarkdown: markdown }),
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

  const clubLinkPattern = /\[!\[([^\]]+)\]\([^)]*\)\\\\\s*\n?\s*([^\]]+)\]\(https:\/\/epreuves\.fff\.fr\/competition\/club\//g;
  let match;
  while ((match = clubLinkPattern.exec(markdown)) !== null) {
    const name = match[2].trim();
    if (name && !seen.has(name.toUpperCase())) {
      seen.add(name.toUpperCase());
      teams.push(name);
    }
  }

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

function extractMatches(markdown: string): ScrapedMatch[] {
  const matches: ScrapedMatch[] = [];

  // French month mapping
  const monthMap: Record<string, string> = {
    'jan': '01', 'fév': '02', 'fev': '02', 'mar': '03', 'avr': '04',
    'mai': '05', 'jun': '06', 'jui': '07', 'jul': '07', 'aoû': '08', 'aou': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'déc': '12', 'dec': '12',
  };

  // Split into lines for processing
  const lines = markdown.split('\n');

  let currentDate = '';
  let currentJournee = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect date lines like "dim 07 sep 2025 - 15h00" or "sam 15 nov 2025 - 18h30"
    const dateMatch = line.match(/^(?:lun|mar|mer|jeu|ven|sam|dim)\s+(\d{1,2})\s+(\w{3})\s+(\d{4})\s*-\s*(\d{1,2})h(\d{2})/i);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const monthKey = dateMatch[2].toLowerCase().substring(0, 3);
      const month = monthMap[monthKey] || '01';
      const year = dateMatch[3];
      currentDate = `${year}-${month}-${day}`;
      continue;
    }

    // Detect journée from competition links like "[Seniors D2 - Senior  Journée 3]"
    const journeeMatch = line.match(/Journée\s+(\d+)/i);
    if (journeeMatch) {
      currentJournee = parseInt(journeeMatch[1], 10);
      continue;
    }

    // Detect match pattern: team1 link, then score link, then team2 link
    // Home team pattern: [![TEAM](logo)\\
    const homeTeamMatch = line.match(/\[!\[([^\]]+)\]\([^)]*\)\\\\/);
    if (homeTeamMatch && currentDate) {
      const homeTeam = homeTeamMatch[1].trim();

      // Look ahead for team name confirmation, score, and away team
      let homeTeamName = homeTeam;
      let awayTeamName = '';
      let homeScore: number | null = null;
      let awayScore: number | null = null;
      let played = false;

      // Scan next lines for the rest of the match block
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const nextLine = lines[j].trim();

        // Team name line right after logo (confirmation)
        if (nextLine.match(/^[A-ZÀ-Ÿ\s\d.'\/()-]+\]\(https:\/\/epreuves\.fff\.fr\/competition\/club\//)) {
          const teamName = nextLine.replace(/\]\(https:\/\/epreuves\.fff\.fr\/competition\/club\/.*$/, '').trim();
          if (!awayTeamName && teamName !== homeTeamName) {
            // This could be the home team name or away team name
            if (homeScore !== null || awayScore !== null) {
              awayTeamName = teamName;
            } else {
              homeTeamName = teamName;
            }
          }
        }

        // Score pattern: [30](match-url) where digits represent the score
        const scoreMatch = nextLine.match(/^\[(\d{1,2})(\d{1,2})\]\(https:\/\/epreuves\.fff\.fr\/competition\/match\//);
        if (scoreMatch) {
          // Score is encoded as concatenated digits, e.g. "40" = 4-0, "22" = 2-2, "13" = 1-3
          const scoreStr = scoreMatch[1] + scoreMatch[2];
          if (scoreStr.length === 2) {
            homeScore = parseInt(scoreStr[0], 10);
            awayScore = parseInt(scoreStr[1], 10);
            played = true;
          }
          continue;
        }

        // Unplayed match: [15:00](match-url)
        const timeMatch = nextLine.match(/^\[\d{1,2}:\d{2}\]\(https:\/\/epreuves\.fff\.fr\/competition\/match\//);
        if (timeMatch) {
          played = false;
          continue;
        }

        // Away team pattern
        const awayTeamMatch = nextLine.match(/\[!\[([^\]]+)\]\([^)]*\)\\\\/);
        if (awayTeamMatch && !awayTeamName) {
          awayTeamName = awayTeamMatch[1].trim();
        }

        // If we hit a new date or empty significant break, stop
        if (nextLine.match(/^(?:lun|mar|mer|jeu|ven|sam|dim)\s+\d{1,2}\s+\w{3}\s+\d{4}/i)) {
          break;
        }
      }

      if (homeTeamName && awayTeamName && currentDate) {
        matches.push({
          homeTeam: homeTeamName,
          awayTeam: awayTeamName,
          homeScore,
          awayScore,
          date: currentDate,
          journee: currentJournee || 1,
          played,
        });
        // Skip ahead past this match block
        i += 4;
      }
    }
  }

  // Deduplicate matches (same teams + same date)
  const seen = new Set<string>();
  return matches.filter(m => {
    const key = `${m.homeTeam}-${m.awayTeam}-${m.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
