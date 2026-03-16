import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Coins, Clock, CheckCircle2, XCircle, Ticket, BarChart3, Flame, Loader2, Zap, MapPin, ExternalLink, Timer, TrendingUp, User, Shield, Gavel } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AppUser } from '@/contexts/AuthContext';
import type { Championship } from './ChampionnatTab';
import {
  getEquipes, getTeamChampionship, getTousMatchsAvenir,
  mapClassementToStandings, getClassement,
  OISEMONT_CL_NO, decodeFFFApiRef,
  type FFFMonthGroup, type FFFLiveMatch, type ScrapedStanding
} from '@/lib/fffApi';
import BetModal, { generateOdds } from './BetModal';
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
}

interface Props {
  currentUser: AppUser | null;
  championships: Championship[];
}

const mapBet = (r: any): Bet => ({
  id: r.id, userId: r.user_id, userName: r.user_name,
  homeTeam: r.home_team, awayTeam: r.away_team, matchDate: r.match_date,
  prediction: r.prediction, odds: r.odds, amount: r.amount, payout: r.payout,
  status: r.status, createdAt: r.created_at,
});

type TabFilter = 'upcoming' | 'my-bets' | 'leaderboard' | 'settle';

const STATUS_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  pending: { icon: Clock, label: 'En cours', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  won: { icon: CheckCircle2, label: 'Gagné', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  lost: { icon: XCircle, label: 'Perdu', color: 'text-destructive', bg: 'bg-destructive/10' },
};

const BASE_TEAMS = ['A', 'B', 'C'];

function buildLocationLink(terrain?: { city?: string; name?: string }) {
  if (!terrain) return null;
  const parts = [terrain.name, terrain.city].filter(Boolean).join(', ');
  if (!parts) return null;
  return `https://waze.com/ul?q=${encodeURIComponent(parts)}&navigate=yes`;
}

const ParisTab: React.FC<Props> = ({ currentUser, championships }) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [balance, setBalance] = useState(100);
  const [activeFilter, setActiveFilter] = useState<TabFilter>('upcoming');
  const [betModal, setBetModal] = useState<{ home: string; away: string; date: string; homeLogo?: string; awayLogo?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string>('A');

  // Per-team FFF data
  const [teamData, setTeamData] = useState<Record<string, { upcoming: FFFMonthGroup[]; classement: ScrapedStanding[]; loading: boolean }>>({});
  const [profilePhotos, setProfilePhotos] = useState<Record<string, string | null>>({});

  // Countdown
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const customTeams = [...new Set(championships.map(c => c.team || 'A').filter(t => !BASE_TEAMS.includes(t)))].sort();
  const allTeamOptions = [...BASE_TEAMS, ...customTeams];

  // Load bets & balance
  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      const [{ data: betsData }, { data: pointsData }] = await Promise.all([
        supabase.from('bets').select('*').order('created_at', { ascending: false }),
        supabase.from('user_points').select('balance').eq('user_id', currentUser.uid).maybeSingle(),
      ]);
      if (betsData) setBets(betsData.map(mapBet));
      if (pointsData) setBalance(pointsData.balance);
      else setBalance(100);
      setLoading(false);
    };
    fetchData();

    const channel = supabase.channel('paris-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => {
        supabase.from('bets').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setBets(data.map(mapBet)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_points', filter: `user_id=eq.${currentUser.uid}` }, (payload: any) => {
        if (typeof payload.new?.balance === 'number') setBalance(payload.new.balance);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

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

  // Load FFF data for selected team — with localStorage cache to avoid redundant API calls
  useEffect(() => {
    if (teamData[selectedTeam] && !teamData[selectedTeam].loading) return; // already loaded in memory

    const LOCAL_CACHE_KEY = `paris_fff_${selectedTeam}`;
    const LOCAL_CACHE_TTL = 30 * 60 * 1000; // 30 min local cache

    // Try localStorage first
    try {
      const cached = localStorage.getItem(LOCAL_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < LOCAL_CACHE_TTL && data) {
          const classement = data.classement && Array.isArray(data.classement)
            ? mapClassementToStandings(data.classement) : [];
          setTeamData(prev => ({ ...prev, [selectedTeam]: { upcoming: data.upcoming || [], classement, loading: false } }));
          return;
        }
      }
    } catch {}

    const teamMapping: Record<string, { categoryCode: string; code: number }> = {
      'A': { categoryCode: 'SEM', code: 1 },
      'B': { categoryCode: 'SEM', code: 2 },
      'C': { categoryCode: 'SEM', code: 3 },
    };

    const mapping = teamMapping[selectedTeam];
    let customParams: { cpNo: number; phase: number; poule: number } | null = null;

    if (!mapping) {
      const customChamp = championships.find(c => (c.team || 'A') === selectedTeam && c.fffUrl);
      if (customChamp?.fffUrl) customParams = decodeFFFApiRef(customChamp.fffUrl);
      if (!customParams) {
        setTeamData(prev => ({ ...prev, [selectedTeam]: { upcoming: [], classement: [], loading: false } }));
        return;
      }
    }

    // Check DB cache (24h)
    const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
    const teamChamp = championships.find(c => (c.team || 'A') === selectedTeam && c.fffLiveCache && c.fffRefreshedAt);
    const cacheAge = teamChamp?.fffRefreshedAt ? Date.now() - new Date(teamChamp.fffRefreshedAt).getTime() : Infinity;

    if (teamChamp?.fffLiveCache && cacheAge < CACHE_MAX_AGE) {
      const cache = teamChamp.fffLiveCache;
      const classement = cache.classement && Array.isArray(cache.classement)
        ? mapClassementToStandings(cache.classement) : [];
      setTeamData(prev => ({ ...prev, [selectedTeam]: { upcoming: cache.upcoming || [], classement, loading: false } }));
      // Save to localStorage
      try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ data: cache, ts: Date.now() })); } catch {}
      return;
    }

    // Fetch from API
    setTeamData(prev => ({ ...prev, [selectedTeam]: { upcoming: [], classement: [], loading: true } }));
    let cancelled = false;
    (async () => {
      try {
        let champParams = customParams;
        if (!champParams && mapping) {
          const equipesData = await getEquipes(OISEMONT_CL_NO);
          const equipes = Array.isArray(equipesData) ? equipesData : equipesData?.equipes || [];
          champParams = getTeamChampionship(equipes, mapping.categoryCode, mapping.code);
        }
        if (!champParams || cancelled) return;
        const [upcoming, classementData] = await Promise.all([
          getTousMatchsAvenir(champParams.cpNo, champParams.phase, champParams.poule),
          getClassement(champParams.cpNo, champParams.phase, champParams.poule).catch(() => null),
        ]);
        if (cancelled) return;
        let classement: ScrapedStanding[] = [];
        let rawClassement: any = null;
        if (classementData) {
          const members = classementData?.['hydra:member'] || classementData;
          if (Array.isArray(members)) {
            classement = mapClassementToStandings(members);
            rawClassement = members;
          }
        }
        setTeamData(prev => ({ ...prev, [selectedTeam]: { upcoming, classement, loading: false } }));
        // Save to localStorage
        try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ data: { upcoming, classement: rawClassement }, ts: Date.now() })); } catch {}
      } catch (err) {
        console.error(`Error loading FFF for team ${selectedTeam}:`, err);
        if (!cancelled) setTeamData(prev => ({ ...prev, [selectedTeam]: { upcoming: [], classement: [], loading: false } }));
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTeam, championships.length]);

  // Current team data
  const currentData = teamData[selectedTeam] || { upcoming: [], classement: [], loading: true };

  // Helper: check if a match date+time is finished (3h after kickoff)
  const isMatchFinished = (matchDate: string, matchTime?: string): boolean => {
    if (!matchDate) return false;
    const mDate = new Date(matchDate);
    const now = new Date();
    // If match day is in the past, it's finished
    if (mDate.toISOString().split('T')[0] < now.toISOString().split('T')[0]) return true;
    // If same day, check time
    if (mDate.toISOString().split('T')[0] === now.toISOString().split('T')[0] && matchTime) {
      const timeParts = matchTime.replace('H', ':').split(':');
      const kickoffHour = parseInt(timeParts[0], 10);
      const kickoffMin = parseInt(timeParts[1] || '0', 10);
      if (!isNaN(kickoffHour)) {
        const kickoff = new Date(now);
        kickoff.setHours(kickoffHour, kickoffMin, 0, 0);
        // Consider finished 3h after kickoff
        if ((now.getTime() - kickoff.getTime()) / 60000 > 180) return true;
      }
    }
    return false;
  };

  // Next match for selected team (skip finished matches)
  const nextMatch: FFFLiveMatch | null = useMemo(() => {
    for (const group of currentData.upcoming) {
      for (const m of group.matchs) {
        if (m.date && !isMatchFinished(m.date, m.time)) return m;
      }
    }
    return null;
  }, [currentData.upcoming]);

  // Countdown timer
  useEffect(() => {
    if (!nextMatch?.date) return;
    const target = new Date(nextMatch.date);
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
  }, [nextMatch?.date]);

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
    if (diffMin <= 100) return 'live'; // During match (~90min + extra time)
    return 'waiting'; // Match over, waiting for result
  };

  // Backward compat helper
  const isMatchLive = (matchDate: string, matchTime?: string) => {
    const status = getMatchStatus(matchDate, matchTime);
    return status === 'live';
  };

  const myBets = useMemo(() => bets.filter(b => b.userId === currentUser?.uid), [bets, currentUser]);
  const myPendingBets = myBets.filter(b => b.status === 'pending');
  const myWonBets = myBets.filter(b => b.status === 'won');
  const myLostBets = myBets.filter(b => b.status === 'lost');

  // All pending bets from all users (for public view in "Matchs" tab)
  const allPendingBets = useMemo(() => bets.filter(b => b.status === 'pending'), [bets]);

  // Count pending bets for a specific match
  const getPendingBetsForMatch = (homeTeam: string, awayTeam: string, matchDate: string) =>
    allPendingBets.filter(b => b.homeTeam === homeTeam && b.awayTeam === awayTeam && b.matchDate === matchDate);

  const hasBetOnMatch = (homeTeam: string, awayTeam: string, matchDate: string) =>
    myBets.some(b => b.homeTeam === homeTeam && b.awayTeam === awayTeam && b.matchDate === matchDate);

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

  // Group pending bets by match for settlement
  const pendingMatchGroups = useMemo(() => {
    const groups = new Map<string, { homeTeam: string; awayTeam: string; matchDate: string; bets: Bet[] }>();
    for (const bet of allPendingBets) {
      const key = `${bet.homeTeam}||${bet.awayTeam}||${bet.matchDate}`;
      if (!groups.has(key)) {
        groups.set(key, { homeTeam: bet.homeTeam, awayTeam: bet.awayTeam, matchDate: bet.matchDate, bets: [] });
      }
      groups.get(key)!.bets.push(bet);
    }
    return [...groups.values()];
  }, [allPendingBets]);

  const handleSettle = useCallback(async (matchKey: string, homeTeam: string, awayTeam: string, matchDate: string) => {
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

    setSettlingMatch(matchKey);
    try {
      const { data, error } = await supabase.rpc('settle_match_bets', {
        p_home_team: homeTeam,
        p_away_team: awayTeam,
        p_match_date: matchDate,
        p_home_score: homeScore,
        p_away_score: awayScore,
      });
      if (error) throw error;
      const result = data as any;
      const settled = result?.settled || 0;
      const resultLabel = result?.result === 'home' ? homeTeam : result?.result === 'away' ? awayTeam : 'Match nul';
      toast.success(`${settled} pari${settled > 1 ? 's' : ''} réglé${settled > 1 ? 's' : ''} — ${resultLabel} (${homeScore}-${awayScore})`);
      // Clear scores for this match
      setSettleScores(prev => { const next = { ...prev }; delete next[matchKey]; return next; });
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du règlement');
    } finally {
      setSettlingMatch(null);
    }
  }, [settleScores]);

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
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          <Coins size={16} className="text-amber-500" />
          <span className="text-sm font-black text-amber-500">{balance}</span>
          <span className="text-[10px] text-amber-500/70 font-medium">pts</span>
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
      <div className="flex gap-1.5 bg-secondary/50 rounded-xl p-1 border border-border/50">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === f.id
                ? 'bg-card text-foreground shadow-sm border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <f.icon size={14} />
            <span>{f.label}</span>
            {f.count !== undefined && f.count > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {f.count}
              </span>
            )}
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
              const homeName = nextMatch.home?.short_name || nextMatch.home?.name || '';
              const awayName = nextMatch.away?.short_name || nextMatch.away?.name || '';
              const homeLogo = nextMatch.home?.club?.logo;
              const awayLogo = nextMatch.away?.club?.logo;
              const alreadyBet = hasBetOnMatch(homeName, awayName, nextMatch.date || '');
              const matchBets = getPendingBetsForMatch(homeName, awayName, nextMatch.date || '');

              // Ranks for smart odds
              const homeClNo = nextMatch.home?.club?.cl_no;
              const awayClNo = nextMatch.away?.club?.cl_no;
              const homeStanding = currentData.classement.find(s => s.clNo === homeClNo);
              const awayStanding = currentData.classement.find(s => s.clNo === awayClNo);
              const homeRank = homeStanding ? currentData.classement.indexOf(homeStanding) + 1 : undefined;
              const awayRank = awayStanding ? currentData.classement.indexOf(awayStanding) + 1 : undefined;
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
                          <span className="text-xs font-semibold text-amber-500">En attente du résultat FFF</span>
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
                      {currentUser && !live && !waiting && !alreadyBet && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => nextMatch.date && setBetModal({
                            home: homeName,
                            away: awayName,
                            date: nextMatch.date,
                            homeLogo: homeLogo || undefined,
                            awayLogo: awayLogo || undefined,
                          })}
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
                          const predLabel = bet.prediction === 'home' ? bet.homeTeam : bet.prediction === 'away' ? bet.awayTeam : 'Nul';
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
                        const predLabel = bet.prediction === 'home' ? bet.homeTeam : bet.prediction === 'away' ? bet.awayTeam : 'Nul';
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
                      const predLabel = bet.prediction === 'home' ? bet.homeTeam : bet.prediction === 'away' ? bet.awayTeam : 'Nul';

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
                Règlement manuel — Entre les scores pour chaque match puis confirme. Les gains/pertes seront calculés automatiquement côté serveur.
              </p>
            </div>

            {pendingMatchGroups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun pari en attente</p>
                <p className="text-xs mt-1">Tous les paris ont été réglés ✓</p>
              </div>
            ) : (
              pendingMatchGroups.map(group => {
                const matchKey = `${group.homeTeam}||${group.awayTeam}||${group.matchDate}`;
                const scores = settleScores[matchKey] || { home: '', away: '' };
                const isSettling = settlingMatch === matchKey;
                const matchDateFormatted = (() => {
                  try { return new Date(group.matchDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
                  catch { return group.matchDate; }
                })();

                return (
                  <div key={matchKey} className="bg-card rounded-2xl border border-border overflow-hidden">
                    {/* Match header */}
                    <div className="px-4 py-3 bg-secondary/30 border-b border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground font-medium">{matchDateFormatted}</span>
                        <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                          {group.bets.length} pari{group.bets.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-foreground">{group.homeTeam} vs {group.awayTeam}</p>
                    </div>

                    {/* Bets list */}
                    <div className="px-4 py-2 space-y-1.5">
                      {group.bets.map(bet => {
                        const predLabel = bet.prediction === 'home' ? group.homeTeam : bet.prediction === 'away' ? group.awayTeam : 'Nul';
                        return (
                          <div key={bet.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                            <div className="flex items-center gap-2">
                              {profilePhotos[bet.userId] ? (
                                <img src={profilePhotos[bet.userId]!} alt="" className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                                  {bet.userName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="text-xs font-semibold text-foreground">{bet.userName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                {predLabel} • {bet.amount} pts • x{bet.odds}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Score input */}
                    <div className="px-4 py-3 bg-secondary/20 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-[10px] font-bold text-foreground truncate max-w-[80px]">{group.homeTeam.split(' ')[0]}</span>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={scores.home}
                            onChange={e => setSettleScores(prev => ({ ...prev, [matchKey]: { ...scores, home: e.target.value } }))}
                            className="w-12 h-9 rounded-lg bg-background border border-border text-center text-sm font-bold text-foreground focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                            placeholder="—"
                            disabled={isSettling}
                          />
                          <span className="text-xs font-black text-muted-foreground">-</span>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={scores.away}
                            onChange={e => setSettleScores(prev => ({ ...prev, [matchKey]: { ...scores, away: e.target.value } }))}
                            className="w-12 h-9 rounded-lg bg-background border border-border text-center text-sm font-bold text-foreground focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                            placeholder="—"
                            disabled={isSettling}
                          />
                          <span className="text-[10px] font-bold text-foreground truncate max-w-[80px]">{group.awayTeam.split(' ')[0]}</span>
                        </div>
                        <button
                          onClick={() => handleSettle(matchKey, group.homeTeam, group.awayTeam, group.matchDate)}
                          disabled={isSettling || !scores.home || !scores.away}
                          className="px-4 py-2 bg-accent text-accent-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all shadow-sm"
                        >
                          {isSettling ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />}
                          Régler
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet Modal */}
      {betModal && currentUser && (
        <BetModal
          isOpen={!!betModal}
          onClose={() => setBetModal(null)}
          homeTeam={betModal.home}
          awayTeam={betModal.away}
          matchDate={betModal.date}
          homeLogo={betModal.homeLogo}
          awayLogo={betModal.awayLogo}
          userId={currentUser.uid}
          userName={currentUser.name}
        />
      )}
    </div>
  );
};

export default ParisTab;
