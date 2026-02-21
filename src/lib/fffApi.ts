import { supabase } from '@/integrations/supabase/client';

export const OISEMONT_CL_NO = 3246;
export const OISEMONT_AFFILIATION = 508456;

async function callFFF(endpoint: string) {
  const { data, error } = await supabase.functions.invoke('fff-proxy', {
    body: { endpoint },
  });
  if (error) throw error;
  return data;
}

/** Récupère toutes les équipes d'un club + logos + engagements (cp_no) */
export async function getEquipes(clubId: number) {
  return callFFF(`/clubs/${clubId}/equipes.json?filter=`);
}

/** Résultats passés d'une compétition */
export async function getResultats(cpNo: number, phase = 1, poule = 1) {
  return callFFF(`/compets/${cpNo}/phases/${phase}/poules/${poule}/resultat`);
}

/** Prochains matchs d'une compétition */
export async function getCalendrier(cpNo: number, phase = 1, poule = 1) {
  return callFFF(`/compets/${cpNo}/phases/${phase}/poules/${poule}/calendrier`);
}

/** Classement d'une compétition */
export async function getClassement(cpNo: number, phase = 1, poule = 1) {
  return callFFF(`/compets/${cpNo}/phases/${phase}/poules/${poule}/classement_journees`);
}

export interface FFFCompetition {
  equipe: string;
  category: string;
  competition: any;
  cpNo: number;
  phase: number;
  poule: number;
  competitionName: string;
}

/** Extrait toutes les compétitions actives (non éliminé) d'un club */
export function getAllCompetitions(equipes: any[]): FFFCompetition[] {
  const result: FFFCompetition[] = [];
  for (const eq of equipes) {
    if (!eq.engagements) continue;
    for (const eng of eq.engagements) {
      if (eng.en_elimine === 'O') continue;
      result.push({
        equipe: eq.short_name || eq.name,
        category: eq.category_label || '',
        competition: eng.competition,
        cpNo: eng.competition?.cp_no || eng.cp_no,
        phase: eng.phase?.number || 1,
        poule: eng.poule?.stage_number || 1,
        competitionName: eng.competition?.name || eng.competition?.short_name || 'Compétition',
      });
    }
  }
  return result;
}

/** Encode les paramètres API dans fff_url pour stockage en base */
export function encodeFFFApiRef(cpNo: number, phase: number, poule: number): string {
  return `fff-api::${cpNo}::${phase}::${poule}`;
}

/** Décode les paramètres API depuis fff_url */
export function decodeFFFApiRef(fffUrl: string): { cpNo: number; phase: number; poule: number } | null {
  if (!fffUrl.startsWith('fff-api::')) return null;
  const parts = fffUrl.split('::');
  if (parts.length !== 4) return null;
  return {
    cpNo: parseInt(parts[1], 10),
    phase: parseInt(parts[2], 10),
    poule: parseInt(parts[3], 10),
  };
}

export type ScrapedMatch = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  date: string;
  journee: number;
  played: boolean;
};

export type ScrapedStanding = {
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
};

/** Transforme la réponse classement de l'API FFF en ScrapedStanding[] */
export function mapClassementToStandings(classementData: any): ScrapedStanding[] {
  if (!classementData) return [];
  
  // classement_journees returns an array of journees, take the latest
  const journees = Array.isArray(classementData) ? classementData : classementData.journees || [];
  if (journees.length === 0) return [];
  
  // Get the latest journee (last element)
  const latestJournee = journees[journees.length - 1];
  const classement = latestJournee?.classement_journee || latestJournee?.classement || latestJournee;
  
  if (!Array.isArray(classement)) return [];
  
  return classement.map((entry: any, index: number) => ({
    rank: entry.rank || entry.rang || index + 1,
    team: entry.equipe?.short_name || entry.equipe?.name || entry.club?.name || entry.nom || '',
    points: entry.pts ?? entry.points ?? 0,
    played: entry.mj ?? entry.played ?? entry.j ?? 0,
    won: entry.g ?? entry.won ?? entry.victoires ?? 0,
    drawn: entry.n ?? entry.drawn ?? entry.nuls ?? 0,
    lost: entry.p ?? entry.lost ?? entry.defaites ?? 0,
    forfeits: entry.f ?? entry.forfaits ?? 0,
    penalties: entry.pen ?? entry.penalties ?? 0,
    goalsFor: entry.bp ?? entry.goals_for ?? entry.buts_pour ?? 0,
    goalsAgainst: entry.bc ?? entry.goals_against ?? entry.buts_contre ?? 0,
    goalDiff: entry.diff ?? entry.goal_diff ?? (entry.bp ?? 0) - (entry.bc ?? 0),
  })).filter((s: ScrapedStanding) => s.team);
}

/** Transforme les matchs de l'API FFF (résultats ou calendrier) en ScrapedMatch[] */
export function mapMatchesToScrapedMatches(matchesData: any, defaultJournee = 1): ScrapedMatch[] {
  if (!matchesData) return [];
  
  // API can return { results: [...] } or directly an array, or { matchs: [...] }
  const matchList = Array.isArray(matchesData) 
    ? matchesData 
    : matchesData.results || matchesData.matchs || matchesData.calendrier || [];
  
  if (!Array.isArray(matchList)) return [];
  
  return matchList.map((m: any) => {
    const homeTeam = m.home?.short_name || m.home?.name || m.dom?.short_name || m.dom?.name || '';
    const awayTeam = m.away?.short_name || m.away?.name || m.ext?.short_name || m.ext?.name || '';
    const homeScore = m.home_score ?? m.score_home ?? m.dom_score ?? null;
    const awayScore = m.away_score ?? m.score_away ?? m.ext_score ?? null;
    const played = homeScore !== null && awayScore !== null;
    
    // Parse date
    let date = '';
    if (m.date) {
      const d = new Date(m.date);
      if (!isNaN(d.getTime())) {
        date = d.toISOString().split('T')[0];
      } else {
        date = m.date;
      }
    }
    
    const journee = m.journee?.number || m.journee?.numero || m.journee || defaultJournee;
    
    return {
      homeTeam,
      awayTeam,
      homeScore: homeScore !== null ? Number(homeScore) : null,
      awayScore: awayScore !== null ? Number(awayScore) : null,
      date,
      journee: typeof journee === 'number' ? journee : parseInt(journee, 10) || defaultJournee,
      played,
    };
  }).filter((m: ScrapedMatch) => m.homeTeam && m.awayTeam);
}

/** Extrait les logos des équipes depuis les données équipes */
export function extractTeamLogosFromEquipes(equipes: any[]): Record<string, string> {
  const logos: Record<string, string> = {};
  for (const eq of equipes) {
    if (eq.club?.logo) {
      const name = eq.short_name || eq.name || '';
      if (name) logos[name.toUpperCase()] = eq.club.logo;
    }
  }
  return logos;
}

/** Extrait les logos depuis les données de classement */
export function extractTeamLogosFromClassement(classementData: any): Record<string, string> {
  const logos: Record<string, string> = {};
  if (!classementData) return logos;
  
  const journees = Array.isArray(classementData) ? classementData : classementData.journees || [];
  if (journees.length === 0) return logos;
  
  const latestJournee = journees[journees.length - 1];
  const classement = latestJournee?.classement_journee || latestJournee?.classement || latestJournee;
  
  if (!Array.isArray(classement)) return logos;
  
  for (const entry of classement) {
    const name = entry.equipe?.short_name || entry.equipe?.name || entry.club?.name || '';
    const logo = entry.equipe?.club?.logo || entry.club?.logo || '';
    if (name && logo) logos[name.toUpperCase()] = logo;
  }
  
  return logos;
}
