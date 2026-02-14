import { supabase } from '@/integrations/supabase/client';

export type ScrapedMatch = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  date: string;
  journee: number;
  played: boolean;
};

export type ScrapeResult = {
  success: boolean;
  teams?: string[];
  matches?: ScrapedMatch[];
  rawMarkdown?: string;
  error?: string;
};

export async function scrapeFFFTeams(url: string): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-fff-teams', {
    body: { url },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}
