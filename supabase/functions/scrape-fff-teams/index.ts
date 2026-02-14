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

interface ScrapedStanding {
  rank: number;
  team: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  forfeits: number;
  penalties: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
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

    // Derive the classement URL from the main URL
    const classementUrl = formattedUrl.replace(/\/resultat-calendrier\/?$/, '/classement');

    console.log('Scraping FFF URL:', formattedUrl);
    console.log('Scraping FFF classement URL:', classementUrl);

    // Scrape both pages in parallel
    const [mainResponse, classementResponse] = await Promise.all([
      fetch('https://api.firecrawl.dev/v1/scrape', {
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
      }),
      fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: classementUrl,
          formats: ['markdown'],
          onlyMainContent: true,
          waitFor: 3000,
        }),
      }),
    ]);

    const mainData = await mainResponse.json();
    const classementData = await classementResponse.json();

    if (!mainResponse.ok) {
      console.error('Firecrawl API error:', mainData);
      return new Response(
        JSON.stringify({ success: false, error: mainData.error || `Request failed with status ${mainResponse.status}` }),
        { status: mainResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = mainData.data?.markdown || mainData.markdown || '';
    const classementMarkdown = classementData.data?.markdown || classementData.markdown || '';
    const allMarkdown = markdown + '\n' + classementMarkdown;
    const teams = extractTeamNames(allMarkdown);
    const matches = extractMatches(markdown);
    const standings = extractStandings(classementMarkdown);
    const teamLogos = extractTeamLogos(allMarkdown);

    console.log(`Found ${teams.length} teams, ${matches.length} matches, ${standings.length} standings, ${Object.keys(teamLogos).length} logos`);

    return new Response(
      JSON.stringify({ success: true, teams, matches, standings, teamLogos, rawMarkdown: markdown }),
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

function extractTeamLogos(markdown: string): Record<string, string> {
  const logos: Record<string, string> = {};

  // Pattern 1: [![TEAM_NAME](logo_url)\\ from match blocks
  const pattern1 = /\[!\[([^\]]+)\]\((https:\/\/cdn-transverse\.azureedge\.net\/phlogos\/[^)]+)\)\\\\/g;
  let match;
  while ((match = pattern1.exec(markdown)) !== null) {
    const teamName = match[1].trim();
    const logoUrl = match[2].trim();
    if (teamName && logoUrl && teamName !== 'undefined') {
      logos[teamName.toUpperCase()] = logoUrl;
    }
  }

  // Pattern 2: [![undefined](logo_url) TEAM_NAME](club_url) from standings table
  const pattern2 = /\[!\[(?:undefined|[^\]]*)\]\((https:\/\/cdn-transverse\.azureedge\.net\/phlogos\/[^)]+)\)\s+([^\]]+)\]\(https:\/\/epreuves\.fff\.fr/g;
  while ((match = pattern2.exec(markdown)) !== null) {
    const logoUrl = match[1].trim();
    const teamName = match[2].trim();
    if (teamName && logoUrl) {
      logos[teamName.toUpperCase()] = logoUrl;
    }
  }

  return logos;
}

function extractStandings(markdown: string): ScrapedStanding[] {
  const standings: ScrapedStanding[] = [];

  // Look for the detailed standings table
  // Format: | rank | Pr. | Team | Pts | J. | G. | N. | P. | F. | P/Bo. | Bp. | Bc. | Diff. | Série |
  const lines = markdown.split('\n');

  let inStandingsTable = false;
  let headerFound = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect the standings header row
    if (trimmed.includes('| Pr.') && trimmed.includes('| Pts') && trimmed.includes('| Bp.')) {
      inStandingsTable = true;
      headerFound = false;
      continue;
    }

    // Skip separator row
    if (inStandingsTable && trimmed.match(/^\|[\s-|]+\|$/)) {
      headerFound = true;
      continue;
    }

    // Parse data rows
    if (inStandingsTable && headerFound && trimmed.startsWith('|')) {
      // Extract team name from the markdown link pattern
      const teamMatch = trimmed.match(/\[!\[(?:undefined|[^\]]*)\]\([^)]*\)\s+([^\]]+)\]\(https:\/\/epreuves\.fff\.fr/);
      if (!teamMatch) continue;

      const teamName = teamMatch[1].trim();

      // Split the row by | and parse numbers
      // Format: | rank | pr | team_link | pts | j | g | n | p | f | p/bo | bp | bc | diff | serie |
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);

      if (cells.length >= 12) {
        const rank = parseInt(cells[0], 10);
        // cells[1] = Pr. (previous rank change)
        // cells[2] = team link (already extracted)
        const pts = parseInt(cells[3], 10);
        const j = parseInt(cells[4], 10);
        const g = parseInt(cells[5], 10);
        const n = parseInt(cells[6], 10);
        const p = parseInt(cells[7], 10);
        const f = parseInt(cells[8], 10);
        const pbo = parseInt(cells[9], 10);
        const bp = parseInt(cells[10], 10);
        const bc = parseInt(cells[11], 10);
        const diff = parseInt(cells[12], 10);

        if (!isNaN(rank) && teamName) {
          standings.push({
            rank,
            team: teamName,
            points: isNaN(pts) ? 0 : pts,
            played: isNaN(j) ? 0 : j,
            won: isNaN(g) ? 0 : g,
            drawn: isNaN(n) ? 0 : n,
            lost: isNaN(p) ? 0 : p,
            forfeits: isNaN(f) ? 0 : f,
            penalties: isNaN(pbo) ? 0 : pbo,
            goalsFor: isNaN(bp) ? 0 : bp,
            goalsAgainst: isNaN(bc) ? 0 : bc,
            goalDiff: isNaN(diff) ? 0 : diff,
          });
        }
      }
    }

    // End of table
    if (inStandingsTable && headerFound && !trimmed.startsWith('|') && trimmed.length > 0) {
      break;
    }
  }

  return standings;
}

function extractMatches(markdown: string): ScrapedMatch[] {
  const matches: ScrapedMatch[] = [];

  const monthMap: Record<string, string> = {
    'jan': '01', 'fév': '02', 'fev': '02', 'mar': '03', 'avr': '04',
    'mai': '05', 'jun': '06', 'jui': '07', 'jul': '07', 'aoû': '08', 'aou': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'déc': '12', 'dec': '12',
  };

  const lines = markdown.split('\n');
  let currentDate = '';
  let currentJournee = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const dateMatch = line.match(/^(?:lun|mar|mer|jeu|ven|sam|dim)\s+(\d{1,2})\s+(\w{3})\s+(\d{4})\s*-\s*(\d{1,2})h(\d{2})/i);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const monthKey = dateMatch[2].toLowerCase().substring(0, 3);
      const month = monthMap[monthKey] || '01';
      const year = dateMatch[3];
      currentDate = `${year}-${month}-${day}`;
      continue;
    }

    const journeeMatch = line.match(/Journée\s+(\d+)/i);
    if (journeeMatch) {
      currentJournee = parseInt(journeeMatch[1], 10);
      continue;
    }

    const homeTeamMatch = line.match(/\[!\[([^\]]+)\]\([^)]*\)\\\\/);
    if (homeTeamMatch && currentDate) {
      const homeTeam = homeTeamMatch[1].trim();
      let homeTeamName = homeTeam;
      let awayTeamName = '';
      let homeScore: number | null = null;
      let awayScore: number | null = null;
      let played = false;

      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const nextLine = lines[j].trim();

        if (nextLine.match(/^[A-ZÀ-Ÿ\s\d.'\/()-]+\]\(https:\/\/epreuves\.fff\.fr\/competition\/club\//)) {
          const teamName = nextLine.replace(/\]\(https:\/\/epreuves\.fff\.fr\/competition\/club\/.*$/, '').trim();
          if (!awayTeamName && teamName !== homeTeamName) {
            if (homeScore !== null || awayScore !== null) {
              awayTeamName = teamName;
            } else {
              homeTeamName = teamName;
            }
          }
        }

        const scoreMatch = nextLine.match(/^\[(\d{1,2})(\d{1,2})\]\(https:\/\/epreuves\.fff\.fr\/competition\/match\//);
        if (scoreMatch) {
          const scoreStr = scoreMatch[1] + scoreMatch[2];
          if (scoreStr.length === 2) {
            homeScore = parseInt(scoreStr[0], 10);
            awayScore = parseInt(scoreStr[1], 10);
            played = true;
          }
          continue;
        }

        const timeMatch = nextLine.match(/^\[\d{1,2}:\d{2}\]\(https:\/\/epreuves\.fff\.fr\/competition\/match\//);
        if (timeMatch) {
          played = false;
          continue;
        }

        const awayTeamMatch = nextLine.match(/\[!\[([^\]]+)\]\([^)]*\)\\\\/);
        if (awayTeamMatch && !awayTeamName) {
          awayTeamName = awayTeamMatch[1].trim();
        }

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
        i += 4;
      }
    }
  }

  const seen = new Set<string>();
  return matches.filter(m => {
    const key = `${m.homeTeam}-${m.awayTeam}-${m.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
