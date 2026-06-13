import { supabase } from '@/integrations/supabase/client';

export const OISEMONT_CL_NO = 3246;
export const OISEMONT_AFFILIATION = 508456;

/** Suffixe le nom d'Oisemont selon la catégorie d'équipe (A=rien, B=2, C=3) */
export function getOisemontDisplayName(name: string, teamCategory?: string): string {
  if (!name) return name;
  const isOisemont = name.toUpperCase().includes('OISEMONT');
  if (!isOisemont) return name;
  if (teamCategory === 'B') return name.replace(/(\s*\d+)?$/i, '') + ' 2';
  if (teamCategory === 'C') return name.replace(/(\s*\d+)?$/i, '') + ' 3';
  return name;
}

// In-memory cache with 15min TTL to reduce cloud edge function invocations
const fffCache = new Map<string, { data: any; ts: number }>();
const fffInFlight = new Map<string, Promise<any>>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/** Clear the FFF API cache (e.g. before a manual refresh) */
export function clearFFFCache() {
  fffCache.clear();
  fffInFlight.clear();
}

async function callFFF(endpoint: string) {
  const cached = fffCache.get(endpoint);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const inFlight = fffInFlight.get(endpoint);
  if (inFlight) return inFlight;

  const request = supabase.functions.invoke('fff-proxy', {
    body: { endpoint },
  }).then(({ data, error }) => {
    if (error) throw error;
    fffCache.set(endpoint, { data, ts: Date.now() });
    return data;
  }).finally(() => {
    fffInFlight.delete(endpoint);
  });

  fffInFlight.set(endpoint, request);
  return request;
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
        const members = Array.isArray(data) ? data : data?.['hydra:member'] || [];
        const matchs = members.filter(
          (match: any) => (match.home?.club?.cl_no === clubId || match.away?.club?.cl_no === clubId)
            && match.home_score == null && match.away_score == null
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
        const members = Array.isArray(data) ? data : data?.['hydra:member'] || [];
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
  equipeCode: number;
  category: string;
  competition: any;
  cpNo: number;
  phase: number;
  poule: number;
  competitionName: string;
}

export const FCO_DEFAULT_COMPETITIONS: FFFCompetition[] = [
  { equipe: 'Équipe A', equipeCode: 1, category: 'Seniors', competition: null, cpNo: 443358, phase: 1, poule: 3, competitionName: 'Seniors D2' },
  { equipe: 'Équipe B', equipeCode: 2, category: 'Seniors', competition: null, cpNo: 443360, phase: 1, poule: 1, competitionName: 'Seniors D4' },
  { equipe: 'Équipe C', equipeCode: 3, category: 'Seniors', competition: null, cpNo: 443362, phase: 1, poule: 1, competitionName: 'Seniors D6' },
];

/** Map FFF equipe code (1,2,3) to team letter (A,B,C) */
export function equipeCodeToTeamLetter(code: number): string {
  const map: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };
  return map[code] || String.fromCharCode(64 + code); // fallback D, E, F...
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
        equipeCode: eq.code || 1,
        category: eq.category_label || '',
        competition: eng.competition,
        cpNo: eng.competition?.cp_no || eng.cp_no,
        phase: eng.phase?.number || 1,
        poule: eng.poule?.stage_number || 1,
        competitionName: eng.competition?.name || eng.competition?.short_name || 'Compétition',
      });
    }
  }
  return result.length > 0 ? result : FCO_DEFAULT_COMPETITIONS;
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
    forfeits: entry.forfeits_games_count ?? entry.f ?? entry.forfaits ?? 0,
    penalties: entry.penalty_point_count ?? entry.pen ?? entry.penalties ?? 0,
    goalsFor: entry.goals_for_count ?? entry.bp ?? entry.goals_for ?? 0,
    goalsAgainst: entry.goals_against_count ?? entry.bc ?? entry.goals_against ?? 0,
    goalDiff: (entry.goals_for_count ?? entry.bp ?? entry.goals_for ?? 0) - (entry.goals_against_count ?? entry.bc ?? entry.goals_against ?? 0),
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

/** Extrait les logos depuis les résultats de matchs, indexés par cl_no */
export function extractTeamLogosFromResults(resultatsData: any): Record<number, string> {
  const logos: Record<number, string> = {};
  const members = Array.isArray(resultatsData)
    ? resultatsData
    : resultatsData?.['hydra:member'] || [];
  for (const match of members) {
    if (match.home?.club?.cl_no && match.home?.club?.logo) {
      logos[match.home.club.cl_no] = match.home.club.logo;
    }
    if (match.away?.club?.cl_no && match.away?.club?.logo) {
      logos[match.away.club.cl_no] = match.away.club.logo;
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
