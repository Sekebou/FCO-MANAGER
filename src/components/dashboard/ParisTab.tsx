import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Coins, Clock, CheckCircle2, XCircle, Ticket, BarChart3, Flame, Loader2, Zap, MapPin, ExternalLink, Timer, TrendingUp, User, Shield, Gavel, RefreshCw, Target, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AppUser } from '@/contexts/AuthContext';
import type { Championship } from './ChampionnatTab';
import {
  getEquipes, getTeamChampionship, getTousMatchsAvenir,
  mapClassementToStandings, getClassement,
  OISEMONT_CL_NO, decodeFFFApiRef, getOisemontDisplayName,
  type FFFMonthGroup, type FFFLiveMatch, type ScrapedStanding
} from '@/lib/fffApi';
import BetModal, { generateOdds, type BetPlacementPayload } from './BetModal';
import BetLeaderboard from './BetLeaderboard';
import parisHeroBg from '@/assets/paris-hero-bg.jpg';
import matchCardBg from '@/assets/match-card-bg.jpg';

interface Bet {
  id: string;
  userId: string;
  userName: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  prediction: string;
  odds: number;
  amount: number;
  payout: number;
  status: string;
  createdAt: string;
  team: string | null;
  betType: string;
  scorerPlayerId: string | null;
  scorerPlayerName: string | null;
  predictedScoreHome: number | null;
  predictedScoreAway: number | null;
}

interface Props {
  currentUser: AppUser | null;
  championships: Championship[];
}

const mapBet = (r: any): Bet => ({
  id: r.id, userId: r.user_id, userName: r.user_name,
  homeTeam: r.home_team, awayTeam: r.away_team, matchDate: r.match_date,
  prediction: r.prediction, odds: r.odds, amount: r.amount, payout: r.payout,
  status: r.status, createdAt: r.created_at, team: r.team || null,
  betType: r.bet_type || 'match',
  scorerPlayerId: r.scorer_player_id || null,
  scorerPlayerName: r.scorer_player_name || null,
  predictedScoreHome: r.predicted_score_home ?? null,
  predictedScoreAway: r.predicted_score_away ?? null,
});

type TabFilter = 'upcoming' | 'my-bets' | 'leaderboard' | 'settle';

const STATUS_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  pending: { icon: Clock, label: 'En cours', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  won: { icon: CheckCircle2, label: 'Gagné', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  lost: { icon: XCircle, label: 'Perdu', color: 'text-destructive', bg: 'bg-destructive/10' },
};

const BASE_TEAMS = ['A', 'B', 'C'];

function getBetLabel(bet: Bet): string {
  if (bet.betType === 'scorer') return `⚽ ${bet.scorerPlayerName || '?'}`;
  if (bet.betType === 'exact_score') return `📊 ${bet.predictedScoreHome ?? 0}-${bet.predictedScoreAway ?? 0}`;
  return bet.prediction === 'home' ? bet.homeTeam : bet.prediction === 'away' ? bet.awayTeam : 'Nul';
}

function getBetTypeTag(betType: string): { label: string; color: string } {
  if (betType === 'scorer') return { label: 'Buteur', color: 'text-purple-500 bg-purple-500/10' };
  if (betType === 'exact_score') return { label: 'Score', color: 'text-blue-500 bg-blue-500/10' };
  return { label: 'Résultat', color: 'text-accent bg-accent/10' };
}

function buildLocationLink(terrain?: { city?: string; name?: string }) {
  if (!terrain) return null;
  const parts = [terrain.name, terrain.city].filter(Boolean).join(', ');
  if (!parts) return null;
  return `https://waze.com/ul?q=${encodeURIComponent(parts)}&navigate=yes`;
}

// Manual time overrides for matches where kickoff was rearranged outside FFF
const MATCH_TIME_OVERRIDES: Record<string, string> = {
  // GAMACHES AS vs OISEMONT FC — 12 avril 2026 — arrangement avec Gamache
  '2026-04-12__GAMACHES': '13:00',
};

function applyTimeOverrides(upcoming: FFFMonthGroup[]): FFFMonthGroup[] {
  return upcoming.map(group => ({
    ...group,
    matchs: group.matchs.map(m => {
      const dateKey = normalizeDateKey(m.date);
      for (const [key, newTime] of Object.entries(MATCH_TIME_OVERRIDES)) {
        const [d, teamFragment] = key.split('__');
        if (dateKey === d) {
          const home = (m.home?.short_name || m.home?.name || '').toUpperCase();
          const away = (m.away?.short_name || m.away?.name || '').toUpperCase();
          if (home.includes(teamFragment) || away.includes(teamFragment)) {
            return { ...m, time: newTime };
          }
        }
      }
      return m;
    }),
  }));
}

function normalizeDateKey(dateStr?: string) {
  if (!dateStr) return '';
  const direct = /^\d{4}-\d{2}-\d{2}/.exec(dateStr)?.[0];
  if (direct) return direct;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toISOString().split('T')[0];
}

function normalizeTeamName(name?: string) {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(FC|SC|AC|RC|US|AS|CS|ES|JS|STADE|SPORTING|OLYMPIQUE)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeTeamTokens(name?: string) {
  return normalizeTeamName(name)
    .split(' ')
    .map(token => token.replace(/S$/g, ''))
    .filter(token => token.length >= 3)
    .sort();
}

function teamsLikelyMatch(a?: string, b?: string) {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ta = normalizeTeamTokens(a);
  const tb = normalizeTeamTokens(b);
  if (!ta.length || !tb.length) return false;

  const sameTokens = ta.join(' ') === tb.join(' ');
  if (sameTokens) return true;

  const overlap = ta.filter(token => tb.includes(token));
  return overlap.length > 0 && overlap.length === Math.min(ta.length, tb.length);
}

function getMatchTeamName(side?: { short_name?: string; name?: string; club?: { cl_no?: number } }) {
  return side?.short_name || side?.name || '';
}

function getDisplayTeamName(side?: { short_name?: string; name?: string; club?: { cl_no?: number } }, teamCategory?: string) {
  const raw = side?.short_name || side?.name || '';
  return getOisemontDisplayName(raw, teamCategory);
}

const ParisTab: React.FC<Props> = ({ currentUser, championships }) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [betsLoaded, setBetsLoaded] = useState(false);
  const [balance, setBalance] = useState(100);
  const [activeFilter, setActiveFilter] = useState<TabFilter>('upcoming');
  const [betModal, setBetModal] = useState<{ home: string; away: string; date: string; homeLogo?: string; awayLogo?: string; team?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string>('A');
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [convocatedPlayers, setConvocatedPlayers] = useState<{ id: string; name: string; position: string }[]>([]);

  // Per-team FFF data
  const [teamData, setTeamData] = useState<Record<string, { upcoming: FFFMonthGroup[]; classement: ScrapedStanding[]; loading: boolean }>>({});
  const [profilePhotos, setProfilePhotos] = useState<Record<string, string | null>>({});
  const loadingTeamsRef = useRef<Set<string>>(new Set());
  const retryCountRef = useRef<Record<string, number>>({});
  const equipesCache = useRef<any>(null);

  // Countdown
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const customTeams = [...new Set(championships.map(c => c.team || 'A').filter(t => !BASE_TEAMS.includes(t)))].sort();
  const allTeamOptions = [...BASE_TEAMS, ...customTeams];

  // Resolve real auth user id + load bets & balance
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const sessionUserId = authData.user?.id ?? null;
      if (mounted) setAuthUserId(sessionUserId);

      if (!sessionUserId) {
        if (mounted) setLoading(false);
        return;
      }

      const [{ data: betsData }, { data: pointsData }] = await Promise.all([
        supabase.from('bets').select('*').order('created_at', { ascending: false }),
        supabase.from('user_points').select('balance').eq('user_id', sessionUserId).maybeSingle(),
      ]);

      if (!mounted) return;
      if (betsData) { setBets(betsData.map(mapBet)); setBetsLoaded(true); }
      if (pointsData) setBalance(pointsData.balance);
      else setBalance(100);
      setLoading(false);
    };

    fetchData();

    const channel = supabase.channel('paris-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => {
        supabase.from('bets').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setBets(data.map(mapBet)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_points' }, (payload: any) => {
        if (payload.new?.user_id === authUserId && typeof payload.new?.balance === 'number') setBalance(payload.new.balance);
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [authUserId]);

  // Re-fetch bets when coming back online (airplane mode fix)
  useEffect(() => {
    if (betsLoaded) return;
    const handleOnline = () => {
      if (!authUserId) return;
      Promise.all([
        supabase.from('bets').select('*').order('created_at', { ascending: false }),
        supabase.from('user_points').select('balance').eq('user_id', authUserId).maybeSingle(),
      ]).then(([{ data: betsData }, { data: pointsData }]) => {
        if (betsData) { setBets(betsData.map(mapBet)); setBetsLoaded(true); }
        if (pointsData) setBalance(pointsData.balance);
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [betsLoaded, authUserId]);

  // Load profile photos for bettors
  useEffect(() => {
    if (!bets.length) return;
    const userIds = [...new Set(bets.map(b => b.userId))].filter(id => !(id in profilePhotos));
    if (!userIds.length) return;
    supabase.from('profiles').select('id, photo_url').in('id', userIds).then(({ data }) => {
      if (data) {
        setProfilePhotos(prev => {
          const next = { ...prev };
          data.forEach(p => { next[p.id] = p.photo_url; });
          return next;
        });
      }
    });
  }, [bets]);

  const [refreshing, setRefreshing] = useState(false);

  const loadTeamFFFData = useCallback(async (team: string, forceRefresh = false) => {
    // Prevent duplicate concurrent loads (unless force refresh)
    if (!forceRefresh && loadingTeamsRef.current.has(team)) return;

    const LOCAL_CACHE_VERSION = 'v2';
    const LOCAL_CACHE_KEY = `paris_fff_${LOCAL_CACHE_VERSION}_${team}`;
    const LOCAL_CACHE_TTL = 2 * 60 * 60 * 1000; // 2h

    // Check local cache first (skip on force refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(LOCAL_CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < LOCAL_CACHE_TTL && data) {
            const classement = data.classement && Array.isArray(data.classement)
              ? mapClassementToStandings(data.classement) : [];
            setTeamData(prev => {
              if (prev[team] && !prev[team].loading) return prev;
              return { ...prev, [team]: { upcoming: data.upcoming || [], classement, loading: false } };
            });
            return;
          }
        }
      } catch {}
    }

    const teamMapping: Record<string, { categoryCode: string; code: number }> = {
      'A': { categoryCode: 'SEM', code: 1 },
      'B': { categoryCode: 'SEM', code: 2 },
      'C': { categoryCode: 'SEM', code: 3 },
    };

    const mapping = teamMapping[team];
    let customParams: { cpNo: number; phase: number; poule: number } | null = null;

    if (!mapping) {
      const customChamp = championships.find(c => (c.team || 'A') === team && c.fffUrl);
      if (customChamp?.fffUrl) customParams = decodeFFFApiRef(customChamp.fffUrl);
      if (!customParams) {
        setTeamData(prev => ({ ...prev, [team]: { upcoming: [], classement: [], loading: false } }));
        return;
      }
    }

    // Check DB cache (6 days like ChampionnatTab)
    const CACHE_MAX_AGE = 6 * 24 * 60 * 60 * 1000;
    const teamChamp = championships.find(c => (c.team || 'A') === team && c.fffLiveCache && c.fffRefreshedAt);
    const cacheAge = teamChamp?.fffRefreshedAt ? Date.now() - new Date(teamChamp.fffRefreshedAt).getTime() : Infinity;

    if (!forceRefresh && teamChamp?.fffLiveCache && cacheAge < CACHE_MAX_AGE) {
      const cache = teamChamp.fffLiveCache;
      const classement = cache.classement && Array.isArray(cache.classement)
        ? mapClassementToStandings(cache.classement) : [];
      setTeamData(prev => ({ ...prev, [team]: { upcoming: cache.upcoming || [], classement, loading: false } }));
      try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ data: cache, ts: Date.now() })); } catch {}
      return;
    }

    loadingTeamsRef.current.add(team);
    setTeamData(prev => ({ ...prev, [team]: { upcoming: prev[team]?.upcoming || [], classement: prev[team]?.classement || [], loading: true } }));

    try {
      let champParams = customParams;
      if (!champParams && mapping) {
        // Cache getEquipes call across teams
        if (!equipesCache.current) {
          equipesCache.current = await getEquipes(OISEMONT_CL_NO);
        }
        const equipes = Array.isArray(equipesCache.current) ? equipesCache.current : equipesCache.current?.equipes || [];
        champParams = getTeamChampionship(equipes, mapping.categoryCode, mapping.code);
      }
      if (!champParams) {
        setTeamData(prev => ({ ...prev, [team]: { upcoming: [], classement: [], loading: false } }));
        return;
      }

      const [upcoming, classementData] = await Promise.all([
        getTousMatchsAvenir(champParams.cpNo, champParams.phase, champParams.poule),
        getClassement(champParams.cpNo, champParams.phase, champParams.poule).catch(() => null),
      ]);

      let classement: ScrapedStanding[] = [];
      let rawClassement: any = null;
      if (classementData) {
        const members = classementData?.['hydra:member'] || classementData;
        if (Array.isArray(members)) {
          classement = mapClassementToStandings(members);
          rawClassement = members;
        }
      }

      setTeamData(prev => ({ ...prev, [team]: { upcoming: applyTimeOverrides(upcoming), classement, loading: false } }));
      try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ data: { upcoming, classement: rawClassement }, ts: Date.now() })); } catch {}
    } catch (err) {
      console.error(`Error loading FFF for team ${team}:`, err);
      setTeamData(prev => ({ ...prev, [team]: { upcoming: [], classement: [], loading: false } }));
    } finally {
      loadingTeamsRef.current.delete(team);
    }
  }, [championships]);

  // Load selected team data
  useEffect(() => {
    void loadTeamFFFData(selectedTeam);
  }, [selectedTeam, loadTeamFFFData]);

  // Preload all teams on mount for faster switching
  useEffect(() => {
    allTeamOptions.forEach(team => {
      void loadTeamFFFData(team);
    });
  }, [loadTeamFFFData]);

  // Auto-retry: if selected team finished loading but has no data, retry once
  useEffect(() => {
    const data = teamData[selectedTeam];
    if (data && !data.loading && data.upcoming.length === 0 && !loadingTeamsRef.current.has(selectedTeam)) {
      const retries = retryCountRef.current[selectedTeam] || 0;
      if (retries >= 2) return; // Max 2 auto-retries
      retryCountRef.current[selectedTeam] = retries + 1;
      const timer = setTimeout(() => {
        void loadTeamFFFData(selectedTeam, true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    // Reset retry counter if we got data
    if (teamData[selectedTeam]?.upcoming?.length > 0) {
      retryCountRef.current[selectedTeam] = 0;
    }
  }, [selectedTeam, teamData, loadTeamFFFData]);

  // Manual refresh handler
  const handleForceRefresh = useCallback(async () => {
    setRefreshing(true);
    // Clear local cache for selected team
    try { localStorage.removeItem(`paris_fff_v2_${selectedTeam}`); } catch {}
    // Reset team data to trigger loading state
    setTeamData(prev => ({ ...prev, [selectedTeam]: { upcoming: [], classement: [], loading: true } }));
    await loadTeamFFFData(selectedTeam, true);
    setRefreshing(false);
    toast.success('Matchs actualisés');
  }, [selectedTeam, loadTeamFFFData]);

  // Current team data
  const currentData = teamData[selectedTeam] || { upcoming: [], classement: [], loading: true };

  const isMatchStarted = (matchDate: string, matchTime?: string): boolean => {
    if (!matchDate) return false;
    const mDate = new Date(matchDate);
    const now = new Date();
    const matchDay = mDate.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    if (matchDay < today) return true;
    if (matchDay > today) return false;
    if (!matchTime) return true;

    const timeParts = matchTime.replace('H', ':').split(':');
    const kickoffHour = parseInt(timeParts[0], 10);
    const kickoffMin = parseInt(timeParts[1] || '0', 10);
    if (Number.isNaN(kickoffHour)) return true;

    const kickoff = new Date(now);
    kickoff.setHours(kickoffHour, kickoffMin, 0, 0);
    return now.getTime() >= kickoff.getTime();
  };

  // Helper: check if a match date+time is finished (3h after kickoff)
  const isMatchFinished = (matchDate: string, matchTime?: string): boolean => {
    if (!matchDate) return false;
    const mDate = new Date(matchDate);
    const now = new Date();
    const matchDay = mDate.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    if (matchDay < today) return true;
    if (matchDay > today) return false;
    if (!matchTime) return false;

    const timeParts = matchTime.replace('H', ':').split(':');
    const kickoffHour = parseInt(timeParts[0], 10);
    const kickoffMin = parseInt(timeParts[1] || '0', 10);
    if (Number.isNaN(kickoffHour)) return false;

    const kickoff = new Date(now);
    kickoff.setHours(kickoffHour, kickoffMin, 0, 0);
    return (now.getTime() - kickoff.getTime()) / 60000 > 180;
  };

  // Helper: match is fully settled = match finished AND no pending bets left (no FFF score needed)
  const isMatchSettled = useCallback((match: FFFLiveMatch) => {
    if (!isMatchFinished(match.date, match.time)) return false;
    // Don't skip any finished match until bets are fully loaded,
    // otherwise an empty array makes us think everything is settled
    if (!betsLoaded) return false;
    const homeName = getMatchTeamName(match.home);
    const awayName = getMatchTeamName(match.away);
    const hasPending = bets.some(bet =>
      bet.status === 'pending' &&
      normalizeDateKey(bet.matchDate) === normalizeDateKey(match.date) &&
      teamsLikelyMatch(bet.homeTeam, homeName) &&
      teamsLikelyMatch(bet.awayTeam, awayName)
    );
    return !hasPending;
  }, [bets, betsLoaded]);

  // Next match for selected team: only skip matches that have a score AND no pending bets
  const nextMatch: FFFLiveMatch | null = useMemo(() => {
    for (const group of currentData.upcoming) {
      for (const m of group.matchs) {
        if (!m.date) continue;
        if (!isMatchSettled(m)) return m;
      }
    }
    return null;
  }, [currentData.upcoming, isMatchSettled]);

  // Countdown timer
  useEffect(() => {
    if (!nextMatch?.date) return;
    const target = new Date(nextMatch.date);
    // Include match kick-off time if available
    if (nextMatch.time) {
      const [h, m] = nextMatch.time.split(':').map(Number);
      if (!isNaN(h)) target.setHours(h, m || 0, 0, 0);
    }
    const update = () => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) { setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextMatch?.date, nextMatch?.time]);

  // Match status: 'live' (during 100min window), 'waiting' (after 100min, same day), false (not today)
  const getMatchStatus = (matchDate: string, matchTime?: string): 'live' | 'waiting' | false => {
    const today = new Date().toISOString().split('T')[0];
    const mDate = new Date(matchDate).toISOString().split('T')[0];
    if (today !== mDate) return false;

    if (!matchTime) return 'live'; // No time info → assume live all day

    // Parse time like "15H00" or "15:00"
    const timeParts = matchTime.replace('H', ':').split(':');
    const kickoffHour = parseInt(timeParts[0], 10);
    const kickoffMin = parseInt(timeParts[1] || '0', 10);
    if (isNaN(kickoffHour)) return 'live';

    const now = new Date();
    const kickoff = new Date(now);
    kickoff.setHours(kickoffHour, kickoffMin, 0, 0);

    const diffMin = (now.getTime() - kickoff.getTime()) / 60000;

    if (diffMin < 0) return false; // Before kickoff
    if (diffMin <= 60) return 'live'; // During match (~60min)
    return 'waiting'; // Match over, waiting for result
  };

  // Backward compat helper
  const isMatchLive = (matchDate: string, matchTime?: string) => {
    const status = getMatchStatus(matchDate, matchTime);
    return status === 'live';
  };

  const myBets = useMemo(() => bets.filter(b => b.userId === authUserId), [bets, authUserId]);
  const myPendingBets = myBets.filter(b => b.status === 'pending');
  const myWonBets = myBets.filter(b => b.status === 'won');
  const myLostBets = myBets.filter(b => b.status === 'lost');

  // All pending bets from all users (for public view in "Matchs" tab)
  const allPendingBets = useMemo(() => bets.filter(b => b.status === 'pending'), [bets]);

  // Count pending bets for a specific match (filtered by team to avoid cross-category duplicates)
  const getPendingBetsForMatch = (homeTeam: string, awayTeam: string, matchDate: string, team?: string) =>
    allPendingBets.filter(b =>
      teamsLikelyMatch(b.homeTeam, homeTeam) &&
      teamsLikelyMatch(b.awayTeam, awayTeam) &&
      normalizeDateKey(b.matchDate) === normalizeDateKey(matchDate) &&
      (team ? b.team === team : true)
    );

  const hasBetOnMatch = (homeTeam: string, awayTeam: string, matchDate: string, team?: string) =>
    !betsLoaded || myBets.some(b =>
      teamsLikelyMatch(b.homeTeam, homeTeam) &&
      teamsLikelyMatch(b.awayTeam, awayTeam) &&
      normalizeDateKey(b.matchDate) === normalizeDateKey(matchDate) &&
      (team ? b.team === team : true)
    );

  const isAdminPlus = currentUser?.role === 'admin+';

  const filters: { id: TabFilter; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'upcoming', label: 'Matchs', icon: Flame },
    { id: 'my-bets', label: 'Mes Paris', icon: Ticket, count: myPendingBets.length },
    { id: 'leaderboard', label: 'Classement', icon: BarChart3 },
    ...(isAdminPlus ? [{ id: 'settle' as TabFilter, label: 'Régler', icon: Gavel, count: allPendingBets.length }] : []),
  ];

  // Settlement state for admin+
  const [settleScores, setSettleScores] = useState<Record<string, { home: string; away: string }>>({});
  const [settlingMatch, setSettlingMatch] = useState<string | null>(null);
  const [settleScorers, setSettleScorers] = useState<Record<string, string[]>>({}); // matchKey -> player_id[]
  const [settlingScorers, setSettlingScorers] = useState<string | null>(null);
  const [settlePlayersList, setSettlePlayersList] = useState<Record<string, { id: string; name: string; position: string }[]>>({});

  // Group pending bets by normalized match for settlement
  const pendingMatchGroups = useMemo(() => {
    const normalizeDate = (dateStr: string) => {
      if (!dateStr) return '';
      const direct = /^\d{4}-\d{2}-\d{2}/.exec(dateStr)?.[0];
      if (direct) return direct;
      const d = new Date(dateStr);
      return Number.isNaN(d.getTime()) ? dateStr : d.toISOString().split('T')[0];
    };

    const groups = new Map<string, { homeTeam: string; awayTeam: string; matchDate: string; bets: Bet[] }>();
    for (const bet of allPendingBets) {
      const normalizedDate = normalizeDate(bet.matchDate);
      const key = `${bet.homeTeam}||${bet.awayTeam}||${normalizedDate}`;
      if (!groups.has(key)) {
        groups.set(key, { homeTeam: bet.homeTeam, awayTeam: bet.awayTeam, matchDate: normalizedDate || bet.matchDate, bets: [] });
      }
      groups.get(key)!.bets.push(bet);
    }
    return [...groups.values()];
  }, [allPendingBets]);

  const settleTeams = BASE_TEAMS;

  const settleCards = useMemo(() => {
    return settleTeams.map((team) => {
      const data = teamData[team] || { upcoming: [], classement: [], loading: true };
      const allMatches = data.upcoming.flatMap(group => group.matchs);

      // Only consider bets that belong to THIS team category
      const teamPendingBets = allPendingBets.filter(b => b.team === team);

      const pendingBetGroups = teamPendingBets.reduce<Array<{ homeTeam: string; awayTeam: string; matchDate: string; bets: Bet[] }>>((groups, bet) => {
        const existingGroup = groups.find(group =>
          normalizeDateKey(group.matchDate) === normalizeDateKey(bet.matchDate)
          && teamsLikelyMatch(group.homeTeam, bet.homeTeam)
          && teamsLikelyMatch(group.awayTeam, bet.awayTeam)
        );

        if (existingGroup) {
          existingGroup.bets.push(bet);
        } else {
          groups.push({
            homeTeam: bet.homeTeam,
            awayTeam: bet.awayTeam,
            matchDate: bet.matchDate,
            bets: [bet],
          });
        }

        return groups;
      }, []).sort((a, b) => normalizeDateKey(a.matchDate).localeCompare(normalizeDateKey(b.matchDate)));

      // Helper: check if a match still has unsettled pending bets for THIS team
      const matchHasPendingBets = (match: any) => {
        const homeName = getMatchTeamName(match.home);
        const awayName = getMatchTeamName(match.away);
        return teamPendingBets.some(bet =>
          normalizeDateKey(bet.matchDate) === normalizeDateKey(match.date)
          && teamsLikelyMatch(bet.homeTeam, homeName)
          && teamsLikelyMatch(bet.awayTeam, awayName)
        );
      };

      // A match is "done" if it's finished (time-based) AND no pending bets remain
      const isMatchDone = (match: any) => {
        return isMatchFinished(match.date, match.time) && !matchHasPendingBets(match);
      };

      const lockedPendingGroup = pendingBetGroups.find((group) => {
        const matchingFFFMatch = allMatches.find((match) => {
          const homeName = getMatchTeamName(match.home);
          const awayName = getMatchTeamName(match.away);

          return normalizeDateKey(match.date) === normalizeDateKey(group.matchDate)
            && teamsLikelyMatch(group.homeTeam, homeName)
            && teamsLikelyMatch(group.awayTeam, awayName);
        });

        if (!matchingFFFMatch) {
          return isMatchStarted(group.matchDate);
        }

        return isMatchStarted(matchingFFFMatch.date, matchingFFFMatch.time);
      });

      // Tant qu'un match commencé n'est pas réglé, on reste dessus.
      let nextTeamMatch: any = null;

      if (lockedPendingGroup) {
        nextTeamMatch = allMatches.find((match) => {
          const homeName = getMatchTeamName(match.home);
          const awayName = getMatchTeamName(match.away);

          return normalizeDateKey(match.date) === normalizeDateKey(lockedPendingGroup.matchDate)
            && teamsLikelyMatch(lockedPendingGroup.homeTeam, homeName)
            && teamsLikelyMatch(lockedPendingGroup.awayTeam, awayName);
        }) || {
          date: lockedPendingGroup.matchDate,
          time: null,
          home: { short_name: lockedPendingGroup.homeTeam, club: {} },
          away: { short_name: lockedPendingGroup.awayTeam, club: {} },
          _synthetic: true,
        };
      }

      // Sinon, on prend le premier match non terminé normalement
      if (!nextTeamMatch) {
        nextTeamMatch = allMatches.find(m => m.date && !isMatchDone(m)) || null;
      }

      // Fallback: if no upcoming FFF match found but there are pending bets,
      // create a synthetic match entry from bet data (happens when FFF already published the score)
      if (!nextTeamMatch && teamPendingBets.length > 0) {
        const firstBet = teamPendingBets[0];
        nextTeamMatch = {
          date: firstBet.matchDate,
          time: null,
          home: { short_name: firstBet.homeTeam, club: {} },
          away: { short_name: firstBet.awayTeam, club: {} },
          _synthetic: true,
        };
      }

      const teamMatchBets = teamPendingBets.filter((bet) => {
        if (!nextTeamMatch) return false;
        const homeName = getMatchTeamName(nextTeamMatch.home);
        const awayName = getMatchTeamName(nextTeamMatch.away);
        return normalizeDateKey(bet.matchDate) === normalizeDateKey(nextTeamMatch.date)
          && teamsLikelyMatch(bet.homeTeam, homeName)
          && teamsLikelyMatch(bet.awayTeam, awayName);
      });

      const matchKey = nextTeamMatch
        ? `${team}||${normalizeTeamName(getMatchTeamName(nextTeamMatch.home))}||${normalizeTeamName(getMatchTeamName(nextTeamMatch.away))}||${normalizeDateKey(nextTeamMatch.date)}`
        : `team-${team}`;

      return {
        team,
        loading: data.loading,
        match: nextTeamMatch,
        bets: teamMatchBets,
        matchKey,
      };
    });
  }, [teamData, allPendingBets]);

  useEffect(() => {
    if (activeFilter !== 'settle' || !isAdminPlus) return;
    settleTeams.forEach((team) => {
      if (!teamData[team] || teamData[team].loading) {
        void loadTeamFFFData(team);
      }
    });
  }, [activeFilter, isAdminPlus, loadTeamFFFData, teamData]);

  const handleSettle = useCallback(async (matchKey: string, homeTeam: string, awayTeam: string, betsForMatch: Bet[]) => {
    const scores = settleScores[matchKey];
    if (!scores || scores.home === '' || scores.away === '') {
      toast.error('Entre les deux scores');
      return;
    }
    const homeScore = parseInt(scores.home, 10);
    const awayScore = parseInt(scores.away, 10);
    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
      toast.error('Scores invalides');
      return;
    }
    if (!betsForMatch.length) {
      toast.error('Aucun pari en attente sur ce match');
      return;
    }

    setSettlingMatch(matchKey);
    try {
      let totalSettled = 0;
      let finalResult: any = null;
      // Group bets by their exact stored team names + date to settle correctly
      const betGroups = new Map<string, { homeTeam: string; awayTeam: string; matchDate: string }>();
      for (const b of betsForMatch) {
        const key = `${b.homeTeam}||${b.awayTeam}||${b.matchDate}`;
        if (!betGroups.has(key)) betGroups.set(key, { homeTeam: b.homeTeam, awayTeam: b.awayTeam, matchDate: b.matchDate });
      }

      for (const group of betGroups.values()) {
        const { data, error } = await supabase.rpc('settle_match_bets', {
          p_home_team: group.homeTeam,
          p_away_team: group.awayTeam,
          p_match_date: group.matchDate,
          p_home_score: homeScore,
          p_away_score: awayScore,
        });
        if (error) throw error;
        const result = data as any;
        totalSettled += result?.settled || 0;
        finalResult = result;
      }

      const resultLabel = finalResult?.result === 'home' ? homeTeam : finalResult?.result === 'away' ? awayTeam : 'Match nul';
      toast.success(`${totalSettled} pari${totalSettled > 1 ? 's' : ''} réglé${totalSettled > 1 ? 's' : ''} — ${resultLabel} (${homeScore}-${awayScore})`);
      setSettleScores(prev => { const next = { ...prev }; delete next[matchKey]; return next; });
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du règlement');
    } finally {
      setSettlingMatch(null);
    }
  }, [settleScores]);

  const handleSettleScorers = useCallback(async (matchKey: string, homeTeam: string, awayTeam: string, betsForMatch: Bet[]) => {
    const scorerIds = settleScorers[matchKey] || [];
    if (scorerIds.length === 0) {
      toast.error('Sélectionne au moins un buteur');
      return;
    }
    const scorerBets = betsForMatch.filter(b => b.betType === 'scorer');
    if (scorerBets.length === 0) {
      toast.error('Aucun pari buteur à régler');
      return;
    }
    setSettlingScorers(matchKey);
    try {
      const betGroups = new Map<string, { homeTeam: string; awayTeam: string; matchDate: string }>();
      for (const b of scorerBets) {
        const key = `${b.homeTeam}||${b.awayTeam}||${b.matchDate}`;
        if (!betGroups.has(key)) betGroups.set(key, { homeTeam: b.homeTeam, awayTeam: b.awayTeam, matchDate: b.matchDate });
      }
      let totalSettled = 0;
      for (const group of betGroups.values()) {
        const { data, error } = await supabase.rpc('settle_scorer_bets', {
          p_home_team: group.homeTeam,
          p_away_team: group.awayTeam,
          p_match_date: group.matchDate,
          p_scorer_player_ids: scorerIds,
        } as any);
        if (error) throw error;
        totalSettled += (data as any)?.settled || 0;
      }
      toast.success(`${totalSettled} pari${totalSettled > 1 ? 's' : ''} buteur réglé${totalSettled > 1 ? 's' : ''}`);
      setSettleScorers(prev => { const next = { ...prev }; delete next[matchKey]; return next; });
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du règlement');
    } finally {
      setSettlingScorers(null);
    }
  }, [settleScorers]);

  const handleBetPlaced = useCallback((bet: BetPlacementPayload) => {
    setBets(prev => {
      const alreadyExists = prev.some(existing =>
        existing.userId === bet.userId &&
        teamsLikelyMatch(existing.homeTeam, bet.homeTeam) &&
        teamsLikelyMatch(existing.awayTeam, bet.awayTeam) &&
        normalizeDateKey(existing.matchDate) === normalizeDateKey(bet.matchDate)
      );

      if (alreadyExists) return prev;

      return [{
        id: `local-${bet.userId}-${Date.now()}`,
        userId: bet.userId,
        userName: bet.userName,
        homeTeam: bet.homeTeam,
        awayTeam: bet.awayTeam,
        matchDate: bet.matchDate,
        prediction: bet.prediction,
        odds: bet.odds,
        amount: bet.amount,
        payout: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        team: bet.team || null,
        betType: bet.betType || 'match',
        scorerPlayerId: bet.scorerPlayerId || null,
        scorerPlayerName: bet.scorerPlayerName || null,
        predictedScoreHome: bet.predictedScoreHome ?? null,
        predictedScoreAway: bet.predictedScoreAway ?? null,
      }, ...prev];
    });

    setBalance(Number.isFinite(bet.newBalance) ? bet.newBalance : Math.max(0, balance - bet.amount));
  }, [balance]);

  const totalPotentialGain = myPendingBets.reduce((sum, b) => sum + Math.round(b.amount * b.odds), 0);

  return (
    <div className="space-y-4">
      {/* ── Hero Header (stadium night) ── */}
      <div className="relative overflow-hidden rounded-3xl shadow-lg shadow-primary/20">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${parisHeroBg})` }}
        />
        {/* Dark overlays for legibility */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/80 to-primary/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {/* Accent glow */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-accent/30 blur-3xl pointer-events-none" />

        <div className="relative p-5">
          {/* Top row : title + refresh */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center">
                <Trophy className="text-white" size={17} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-white/70 uppercase tracking-[0.18em] leading-none">Pronostics</p>
                <h2 className="text-lg font-black text-white leading-tight">Mes Paris</h2>
              </div>
            </div>
            <button
              onClick={handleForceRefresh}
              disabled={refreshing || currentData.loading}
              className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/25 transition-all disabled:opacity-40"
              title="Actualiser les matchs"
            >
              <RefreshCw size={14} className={cn("text-white", (refreshing || currentData.loading) && "animate-spin")} />
            </button>
          </div>

          {/* Balance hero */}
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">Solde</p>
              <div className="flex items-baseline gap-1.5">
                <Coins size={22} className="text-amber-300 drop-shadow-md self-center" />
                <span className="text-3xl font-black text-white drop-shadow-md leading-none">{balance}</span>
                <span className="text-xs font-bold text-white/70 ml-0.5">pts</span>
              </div>
            </div>
            {myPendingBets.length > 0 && (
              <div className="text-right">
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">En cours</p>
                <p className="text-sm font-black text-white">
                  {myPendingBets.length} pari{myPendingBets.length > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

          {/* Mini stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-2 py-2 text-center">
              <div className="text-base font-black text-white leading-none">{myBets.length}</div>
              <div className="text-[9px] font-semibold text-white/70 uppercase tracking-wider mt-1">Total</div>
            </div>
            <div className="bg-emerald-400/15 backdrop-blur-md border border-emerald-300/25 rounded-xl px-2 py-2 text-center">
              <div className="text-base font-black text-emerald-300 leading-none">{myWonBets.length}</div>
              <div className="text-[9px] font-semibold text-emerald-200/90 uppercase tracking-wider mt-1">Gagnés</div>
            </div>
            <div className="bg-red-400/15 backdrop-blur-md border border-red-300/25 rounded-xl px-2 py-2 text-center">
              <div className="text-base font-black text-red-200 leading-none">{myLostBets.length}</div>
              <div className="text-[9px] font-semibold text-red-200/90 uppercase tracking-wider mt-1">Perdus</div>
            </div>
          </div>
        </div>
      </div>

      {/* Team selector */}
      <div className="flex items-center gap-1.5 bg-secondary/60 backdrop-blur-sm rounded-xl border border-border/50 p-1">
        {allTeamOptions.map(team => (
          <button
            key={team}
            onClick={() => setSelectedTeam(team)}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
              selectedTeam === team
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {BASE_TEAMS.includes(team) ? `Équipe ${team}` : team}
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex bg-secondary/50 rounded-xl p-1 border border-border/50">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap flex-1",
              activeFilter === f.id
                ? 'bg-card text-foreground shadow-sm border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="relative">
              <f.icon size={14} className="shrink-0" />
              {f.count !== undefined && f.count > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] rounded-full bg-accent text-accent-foreground text-[8px] font-bold flex items-center justify-center px-0.5">
                  {f.count}
                </span>
              )}
            </div>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* ═══ MATCHS TAB ═══ */}
        {activeFilter === 'upcoming' && (
          <motion.div key="upcoming" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {currentData.loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 size={24} className="text-accent animate-spin" />
                <span className="text-xs text-muted-foreground">Chargement des matchs...</span>
              </div>
            ) : !nextMatch ? (
              <div className="text-center py-12 text-muted-foreground">
                <Flame size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun match à venir</p>
                <p className="text-xs mt-1">Les prochains matchs de l'équipe {selectedTeam} apparaîtront ici</p>
              </div>
            ) : (() => {
              const matchStatus = nextMatch.date ? getMatchStatus(nextMatch.date, nextMatch.time) : false;
              const live = matchStatus === 'live';
              const waiting = matchStatus === 'waiting';
              const homeName = getDisplayTeamName(nextMatch.home, selectedTeam);
              const awayName = getDisplayTeamName(nextMatch.away, selectedTeam);
              const homeLogo = nextMatch.home?.club?.logo;
              const awayLogo = nextMatch.away?.club?.logo;
              const alreadyBet = hasBetOnMatch(homeName, awayName, nextMatch.date || '', selectedTeam);
              const matchBets = getPendingBetsForMatch(homeName, awayName, nextMatch.date || '', selectedTeam);

              // Ranks for smart odds
              const homeClNo = nextMatch.home?.club?.cl_no;
              const awayClNo = nextMatch.away?.club?.cl_no;
              const homeStanding = currentData.classement.find(s => s.clNo === homeClNo);
              const awayStanding = currentData.classement.find(s => s.clNo === awayClNo);
              const homeRank = homeStanding?.rank;
              const awayRank = awayStanding?.rank;
              const odds = generateOdds(homeName, awayName, nextMatch.date || '', homeRank, awayRank, currentData.classement.length || undefined);
              const locationLink = buildLocationLink(nextMatch.terrain);
              const locationLabel = [nextMatch.terrain?.name, nextMatch.terrain?.city].filter(Boolean).join(', ');

              return (
                <>
                  {/* Match card — premium minimal */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`relative overflow-hidden rounded-[28px] border bg-card shadow-lg ${
                      live
                        ? 'border-red-500/40 ring-1 ring-red-500/20'
                        : waiting
                          ? 'border-amber-500/40 ring-1 ring-amber-500/20'
                          : 'border-border/70'
                    }`}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-44 bg-cover bg-center opacity-[0.07] pointer-events-none"
                      style={{ backgroundImage: `url(${matchCardBg})` }}
                    />
                    <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none" />
                    <div className="absolute top-4 right-4 h-20 w-20 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

                    {live && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-400 to-red-500 animate-pulse z-10" />
                    )}
                    {waiting && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 z-10" />
                    )}

                    <div className="relative px-5 py-5">
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
                            <Timer size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                              Prochain match
                            </p>
                            <h3 className="truncate text-lg font-black text-foreground">
                              Équipe {selectedTeam}
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {live && (
                            <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white animate-pulse">
                              <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                              LIVE
                            </span>
                          )}
                          {waiting && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-600">
                              <Clock size={10} />
                              En attente
                            </span>
                          )}
                          {alreadyBet && (
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary ring-1 ring-primary/10">
                              ✓ Parié
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative mb-4 overflow-hidden rounded-[24px] border border-border/60 bg-background/80 px-4 py-5 backdrop-blur-sm">
                        <div
                          className="absolute inset-0 bg-cover bg-center opacity-[0.05] pointer-events-none"
                          style={{ backgroundImage: `url(${matchCardBg})` }}
                        />
                        <div className="relative">
                          <div className="mb-5 flex items-center justify-center gap-4">
                            <div className="flex flex-1 flex-col items-center gap-2">
                              {homeLogo ? (
                                <img src={homeLogo} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-border/60 shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : <div className="h-16 w-16 rounded-full bg-muted" />}
                              <span className={`text-center text-[13px] font-black leading-tight ${nextMatch.home?.club?.cl_no === OISEMONT_CL_NO ? 'text-primary' : 'text-foreground'}`}>
                                {homeName}
                              </span>
                              {homeRank && <span className="text-[10px] font-medium text-muted-foreground">{homeRank}e</span>}
                            </div>

                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
                              <motion.span
                                animate={{ scale: [1, 1.04, 1] }}
                                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                                className="text-2xl font-black"
                              >
                                VS
                              </motion.span>
                            </div>

                            <div className="flex flex-1 flex-col items-center gap-2">
                              {awayLogo ? (
                                <img src={awayLogo} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-border/60 shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : <div className="h-16 w-16 rounded-full bg-muted" />}
                              <span className={`text-center text-[13px] font-black leading-tight ${nextMatch.away?.club?.cl_no === OISEMONT_CL_NO ? 'text-primary' : 'text-foreground'}`}>
                                {awayName}
                              </span>
                              {awayRank && <span className="text-[10px] font-medium text-muted-foreground">{awayRank}e</span>}
                            </div>
                          </div>

                          {!live && !waiting && (
                            <div className="mb-4 flex items-center justify-center gap-2">
                              {[
                                { val: countdown.days, label: 'J' },
                                { val: countdown.hours, label: 'H' },
                                { val: countdown.minutes, label: 'M' },
                                { val: countdown.seconds, label: 'S' },
                              ].map((c, i) => (
                                <React.Fragment key={c.label}>
                                  {i > 0 && <span className="mx-0.5 text-sm font-black text-primary/25">:</span>}
                                  <div className="min-w-[42px] rounded-2xl bg-card px-2.5 py-2 text-center ring-1 ring-border/70">
                                    <div className="text-lg font-black leading-none text-foreground">{String(c.val).padStart(2, '0')}</div>
                                    <div className="mt-1 text-[8px] font-bold uppercase text-muted-foreground">{c.label}</div>
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                          )}

                          {waiting && (
                            <div className="mb-4 flex items-center justify-center gap-2 py-1.5">
                              <Clock size={14} className="text-amber-500" />
                              <span className="text-xs font-semibold text-amber-600">En attente</span>
                            </div>
                          )}

                          <p className="text-center text-sm font-medium text-muted-foreground">
                            {nextMatch.date ? new Date(nextMatch.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                            {nextMatch.time ? ` • ${nextMatch.time}` : ''}
                          </p>
                        </div>
                      </div>

                      {matchBets.length > 0 && (
                        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                          <div className="flex -space-x-2">
                            {matchBets.slice(0, 5).map(bet => (
                              profilePhotos[bet.userId] ? (
                                <img key={bet.id} src={profilePhotos[bet.userId]!} alt="" className="h-7 w-7 rounded-full object-cover ring-2 ring-card" />
                              ) : (
                                <div key={bet.id} className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-muted-foreground ring-2 ring-card">
                                  {bet.userName.charAt(0).toUpperCase()}
                                </div>
                              )
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-2 text-primary ring-1 ring-primary/10">
                            <Ticket size={12} />
                            <span className="text-[11px] font-bold">{matchBets.length} pari{matchBets.length > 1 ? 's' : ''} en cours</span>
                          </div>
                        </div>
                      )}

                      {currentUser && !live && !waiting && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={async () => {
                            if (!nextMatch.date) return;
                            let players: { id: string; name: string; position: string }[] = [];
                            try {
                              const matchDateKey = normalizeDateKey(nextMatch.date);
                              const { data: events } = await supabase
                                .from('events')
                                .select('convocations')
                                .eq('date', matchDateKey)
                                .eq('team', selectedTeam)
                                .eq('convocations_published', true)
                                .limit(1);
                              if (events?.[0]?.convocations) {
                                const convos = events[0].convocations as Record<string, any>;
                                const playerIds = Object.entries(convos)
                                  .filter(([, v]) => v === true || v === 'titulaire' || v === 'remplacant')
                                  .map(([id]) => id);
                                if (playerIds.length > 0) {
                                  const { data: pData } = await supabase
                                    .from('players')
                                    .select('id, name, position')
                                    .in('id', playerIds);
                                  if (pData) players = pData.map(p => ({ id: p.id, name: p.name, position: p.position || 'Non défini' }));
                                }
                              }
                            } catch {}
                            setConvocatedPlayers(players);
                            setBetModal({
                              home: homeName,
                              away: awayName,
                              date: nextMatch.date,
                              homeLogo: homeLogo || undefined,
                              awayLogo: awayLogo || undefined,
                              team: selectedTeam,
                            });
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:brightness-110"
                        >
                          <Zap size={16} />
                          <span>Parier sur ce match</span>
                        </motion.button>
                      )}

                      {locationLabel && (
                        <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-border/40 pt-4">
                          <MapPin size={11} className="shrink-0 text-muted-foreground" />
                          {locationLink ? (
                            <a href={locationLink} target="_blank" rel="noopener noreferrer" className="flex max-w-[250px] items-center gap-1 truncate text-[11px] font-medium text-primary underline underline-offset-2">
                              {locationLabel} <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="truncate text-[11px] text-muted-foreground">{locationLabel}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Public pending bets on this match */}
                  {matchBets.length > 0 && (() => {
                    const MAX_VISIBLE = 4;
                    const visibleBets = matchBets.slice(0, MAX_VISIBLE);
                    const hiddenCount = matchBets.length - MAX_VISIBLE;
                    return (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Paris en cours sur ce match</h3>
                        {visibleBets.map(bet => {
                          const predLabel = getBetLabel(bet);
                          const isMe = bet.userId === currentUser?.uid;
                          return (
                            <div key={bet.id} className={`bg-card rounded-xl border p-3 flex items-center gap-3 ${isMe ? 'border-accent/30 bg-accent/5' : 'border-border'}`}>
                              {profilePhotos[bet.userId] ? (
                                <img src={profilePhotos[bet.userId]!} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-border/30" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                                  {bet.userName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-foreground truncate">{bet.userName}</span>
                                  {isMe && <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">Toi</span>}
                                  {bet.betType !== 'match' && (() => {
                                    const tag = getBetTypeTag(bet.betType);
                                    return <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${tag.color}`}>{tag.label}</span>;
                                  })()}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {isMe ? (
                                    <>Prono : <span className="font-semibold text-foreground">{predLabel}</span> • Cote {bet.odds} • Mise {bet.amount}</>
                                  ) : (
                                    <>A parié sur ce match • Mise <span className="font-semibold text-foreground">{bet.amount}</span></>
                                  )}
                                </p>
                              </div>
                              {isMe && (
                                <div className="text-right shrink-0">
                                  <div className="text-xs font-black text-foreground">→ {Math.round(bet.amount * bet.odds)}</div>
                                  <div className="text-[9px] text-muted-foreground">pts</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {hiddenCount > 0 && (
                          <div className="flex items-center justify-center">
                            <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground bg-secondary/50 rounded-full px-4 py-2">
                              <div className="flex -space-x-2">
                                {matchBets.slice(MAX_VISIBLE, MAX_VISIBLE + 3).map(bet => (
                                  profilePhotos[bet.userId] ? (
                                    <img key={bet.id} src={profilePhotos[bet.userId]!} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-secondary" />
                                  ) : (
                                    <div key={bet.id} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground ring-2 ring-secondary">
                                      {bet.userName.charAt(0).toUpperCase()}
                                    </div>
                                  )
                                ))}
                              </div>
                              <span className="font-medium">+{hiddenCount} autre{hiddenCount > 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </motion.div>
        )}

        {/* ═══ MES PARIS TAB ═══ */}
        {activeFilter === 'my-bets' && (
          <motion.div key="my-bets" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {myBets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Ticket size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun pari</p>
                <p className="text-xs mt-1">Place ton premier pari sur un match !</p>
              </div>
            ) : (
              <>
                {/* Pending bets summary */}
                {myPendingBets.length > 0 && (
                  <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl border border-accent/20 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                        <Clock size={16} className="text-accent" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Paris en cours</h3>
                        <p className="text-[10px] text-muted-foreground">{myPendingBets.length} pari{myPendingBets.length > 1 ? 's' : ''} en attente</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-card/60 rounded-xl p-3 text-center border border-border/30">
                        <div className="text-[10px] text-muted-foreground font-medium mb-1">Mise totale</div>
                        <div className="text-base font-black text-foreground">{myPendingBets.reduce((s, b) => s + b.amount, 0)}</div>
                        <div className="text-[9px] text-muted-foreground">pts</div>
                      </div>
                      <div className="bg-card/60 rounded-xl p-3 text-center border border-border/30">
                        <div className="text-[10px] text-muted-foreground font-medium mb-1">Gain potentiel</div>
                        <div className="text-base font-black text-emerald-500">+{totalPotentialGain}</div>
                        <div className="text-[9px] text-muted-foreground">pts</div>
                      </div>
                    </div>

                    {/* Pending bets list */}
                    <div className="space-y-2">
                      {myPendingBets.map(bet => {
                        const predLabel = getBetLabel(bet);
                        return (
                          <div key={bet.id} className="bg-card rounded-xl border border-border/50 p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-bold text-foreground truncate">{bet.homeTeam} vs {bet.awayTeam}</p>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                                <Clock size={10} /> En cours
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] text-muted-foreground">
                                Prono : <span className="font-semibold text-foreground">{predLabel}</span> • Cote {bet.odds}
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Mise: {bet.amount}</span>
                                <span className="font-black text-emerald-500">→ {Math.round(bet.amount * bet.odds)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Settled bets (won/lost) */}
                {(myWonBets.length > 0 || myLostBets.length > 0) && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Historique</h3>
                    {myBets.filter(b => b.status !== 'pending').map(bet => {
                      const config = STATUS_CONFIG[bet.status] || STATUS_CONFIG.pending;
                      const StatusIcon = config.icon;
                      const predLabel = getBetLabel(bet);

                      return (
                        <div key={bet.id} className="bg-card rounded-xl border border-border p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {new Date(bet.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                              <StatusIcon size={10} />
                              {config.label}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{bet.homeTeam} vs {bet.awayTeam}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {predLabel} • Cote {bet.odds}
                              </p>
                            </div>
                            <div className={`text-sm font-black shrink-0 ml-3 ${bet.status === 'won' ? 'text-emerald-500' : 'text-destructive'}`}>
                              {bet.status === 'won' ? `+${bet.payout}` : `-${bet.amount}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ═══ CLASSEMENT TAB ═══ */}
        {activeFilter === 'leaderboard' && (
          <motion.div key="leaderboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <BetLeaderboard />
          </motion.div>
        )}

        {/* ═══ RÉGLER TAB (Admin+ only) ═══ */}
        {activeFilter === 'settle' && isAdminPlus && (
          <motion.div key="settle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-xl p-3">
              <Shield size={16} className="text-accent shrink-0" />
              <p className="text-[11px] text-foreground font-medium">
                Entre le score final de chaque match. Tous les paris associés seront réglés automatiquement.
              </p>
            </div>

            <div className="space-y-4">
              {settleCards.map(({ team, loading: teamLoading, match, bets: teamBets, matchKey }) => {
                const scores = settleScores[matchKey] || { home: '', away: '' };
                const isSettling = settlingMatch === matchKey;
                const homeName = match ? getDisplayTeamName(match.home, team) : '';
                const awayName = match ? getDisplayTeamName(match.away, team) : '';
                const homeLogo = match?.home?.club?.logo;
                const awayLogo = match?.away?.club?.logo;
                const matchDateFormatted = match?.date
                  ? new Date(match.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                  : null;

                return (
                  <motion.div
                    key={team}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl border border-border overflow-hidden"
                  >
                    {/* Team header */}
                    <div className="px-4 py-2.5 bg-secondary/40 border-b border-border/50 flex items-center justify-between">
                      <p className="text-xs font-black text-foreground uppercase tracking-wider">Équipe {team}</p>
                      {teamBets.length > 0 && (
                        <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                          {teamBets.length} pari{teamBets.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="p-4">
                      {teamLoading ? (
                        <div className="flex items-center justify-center gap-2 py-8">
                          <Loader2 size={18} className="text-accent animate-spin" />
                          <span className="text-xs text-muted-foreground">Chargement…</span>
                        </div>
                      ) : !match ? (
                        <div className="text-center py-6 text-muted-foreground text-xs">Aucun match à venir</div>
                      ) : (
                        <div className="space-y-4">
                          {/* Date */}
                          {matchDateFormatted && (
                            <p className="text-center text-[11px] text-muted-foreground font-medium">
                              {match.time ? `${matchDateFormatted} • ${match.time}` : matchDateFormatted}
                            </p>
                          )}

                          {/* Teams with logos + score inputs */}
                          <div className="flex items-center justify-center gap-3">
                            {/* Home */}
                            <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
                              {homeLogo ? (
                                <img src={homeLogo} alt={homeName} className="w-10 h-10 object-contain" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                                  {homeName.charAt(0)}
                                </div>
                              )}
                              <span className="text-[10px] font-bold text-foreground text-center leading-tight line-clamp-2 max-w-[80px]">{homeName}</span>
                            </div>

                            {/* Score inputs */}
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max="99"
                                value={scores.home}
                                onChange={e => setSettleScores(prev => ({ ...prev, [matchKey]: { ...scores, home: e.target.value } }))}
                                className="w-12 h-12 rounded-xl bg-background border-2 border-border text-center text-lg font-black text-foreground focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all"
                                placeholder="0"
                                disabled={isSettling}
                              />
                              <span className="text-base font-black text-muted-foreground">-</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max="99"
                                value={scores.away}
                                onChange={e => setSettleScores(prev => ({ ...prev, [matchKey]: { ...scores, away: e.target.value } }))}
                                className="w-12 h-12 rounded-xl bg-background border-2 border-border text-center text-lg font-black text-foreground focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all"
                                placeholder="0"
                                disabled={isSettling}
                              />
                            </div>

                            {/* Away */}
                            <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
                              {awayLogo ? (
                                <img src={awayLogo} alt={awayName} className="w-10 h-10 object-contain" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                                  {awayName.charAt(0)}
                                </div>
                              )}
                              <span className="text-[10px] font-bold text-foreground text-center leading-tight line-clamp-2 max-w-[80px]">{awayName}</span>
                            </div>
                          </div>

                          {/* Settle button for match + exact_score bets */}
                          {(() => {
                            const matchBetsCount = teamBets.filter(b => b.betType === 'match' || b.betType === 'exact_score').length;
                            return (
                              <button
                                onClick={() => handleSettle(matchKey, homeName, awayName, teamBets)}
                                disabled={isSettling || !scores.home || !scores.away || matchBetsCount === 0}
                                className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] transition-all shadow-sm"
                              >
                                {isSettling ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={16} />}
                                {matchBetsCount > 0
                                  ? `Régler ${matchBetsCount} pari${matchBetsCount > 1 ? 's' : ''} résultat`
                                  : 'Aucun pari résultat'}
                              </button>
                            );
                          })()}

                          {/* Scorer bets settlement */}
                          {(() => {
                            const scorerBets = teamBets.filter(b => b.betType === 'scorer');
                            if (scorerBets.length === 0) return null;
                            const selectedIds = settleScorers[matchKey] || [];
                            const uniqueScorers = [...new Map(scorerBets.map(b => [b.scorerPlayerId, { id: b.scorerPlayerId!, name: b.scorerPlayerName || '?' }])).values()];
                            const isScorerSettling = settlingScorers === matchKey;

                            // Load players list for this match if not loaded
                            if (!settlePlayersList[matchKey] && !isScorerSettling) {
                              const matchDateKey = normalizeDateKey(match.date);
                              supabase
                                .from('events')
                                .select('convocations')
                                .eq('date', matchDateKey)
                                .eq('team', team)
                                .eq('convocations_published', true)
                                .limit(1)
                                .then(({ data: events }) => {
                                  if (events?.[0]?.convocations) {
                                    const convos = events[0].convocations as Record<string, any>;
                                    const playerIds = Object.entries(convos)
                                      .filter(([, v]) => v === true || v === 'titulaire' || v === 'remplacant')
                                      .map(([id]) => id);
                                    if (playerIds.length > 0) {
                                      supabase.from('players').select('id, name, position').in('id', playerIds).then(({ data: pData }) => {
                                        if (pData) setSettlePlayersList(prev => ({ ...prev, [matchKey]: pData.map(p => ({ id: p.id, name: p.name, position: p.position || '' })) }));
                                      });
                                    }
                                  }
                                });
                            }

                            const allPlayers = settlePlayersList[matchKey] || uniqueScorers.map(s => ({ ...s, position: '' }));

                            return (
                              <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                                <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                                  <Target size={13} className="text-purple-500" />
                                  Régler {scorerBets.length} pari{scorerBets.length > 1 ? 's' : ''} buteur
                                </p>
                                <p className="text-[10px] text-muted-foreground">Sélectionne les joueurs qui ont marqué :</p>
                                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                                  {allPlayers.map(player => {
                                    const isSelected = selectedIds.includes(player.id);
                                    return (
                                      <button
                                        key={player.id}
                                        onClick={() => {
                                          setSettleScorers(prev => {
                                            const current = prev[matchKey] || [];
                                            return { ...prev, [matchKey]: isSelected ? current.filter(id => id !== player.id) : [...current, player.id] };
                                          });
                                        }}
                                        className={cn(
                                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-xs",
                                          isSelected ? "bg-purple-500/15 border border-purple-500/30" : "bg-secondary/50 border border-border/30 hover:bg-secondary"
                                        )}
                                      >
                                        <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0", isSelected ? "border-purple-500 bg-purple-500" : "border-border")}>
                                          {isSelected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                        </div>
                                        <span className={cn("font-semibold flex-1", isSelected ? "text-purple-600 dark:text-purple-400" : "text-foreground")}>{player.name}</span>
                                        {player.position && <span className="text-[9px] text-muted-foreground">{player.position}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                                <button
                                  onClick={() => handleSettleScorers(matchKey, homeName, awayName, teamBets)}
                                  disabled={isScorerSettling || selectedIds.length === 0}
                                  className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] transition-all"
                                >
                                  {isScorerSettling ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
                                  Régler paris buteur
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet Modal */}
      {betModal && currentUser && authUserId && (
        <BetModal
          isOpen={!!betModal}
          onClose={() => setBetModal(null)}
          onBetPlaced={handleBetPlaced}
          homeTeam={betModal.home}
          awayTeam={betModal.away}
          matchDate={betModal.date}
          homeLogo={betModal.homeLogo}
          awayLogo={betModal.awayLogo}
          userId={authUserId}
          userName={currentUser.name}
          team={betModal.team}
          convocatedPlayers={convocatedPlayers}
        />
      )}
    </div>
  );
};

export default ParisTab;
