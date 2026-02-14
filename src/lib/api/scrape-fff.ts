import { supabase } from '@/integrations/supabase/client';

export type ScrapeResult = {
  success: boolean;
  teams?: string[];
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
