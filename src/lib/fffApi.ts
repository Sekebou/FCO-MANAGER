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

export interface FFFLiveMatch {
  home: { short_name: string; name: string; club: { cl_no: number; logo?: string } };
  away: { short_name: string; name: string; club: { cl_no: number; logo?: string } };
  home_score: number | null;
  away_score: number | null;
  date: string;
  time?: string;
  terrain?: { city?: string; name?: string };
  journee?: { number?: number };
  [key: string]: any;
}

export interface FFFMonthGroup {
  mois: string;
  matchs: FFFLiveMatch[];
}

/** Récupère TOUS les matchs à venir d'Oisemont mois par mois jusqu'à juin */
export async function getTousMatchsAvenir(cpNo: number, phase = 1, poule = 1, clubId = OISEMONT_CL_NO): Promise<FFFMonthGroup[]> {
  const mois: { label: string; after: string; before: string }[] = [];
  const now = new Date();
  const fin = new Date(now.getFullYear(), 5, 30); // juin de l'année courante
  if (fin < now) fin.setFullYear(fin.getFullYear() + 1);

  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor <= fin) {
    const annee = cursor.getFullYear();
    const moisNum = String(cursor.getMonth() + 1).padStart(2, '0');
    const derJour = new Date(annee, cursor.getMonth() + 1, 0).getDate();
    mois.push({
      label: cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      after: `${annee}-${moisNum}-01`,
      before: `${annee}-${moisNum}-${derJour}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const resultats = await Promise.all(
    mois.map(async (m) => {
      try {
        const data = await callFFF(
          `/compets/${cpNo}/phases/${phase}/poules/${poule}/calendrier?ma_dat[after]=${m.after}&ma_dat[before]=${m.before}`
        );
        const members = data?.['hydra:member'] || [];
        const matchs = members.filter(
          (match: any) => match.home?.club?.cl_no === clubId || match.away?.club?.cl_no === clubId
        );
        return { mois: m.label, matchs };
      } catch {
        return { mois: m.label, matchs: [] };
      }
    })
  );

  return resultats.filter(r => r.matchs.length > 0);
}

/** Récupère TOUS les résultats passés d'Oisemont mois par mois depuis septembre */
export async function getTousResultats(cpNo: number, phase = 1, poule = 1, clubId = OISEMONT_CL_NO): Promise<FFFMonthGroup[]> {
  const mois: { label: string; after: string; before: string }[] = [];
  const now = new Date();
  // Start from September of current season
  const debut = new Date(now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);
  const cursor = new Date(debut);

  while (cursor <= now) {
    const annee = cursor.getFullYear();
    const moisNum = String(cursor.getMonth() + 1).padStart(2, '0');
    const derJour = new Date(annee, cursor.getMonth() + 1, 0).getDate();
    mois.push({
      label: cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      after: `${annee}-${moisNum}-01`,
      before: `${annee}-${moisNum}-${derJour}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const resultats = await Promise.all(
    mois.map(async (m) => {
      try {
        const data = await callFFF(
          `/compets/${cpNo}/phases/${phase}/poules/${poule}/resultat?ma_dat[after]=${m.after}&ma_dat[before]=${m.before}`
        );
        const members = data?.['hydra:member'] || [];
        const matchs = members.filter(
          (match: any) => match.home?.club?.cl_no === clubId || match.away?.club?.cl_no === clubId
        );
        return { mois: m.label, matchs };
      } catch {
        return { mois: m.label, matchs: [] };
      }
    })
  );

  return resultats.filter(r => r.matchs.length > 0).reverse(); // Plus récents en premier
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
  clNo?: number;
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

/** Transforme la réponse classement de l'API FFF en ScrapedStanding[] 
 * Accepte soit le tableau hydra:member directement, soit la réponse complète */
export function mapClassementToStandings(classementData: any): ScrapedStanding[] {
  if (!classementData) return [];
  
  // Support hydra:member array directly, or extract it from response
  let entries: any[] = [];
  if (Array.isArray(classementData)) {
    entries = classementData;
  } else if (classementData['hydra:member']) {
    entries = classementData['hydra:member'];
  } else {
    // Legacy fallback: journees structure
    const journees = classementData.journees || [];
    if (journees.length === 0) return [];
    const latestJournee = journees[journees.length - 1];
    entries = latestJournee?.classement_journee || latestJournee?.classement || [];
    if (!Array.isArray(entries)) return [];
  }
  
  if (!Array.isArray(entries) || entries.length === 0) return [];
  
  return entries.map((entry: any, index: number) => ({
    rank: entry.rang ?? entry.rank ?? index + 1,
    team: entry.equipe?.short_name || entry.equipe?.name || entry.club?.name || entry.nom || '',
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
    goalDiff: entry.goals_diff ?? entry.diff ?? entry.goal_diff ?? 0,
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
  
  // Support hydra:member array directly, or extract it
  let entries: any[] = [];
  if (Array.isArray(classementData)) {
    entries = classementData;
  } else if (classementData['hydra:member']) {
    entries = classementData['hydra:member'];
  } else {
    const journees = classementData.journees || [];
    if (journees.length === 0) return logos;
    const latestJournee = journees[journees.length - 1];
    entries = latestJournee?.classement_journee || latestJournee?.classement || [];
  }
  
  if (!Array.isArray(entries)) return logos;
  
  for (const entry of entries) {
    const name = entry.equipe?.short_name || entry.equipe?.name || entry.club?.name || '';
    const logo = entry.equipe?.club?.logo || entry.club?.logo || '';
    if (name && logo) logos[name.toUpperCase()] = logo;
  }
  
  return logos;
}

/** Trouve l'engagement championnat d'une équipe et retourne les paramètres API */
export function getTeamChampionship(equipes: any[], categoryCode: string, code: number): { cpNo: number; phase: number; poule: number } | null {
  const equipe = equipes.find(
    (eq: any) => eq.category_code === categoryCode && eq.code === code
  );
  if (!equipe?.engagements) return null;
  
  const engagement = equipe.engagements.find(
    (eng: any) => eng.competition?.type === 'CH'
  );
  if (!engagement) return null;
  
  return {
    cpNo: engagement.competition.cp_no,
    phase: engagement.phase?.number || 1,
    poule: engagement.poule?.stage_number || 1,
  };
}
