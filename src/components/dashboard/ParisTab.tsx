import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Coins, Clock, CheckCircle2, XCircle, Ticket, BarChart3, Flame, Loader2, Zap, MapPin, ExternalLink, Timer, TrendingUp, User, Shield, Gavel, RefreshCw } from 'lucide-react';
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-xl flex items-center justify-center">
            <Ticket className="text-accent" size={18} />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Paris</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleForceRefresh}
            disabled={refreshing || currentData.loading}
            className="w-8 h-8 rounded-xl bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80 transition-all disabled:opacity-40"
            title="Actualiser les matchs"
          >
            <RefreshCw size={14} className={cn("text-muted-foreground", (refreshing || currentData.loading) && "animate-spin")} />
          </button>
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
            <Coins size={16} className="text-amber-500" />
            <span className="text-sm font-black text-amber-500">{balance}</span>
            <span className="text-[10px] text-amber-500/70 font-medium">pts</span>
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

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="text-lg font-black text-foreground">{myBets.length}</div>
          <div className="text-[10px] text-muted-foreground font-medium">Total Paris</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="text-lg font-black text-emerald-500">{myWonBets.length}</div>
          <div className="text-[10px] text-muted-foreground font-medium">Gagnés</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="text-lg font-black text-destructive">{myLostBets.length}</div>
          <div className="text-[10px] text-muted-foreground font-medium">Perdus</div>
        </div>
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
                  {/* Hero card */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`relative rounded-2xl overflow-hidden border shadow-sm ${
                      live ? 'border-red-500/50 ring-1 ring-red-500/30' : waiting ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-border/60'
                    } bg-card`}
                  >
                    {live && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-400 to-red-500 animate-pulse" />
                    )}
                    {waiting && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
                    )}

                    <div className="px-5 py-5">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-accent/10 rounded-lg flex items-center justify-center">
                            <Timer size={14} className="text-accent" />
                          </div>
                          <span className="text-[11px] font-bold text-foreground uppercase tracking-widest">
                            Prochain Match — Équipe {selectedTeam}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {live && (
                            <span className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                              LIVE
                            </span>
                          )}
                          {waiting && (
                            <span className="flex items-center gap-1 bg-amber-500/10 text-amber-500 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                              <Clock size={9} />
                              En attente
                            </span>
                          )}
                          {alreadyBet && (
                            <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">✓ Parié</span>
                          )}
                        </div>
                      </div>

                      {/* Teams & VS */}
                      <div className="flex items-center justify-center gap-5 mb-4">
                        <div className="flex flex-col items-center gap-2 flex-1">
                          {homeLogo ? (
                            <img src={homeLogo} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-border/30 shadow-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : <div className="w-14 h-14 rounded-full bg-secondary" />}
                          <span className={`text-[11px] font-bold text-center leading-tight ${nextMatch.home?.club?.cl_no === OISEMONT_CL_NO ? 'text-accent' : 'text-foreground'}`}>
                            {homeName}
                          </span>
                          {homeRank && <span className="text-[9px] text-muted-foreground font-medium">{homeRank}e</span>}
                        </div>
                        <div className="relative">
                          <motion.span
                            animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            className="text-2xl font-black text-accent"
                            style={{ textShadow: '0 0 20px hsl(var(--accent) / 0.5)' }}
                          >VS</motion.span>
                        </div>
                        <div className="flex flex-col items-center gap-2 flex-1">
                          {awayLogo ? (
                            <img src={awayLogo} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-border/30 shadow-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : <div className="w-14 h-14 rounded-full bg-secondary" />}
                          <span className={`text-[11px] font-bold text-center leading-tight ${nextMatch.away?.club?.cl_no === OISEMONT_CL_NO ? 'text-accent' : 'text-foreground'}`}>
                            {awayName}
                          </span>
                          {awayRank && <span className="text-[9px] text-muted-foreground font-medium">{awayRank}e</span>}
                        </div>
                      </div>

                      {/* Countdown */}
                      {!live && !waiting && (
                        <div className="flex items-center justify-center gap-1 mb-3">
                          {[
                            { val: countdown.days, label: 'J' },
                            { val: countdown.hours, label: 'H' },
                            { val: countdown.minutes, label: 'M' },
                            { val: countdown.seconds, label: 'S' },
                          ].map((c, i) => (
                            <React.Fragment key={c.label}>
                              {i > 0 && <span className="text-sm font-black text-accent/30 mx-0.5">:</span>}
                              <div className="bg-secondary rounded-lg px-2 py-1.5 text-center min-w-[36px]">
                                <div className="text-sm font-black text-foreground leading-none">{String(c.val).padStart(2, '0')}</div>
                                <div className="text-[7px] font-bold text-muted-foreground uppercase mt-0.5">{c.label}</div>
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      {/* Waiting for result */}
                      {waiting && (
                        <div className="flex items-center justify-center gap-2 mb-3 py-2">
                          <Clock size={14} className="text-amber-500" />
                          <span className="text-xs font-semibold text-amber-500">En attente</span>
                        </div>
                      )}

                      {/* Date */}
                      <p className="text-[11px] text-muted-foreground text-center mb-3">
                        {nextMatch.date ? new Date(nextMatch.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                        {nextMatch.time ? ` • ${nextMatch.time}` : ''}
                      </p>


                      {/* Pending bets count */}
                      {matchBets.length > 0 && (
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <div className="flex -space-x-2">
                            {matchBets.slice(0, 5).map(bet => (
                              profilePhotos[bet.userId] ? (
                                <img key={bet.id} src={profilePhotos[bet.userId]!} alt="" className="w-6 h-6 rounded-full object-cover ring-2 ring-card" />
                              ) : (
                                <div key={bet.id} className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[8px] font-bold text-muted-foreground ring-2 ring-card">
                                  {bet.userName.charAt(0).toUpperCase()}
                                </div>
                              )
                            ))}
                          </div>
                          <div className="flex items-center gap-1 bg-accent/10 text-accent rounded-full px-3 py-1">
                            <Ticket size={12} />
                            <span className="text-[10px] font-bold">{matchBets.length} pari{matchBets.length > 1 ? 's' : ''} en cours</span>
                          </div>
                        </div>
                      )}

                      {/* Bet button */}
                      {currentUser && !live && !waiting && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={async () => {
                            if (!nextMatch.date) return;
                            // Load convocated players from events with published convocations
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
                          className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-accent/20 hover:brightness-110 transition-all"
                        >
                          <Zap size={15} />
                          <span>Parier sur ce match</span>
                        </motion.button>
                      )}

                      {/* Location */}
                      {locationLabel && (
                        <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-border/30">
                          <MapPin size={11} className="text-muted-foreground shrink-0" />
                          {locationLink ? (
                            <a href={locationLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent underline underline-offset-2 truncate max-w-[250px] flex items-center gap-1">
                              {locationLabel} <ExternalLink size={9} />
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground truncate">{locationLabel}</span>
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
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-foreground truncate">{bet.userName}</span>
                                  {isMe && <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">Toi</span>}
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

                          {/* Settle button - full width */}
                          <button
                            onClick={() => handleSettle(matchKey, homeName, awayName, teamBets)}
                            disabled={isSettling || !scores.home || !scores.away || teamBets.length === 0}
                            className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] transition-all shadow-sm"
                          >
                            {isSettling ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={16} />}
                            {teamBets.length > 0
                              ? `Régler ${teamBets.length} pari${teamBets.length > 1 ? 's' : ''}`
                              : 'Aucun pari à régler'}
                          </button>
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
