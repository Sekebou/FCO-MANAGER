import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Plus, Trash2, Calendar, Award, ChevronDown, ChevronUp, X, Hash, CalendarDays, Home, Plane, Loader2, RefreshCw, Clock, CheckCircle2, AlertCircle, ArrowUpCircle, PlusCircle, BarChart3, Users, MapPin, Sparkles, TrendingUp, TrendingDown, Minus, ExternalLink, Zap, Timer, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import NativeDatePicker from '@/components/ui/native-date-picker';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { 
  getEquipes, getAllCompetitions, getClassement, getResultats, getCalendrier,
  mapClassementToStandings, mapMatchesToScrapedMatches, extractTeamLogosFromClassement,
  extractTeamLogosFromResults,
  encodeFFFApiRef, decodeFFFApiRef, OISEMONT_CL_NO, getTeamChampionship,
  getTousMatchsAvenir, getTousResultats, clearFFFCache,
  type ScrapedMatch, type ScrapedStanding, type FFFCompetition, type FFFMonthGroup, type FFFLiveMatch
} from '@/lib/fffApi';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface Championship {
  id: string;
  name: string;
  season: string;
  teams: string[];
  fffUrl?: string;
  fffStandings?: ScrapedStanding[];
  teamLogos?: Record<string, string>;
  team?: string;
  createdAt: string;
  fffLiveCache?: any;
  fffRefreshedAt?: string;
}

export interface Match {
  id: string;
  championshipId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  date: string;
  journee: number;
  played: boolean;
}

interface Props {
  championships: Championship[];
  matches: Match[];
  currentUserRole?: string;
  canManage: () => boolean | undefined;
  canUpdateChampionnat: () => boolean | undefined;
  onAddChampionship: (data: { name: string; season: string; teams: string[]; fffUrl?: string; matches?: ScrapedMatch[]; standings?: ScrapedStanding[]; teamLogos?: Record<string, string>; team?: string }) => void;
  onDeleteChampionship: (id: string) => void;
  onUpdateChampionship?: (id: string, updates: { team?: string }) => void;
  onAddMatch: (data: Omit<Match, 'id'>) => void;
  onUpdateMatchScore: (matchId: string, homeScore: number, awayScore: number) => void;
  onDeleteMatch: (id: string) => void;
  onRefreshFromFFF?: (championshipId: string, fffUrl: string) => Promise<{ success: boolean; updated: number; added: number; standingsCount: number; error?: string }>;
  dataLoaded?: boolean;
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } }
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3 } }
};

/** Build Waze link from location */
function buildLocationLink(terrain?: { city?: string; name?: string }) {
  if (!terrain) return null;
  const parts = [terrain.name, terrain.city].filter(Boolean).join(', ');
  if (!parts) return null;
  return `https://waze.com/ul?q=${encodeURIComponent(parts)}&navigate=yes`;
}

const ChampionnatTab: React.FC<Props> = ({
  championships,
  matches,
  currentUserRole,
  canManage,
  canUpdateChampionnat,
  onAddChampionship,
  onDeleteChampionship,
  onUpdateChampionship,
  onAddMatch,
  onUpdateMatchScore,
  onDeleteMatch,
  onRefreshFromFFF,
  dataLoaded = true,
}) => {
  const { currentUser } = useAuth();
  const BASE_TEAMS = ['A', 'B', 'C'];
  const customTeams = [...new Set(championships.map(c => c.team || 'A').filter(t => !BASE_TEAMS.includes(t)))].sort();
  const allTeamOptions = [...BASE_TEAMS, ...customTeams];
  const [selectedTeam, setSelectedTeam] = useState<string>('A');
  const [customTeamName, setCustomTeamName] = useState('');
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [editTabName, setEditTabName] = useState('');
  const [deletingTab, setDeletingTab] = useState<string | null>(null);
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [showAddChamp, setShowAddChamp] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState<string | null>(null);
  const [expandedChamp, setExpandedChamp] = useState<string | null>(championships[0]?.id || null);

  // Add championship form state
  const [champName, setChampName] = useState('');
  const [champSeason, setChampSeason] = useState('2024-2025');
  const [champTeam, setChampTeam] = useState<string>('A');
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'admin+';
  const [isLoadingEquipes, setIsLoadingEquipes] = useState(false);
  const [fffCompetitions, setFffCompetitions] = useState<FFFCompetition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<FFFCompetition | null>(null);
  const [isImportingFFF, setIsImportingFFF] = useState(false);
  const [importedMatches, setImportedMatches] = useState<ScrapedMatch[]>([]);
  const [importedStandings, setImportedStandings] = useState<ScrapedStanding[]>([]);
  const [importedLogos, setImportedLogos] = useState<Record<string, string>>({});
  const [importedTeams, setImportedTeams] = useState<string[]>([]);
  const [refreshingChamp, setRefreshingChamp] = useState<string | null>(null);

  // Live classement from FFF API
  const [liveClassement, setLiveClassement] = useState<ScrapedStanding[]>([]);
  const [liveLogos, setLiveLogos] = useState<Record<number, string>>({});
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  
  // Live matches from FFF API
  const [liveUpcoming, setLiveUpcoming] = useState<FFFMonthGroup[]>([]);
  const [liveResults, setLiveResults] = useState<FFFMonthGroup[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  
  // Add match form state
  const [matchHome, setMatchHome] = useState('');
  const [matchAway, setMatchAway] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [matchJournee, setMatchJournee] = useState(1);

  // Score edit
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editHome, setEditHome] = useState(0);
  const [editAway, setEditAway] = useState(0);

  // Scroll lock for modals
  useBodyScrollLock(!!(showAddChamp || showAddMatch || editingMatch));

  // Refresh result modal
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; updated: number; added: number; standingsCount: number; error?: string; champName?: string } | null>(null);


  // Countdown
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const filteredChampionships = championships.filter(c => (c.team || 'A') === selectedTeam);
  const teamHasChampionship = (team: string) => championships.some(c => (c.team || 'A') === team);

  const getChampMatches = (champId: string) => matches.filter(m => m.championshipId === champId);

  const getTeamLogo = (teamName: string, champId?: string) => {
    const searchChamps = champId ? [championships.find(c => c.id === champId)] : championships;
    for (const champ of searchChamps) {
      if (!champ?.teamLogos) continue;
      const logo = champ.teamLogos[teamName.toUpperCase()] || champ.teamLogos[teamName];
      if (logo) return logo;
    }
    return null;
  };

  const TeamLogo: React.FC<{ team: string; champId?: string; size?: number }> = ({ team, champId, size = 24 }) => {
    const logo = getTeamLogo(team, champId);
    if (!logo) return null;
    return (
      <img
        src={logo}
        alt={team}
        className="rounded-full object-cover shrink-0 bg-muted"
        style={{ width: size, height: size }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  };

  // Get the next upcoming match for the hero section
  const nextMatch: FFFLiveMatch | null = (() => {
    for (const group of liveUpcoming) {
      for (const m of group.matchs) {
        if (m.date) return m;
      }
    }
    return null;
  })();

  // Countdown timer
  useEffect(() => {
    if (!nextMatch?.date) return;
    const target = new Date(nextMatch.date);
    const update = () => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
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

  // Check if match is live (today)
  const isMatchLive = (matchDate: string) => {
    const today = new Date().toISOString().split('T')[0];
    const mDate = new Date(matchDate).toISOString().split('T')[0];
    return today === mDate;
  };

  // Load FFF competitions when the modal opens
  useEffect(() => {
    if (!showAddChamp) return;
    setIsLoadingEquipes(true);
    getEquipes(OISEMONT_CL_NO)
      .then((data) => {
        const comps = getAllCompetitions(Array.isArray(data) ? data : data?.equipes || []);
        setFffCompetitions(comps);
      })
      .catch((err) => {
        console.error('Error loading FFF equipes:', err);
        toast.error('Impossible de charger les équipes FFF');
      })
      .finally(() => setIsLoadingEquipes(false));
  }, [showAddChamp]);

  // Auto-fetch live classement AND matches — use DB cache first, fallback to API
  useEffect(() => {
    if (!dataLoaded) return; // Wait for DB data before deciding cache vs API
    let cancelled = false;
    const teamMapping: Record<string, { categoryCode: string; code: number }> = {
      'A': { categoryCode: 'SEM', code: 1 },
      'B': { categoryCode: 'SEM', code: 2 },
      'C': { categoryCode: 'SEM', code: 3 },
    };
    
    const mapping = teamMapping[selectedTeam];
    
    // For custom teams, try to decode fffUrl from the championship
    let customParams: { cpNo: number; phase: number; poule: number } | null = null;
    if (!mapping) {
      const customChamp = championships.find(c => (c.team || 'A') === selectedTeam && c.fffUrl);
      if (customChamp?.fffUrl) {
        customParams = decodeFFFApiRef(customChamp.fffUrl);
      }
      if (!customParams) {
        setLiveClassement([]);
        setLiveLogos({});
        setLiveError('Pas de classement FFF pour cette équipe');
        setIsLoadingLive(false);
        setLiveUpcoming([]);
        setLiveResults([]);
        setIsLoadingMatches(false);
        return;
      }
    }

    // Check if any championship for this team has a valid DB cache (< 24h)
    const teamChamp = championships.find(c => (c.team || 'A') === selectedTeam && c.fffLiveCache && c.fffRefreshedAt);
    const cacheAge = teamChamp?.fffRefreshedAt ? Date.now() - new Date(teamChamp.fffRefreshedAt).getTime() : Infinity;
    const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

    if (teamChamp?.fffLiveCache && cacheAge < CACHE_MAX_AGE) {
      // Use DB cache — zero API calls!
      const cache = teamChamp.fffLiveCache;
      
      if (cache.classement && Array.isArray(cache.classement)) {
        const standings = mapClassementToStandings(cache.classement);
        setLiveClassement(standings);
        
        // Extract logos from classement
        const logosFromClassement: Record<number, string> = {};
        for (const entry of cache.classement) {
          const clNo = entry.equipe?.club?.cl_no;
          const logo = entry.equipe?.club?.logo;
          if (clNo && logo) logosFromClassement[clNo] = logo;
        }
        setLiveLogos(prev => ({ ...logosFromClassement, ...(cache.logos || {}), ...prev }));
      } else {
        setLiveError('Classement non disponible');
      }
      
      setLiveUpcoming(cache.upcoming || []);
      setLiveResults(cache.results || []);
      setIsLoadingLive(false);
      setIsLoadingMatches(false);
      return;
    }

    // No cache or stale — fetch from API (this will be rare after cron is running)
    const fetchAll = async () => {
      setIsLoadingLive(true);
      setIsLoadingMatches(true);
      setLiveError(null);
      setLiveClassement([]);
      setLiveLogos({});
      setLiveUpcoming([]);
      setLiveResults([]);
      
      try {
        let champParams: { cpNo: number; phase: number; poule: number } | null = customParams;
        
        if (!champParams && mapping) {
          const equipesData = await getEquipes(OISEMONT_CL_NO);
          const equipes = Array.isArray(equipesData) ? equipesData : equipesData?.equipes || [];
          champParams = getTeamChampionship(equipes, mapping.categoryCode, mapping.code);
        }
        
        if (!champParams) {
          setLiveError('Aucun championnat trouvé pour cette équipe');
          return;
        }
        
        const [classementData, upcoming, results] = await Promise.all([
          getClassement(champParams.cpNo, champParams.phase, champParams.poule),
          getTousMatchsAvenir(champParams.cpNo, champParams.phase, champParams.poule),
          getTousResultats(champParams.cpNo, champParams.phase, champParams.poule),
        ]);
        if (cancelled) return;
        
        const members = classementData?.['hydra:member'] || classementData;
        const totalItems = classementData?.['hydra:totalItems'] ?? (Array.isArray(members) ? members.length : 0);
        
        if (totalItems === 0) {
          setLiveError('Classement non disponible');
        } else {
          const standings = mapClassementToStandings(members);
          setLiveClassement(standings);
          
          if (Array.isArray(members)) {
            const logosFromClassement: Record<number, string> = {};
            for (const entry of members) {
              const clNo = entry.equipe?.club?.cl_no;
              const logo = entry.equipe?.club?.logo;
              if (clNo && logo) logosFromClassement[clNo] = logo;
            }
            setLiveLogos(logosFromClassement);
          }
          
          try {
            const [resultatsData, calendrierData] = await Promise.all([
              getResultats(champParams.cpNo, champParams.phase, champParams.poule).catch(() => null),
              getCalendrier(champParams.cpNo, champParams.phase, champParams.poule).catch(() => null),
            ]);
            if (!cancelled) {
              const logosResultats = resultatsData ? extractTeamLogosFromResults(resultatsData) : {};
              const logosCalendrier = calendrierData ? extractTeamLogosFromResults(calendrierData) : {};
              setLiveLogos(prev => ({ ...prev, ...logosResultats, ...logosCalendrier }));
            }
          } catch {}

          if (Array.isArray(members) && members.length > 0) {
            // Save cache even if no teamChamp exists yet — find or use any championship for this team
            const champToCache = teamChamp || championships.find(c => (c.team || 'A') === selectedTeam);
            const liveCache: Record<string, any> = { classement: members, upcoming, results };
            const liveLogosCache: Record<number, string> = {};
            for (const entry of members) {
              const clNo = entry.equipe?.club?.cl_no;
              const logo = entry.equipe?.club?.logo;
              if (clNo && logo) liveLogosCache[clNo] = logo;
            }
            if (Object.keys(liveLogosCache).length > 0) liveCache.logos = liveLogosCache;
            if (champToCache) {
              supabase
                .from('championships')
                .update({ fff_live_cache: liveCache, fff_refreshed_at: new Date().toISOString() } as any)
                .eq('id', champToCache.id)
                .then(({ error }) => {
                  if (error) console.error('Failed to save FFF cache:', error);
                  else console.log('FFF cache saved for team', selectedTeam);
                });
            }
          }
        }
        
        setLiveUpcoming(upcoming);
        setLiveResults(results);
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching live data:', err);
          setLiveError('Erreur lors du chargement');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLive(false);
          setIsLoadingMatches(false);
        }
      }
    };
    
    fetchAll();
    return () => { cancelled = true; };
  }, [selectedTeam, championships.length, dataLoaded]);

  const handleImportCompetition = async (comp: FFFCompetition) => {
    setSelectedCompetition(comp);
    setIsImportingFFF(true);
    try {
      const [classementData, resultatsData, calendrierData] = await Promise.all([
        getClassement(comp.cpNo, comp.phase, comp.poule).catch(() => null),
        getResultats(comp.cpNo, comp.phase, comp.poule).catch(() => null),
        getCalendrier(comp.cpNo, comp.phase, comp.poule).catch(() => null),
      ]);

      const standings = mapClassementToStandings(classementData);
      const resultMatches = mapMatchesToScrapedMatches(resultatsData);
      const calendarMatches = mapMatchesToScrapedMatches(calendrierData);
      const logos = extractTeamLogosFromClassement(classementData);

      const allMatches = [...resultMatches];
      const seen = new Set(resultMatches.map(m => `${m.homeTeam}-${m.awayTeam}-${m.date}`));
      for (const m of calendarMatches) {
        const key = `${m.homeTeam}-${m.awayTeam}-${m.date}`;
        if (!seen.has(key)) {
          allMatches.push(m);
          seen.add(key);
        }
      }

      const teams = standings.length > 0
        ? standings.map(s => s.team)
        : [...new Set(allMatches.flatMap(m => [m.homeTeam, m.awayTeam]))];

      setImportedStandings(standings);
      setImportedMatches(allMatches);
      setImportedLogos(logos);
      setImportedTeams(teams);
      setChampName(comp.competitionName || '');

      toast.success(`${teams.length} équipes, ${allMatches.length} matchs, ${standings.length} classements importés`);
    } catch (err) {
      console.error('Error importing competition:', err);
      toast.error('Erreur lors de l\'import de la compétition');
    } finally {
      setIsImportingFFF(false);
    }
  };

  const handleAddChamp = () => {
    if (!champName.trim()) return;
    // For admin+, use team selector; for others, auto-create a tab with the championship name
    let finalTeam: string;
    if (currentUserRole === 'admin+') {
      finalTeam = champTeam === '__new__' ? customTeamName.trim() : champTeam;
      if (!finalTeam) { toast.error('Entrez un nom d\'équipe'); return; }
    } else {
      // Auto-generate a unique team name from the championship name
      finalTeam = champName.trim();
    }
    const teams = importedTeams.length > 0 ? importedTeams : [];
    if (teams.length < 2) { toast.warning('Importez une compétition FFF avec au moins 2 équipes'); return; }
    if (teamHasChampionship(finalTeam)) { toast.error(`L'équipe ${finalTeam} a déjà un championnat`); return; }
    
    const fffUrl = selectedCompetition 
      ? encodeFFFApiRef(selectedCompetition.cpNo, selectedCompetition.phase, selectedCompetition.poule)
      : undefined;

    onAddChampionship({ 
      name: champName, season: champSeason, teams, 
      fffUrl, 
      matches: importedMatches.length > 0 ? importedMatches : undefined, 
      standings: importedStandings.length > 0 ? importedStandings : undefined, 
      teamLogos: Object.keys(importedLogos).length > 0 ? importedLogos : undefined, 
      team: finalTeam 
    });
    // Switch to the newly created team's tab
    setSelectedTeam(finalTeam);
    resetForm();
  };

  const resetForm = () => {
    setChampName(''); setImportedMatches([]); setImportedStandings([]); setImportedLogos({}); 
    setImportedTeams([]); setChampTeam('A'); setCustomTeamName(''); setSelectedCompetition(null); setShowAddChamp(false);
  };

  const handleAddMatch = (champId: string) => {
    if (!matchHome || !matchAway || !matchDate) return;
    onAddMatch({
      championshipId: champId,
      homeTeam: matchHome,
      awayTeam: matchAway,
      homeScore: null,
      awayScore: null,
      date: matchDate,
      journee: matchJournee,
      played: false,
    });
    setMatchHome(''); setMatchAway(''); setMatchDate(''); setMatchJournee(1); setShowAddMatch(null);
  };

  const handleSaveScore = (matchId: string) => {
    onUpdateMatchScore(matchId, editHome, editAway);
    setEditingMatch(null);
  };

  const filteredChampIds = new Set(filteredChampionships.map(c => c.id));

  // Compute Oisemont bilan from results
  const computeBilan = () => {
    let v = 0, n = 0, d = 0;
    liveResults.forEach(g => g.matchs.forEach((m: FFFLiveMatch) => {
      const hs = m.home_score ?? null;
      const as = m.away_score ?? null;
      if (hs === null || as === null) return;
      const isHome = m.home?.club?.cl_no === OISEMONT_CL_NO;
      const ourScore = isHome ? hs : as;
      const theirScore = isHome ? as : hs;
      if (ourScore > theirScore) v++;
      else if (ourScore === theirScore) n++;
      else d++;
    }));
    return { v, n, d };
  };
  const bilan = computeBilan();

  // Compute streak from results (last 5)
  const computeStreak = (): string[] => {
    const results: string[] = [];
    for (const g of liveResults) {
      for (const m of g.matchs) {
        const hs = m.home_score ?? null;
        const as = m.away_score ?? null;
        if (hs === null || as === null) continue;
        const isHome = m.home?.club?.cl_no === OISEMONT_CL_NO;
        const ourScore = isHome ? hs : as;
        const theirScore = isHome ? as : hs;
        if (ourScore > theirScore) results.push('V');
        else if (ourScore === theirScore) results.push('N');
        else results.push('D');
      }
    }
    return results.slice(0, 5);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ─── Header ─── */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-xl flex items-center justify-center">
            <Trophy className="text-accent" size={18} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Championnats</h2>
            <p className="text-xs text-muted-foreground">Saison 2025-2026</p>
          </div>
        </div>
        {canManage() && (
          currentUserRole === 'admin+' ? (
            <motion.button 
              whileHover={!teamHasChampionship(selectedTeam) ? { scale: 1.05 } : {}} 
              whileTap={!teamHasChampionship(selectedTeam) ? { scale: 0.95 } : {}}
              onClick={() => { if (!teamHasChampionship(selectedTeam)) { setChampTeam(selectedTeam); setShowAddChamp(true); } }} 
              disabled={teamHasChampionship(selectedTeam)}
              className={cn(
                "flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-medium transition-all text-xs sm:text-sm",
                teamHasChampionship(selectedTeam)
                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                  : "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
              )}
            >
              <Plus size={16} /> <span className="hidden sm:inline">Nouveau</span>
            </motion.button>
          ) : (
            <motion.button 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              onClick={() => { setShowAddChamp(true); }} 
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-medium transition-all text-xs sm:text-sm bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Nouveau</span>
            </motion.button>
          )
        )}
      </motion.div>

      {/* ─── Team selector ─── */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.08 }}
      >
        <div className="flex items-center gap-1.5 bg-secondary/60 backdrop-blur-sm rounded-xl border border-border/50 p-1">
          {/* Pills A B C */}
          {BASE_TEAMS.map(team => (
            <button
              key={team}
              onClick={() => setSelectedTeam(team)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                selectedTeam === team
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              Équipe {team}
            </button>
          ))}

          {/* Dropdown pour les customs */}
          {customTeams.length > 0 && (
            <Popover open={customPopoverOpen} onOpenChange={setCustomPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                    !BASE_TEAMS.includes(selectedTeam)
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {!BASE_TEAMS.includes(selectedTeam) ? selectedTeam : "Autres"}
                  <ChevronDown size={12} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-40 p-1 bg-popover border border-border shadow-lg rounded-xl z-50">
                {customTeams.map(team => (
                  <button
                    key={team}
                    onClick={() => { setSelectedTeam(team); setCustomPopoverOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      selectedTeam === team
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-secondary"
                    )}
                  >
                    {team}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </motion.div>

      {/* Delete tab confirmation */}
      {deletingTab && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-destructive font-medium">Supprimer l'onglet « {deletingTab} » et ses championnats ?</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setDeletingTab(null)} className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-foreground">Annuler</button>
            <button onClick={() => {
              const champsToDelete = championships.filter(c => (c.team || 'A') === deletingTab);
              champsToDelete.forEach(c => onDeleteChampionship(c.id));
              if (selectedTeam === deletingTab) setSelectedTeam('A');
              setDeletingTab(null);
            }} className="text-xs px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground font-medium">Supprimer</button>
          </div>
        </motion.div>
      )}

      {/* ─── Live classement (enriched) ─── */}
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-accent/20 to-accent/5 rounded-xl flex items-center justify-center">
              <BarChart3 size={17} className="text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Classement</h3>
              <p className="text-[11px] text-muted-foreground">Équipe {selectedTeam} — Live FFF</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isLoadingLive && <Loader2 size={16} className="text-accent animate-spin" />}
            {canManage() && filteredChampionships.length > 0 && (() => {
              const champ = filteredChampionships[0];
              return (
                <>
                  {canUpdateChampionnat() && champ.fffUrl && onRefreshFromFFF && (
                    <button
                      onClick={async () => {
                        clearFFFCache();
                        setRefreshingChamp(champ.id);
                        try {
                          const result = await onRefreshFromFFF(champ.id, champ.fffUrl!);
                          setRefreshResult({ ...result, champName: champ.name });
                        } finally {
                          setRefreshingChamp(null);
                        }
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-accent hover:bg-accent/10 transition-all"
                      title="Actualiser"
                    >
                      <RefreshCw size={14} className={refreshingChamp === champ.id ? 'animate-spin' : ''} />
                    </button>
                  )}
                  {!BASE_TEAMS.includes(selectedTeam) && currentUserRole === 'admin+' && (
                    <button
                      onClick={() => { setEditingTab(selectedTeam); setEditTabName(selectedTeam); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      title="Renommer"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {currentUserRole === 'admin+' && (
                    !BASE_TEAMS.includes(selectedTeam) ? (
                      <button
                        onClick={() => setDeletingTab(selectedTeam)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => onDeleteChampionship(champ.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isLoadingLive ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="w-10 h-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              <span className="text-xs text-muted-foreground">Chargement du classement...</span>
            </motion.div>
          ) : liveError ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <AlertCircle size={16} />
              <span className="text-sm">{liveError}</span>
            </motion.div>
          ) : liveClassement.length > 0 ? (
            <motion.div key="table" variants={stagger} initial="hidden" animate="show" className="overflow-x-auto">
              {/* Table header */}
              <div className="min-w-[640px]">
                <div className="grid grid-cols-[2rem_1fr_2.5rem_2rem_2rem_2rem_2rem_2rem_2rem_2.5rem_2.5rem_2.5rem_3.5rem] items-center px-3 py-2 border-b border-border/50 bg-secondary/30 gap-0.5">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">#</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Équipe</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">Pts</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">J</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">G</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">N</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">P</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">F</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">P/Bo</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">Bp</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">Bc</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">Diff</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase text-center">Série</span>
                </div>
                {liveClassement.map((s, i) => {
                  const isOisemont = s.clNo === OISEMONT_CL_NO;
                  const logo = s.clNo ? (liveLogos[s.clNo] || null) : null;
                  const streak = isOisemont ? computeStreak() : [];
                  
                  return (
                    <motion.div
                      key={`${s.team}-${i}`}
                      variants={fadeUp}
                      className={`grid grid-cols-[2rem_1fr_2.5rem_2rem_2rem_2rem_2rem_2rem_2rem_2.5rem_2.5rem_2.5rem_3.5rem] items-center px-3 py-2.5 border-b border-border/20 transition-colors gap-0.5 ${
                        isOisemont ? 'bg-accent/10' : 'hover:bg-secondary/30'
                      }`}
                    >
                      <span className={`text-xs font-black text-center ${isOisemont ? 'text-accent' : 'text-muted-foreground'}`}>{s.rank}</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {logo ? (
                          <img src={logo} alt={s.team} className="w-6 h-6 rounded-full object-cover shrink-0 bg-card" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 text-[9px] font-bold text-muted-foreground">{s.team?.charAt(0)}</div>
                        )}
                        <span className={`text-[11px] leading-tight truncate ${isOisemont ? 'font-extrabold text-accent' : 'font-semibold text-foreground'}`}>{s.team}</span>
                      </div>
                      <span className={`text-center text-xs font-black ${isOisemont ? 'text-accent' : 'text-foreground'}`}>{s.points}</span>
                      <span className="text-center text-[11px] text-muted-foreground">{s.played}</span>
                      <span className="text-center text-[11px] text-muted-foreground">{s.won}</span>
                      <span className="text-center text-[11px] text-muted-foreground">{s.drawn}</span>
                      <span className="text-center text-[11px] text-muted-foreground">{s.lost}</span>
                      <span className="text-center text-[11px] text-muted-foreground">{s.forfeits}</span>
                      <span className="text-center text-[11px] text-muted-foreground">{s.penalties}</span>
                      <span className="text-center text-[11px] text-muted-foreground">{s.goalsFor}</span>
                      <span className="text-center text-[11px] text-muted-foreground">{s.goalsAgainst}</span>
                      <span className={`text-center text-[11px] font-bold ${s.goalDiff > 0 ? 'text-emerald-600' : s.goalDiff < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}</span>
                      <div className="flex items-center justify-center gap-0.5">
                        {isOisemont && streak.length > 0 ? streak.map((r, ri) => (
                          <div key={ri} className={`w-3.5 h-3.5 rounded-full text-[7px] font-black flex items-center justify-center text-white ${
                            r === 'V' ? 'bg-emerald-500' : r === 'N' ? 'bg-gray-400' : 'bg-red-500'
                          }`}>{r}</div>
                        )) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-14">Sélectionnez une équipe pour voir le classement</p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Bilan (cercles minimalistes) ─── */}
      {(bilan.v + bilan.n + bilan.d) > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="flex items-center justify-center gap-5"
        >
          {[
            { val: bilan.v, label: 'V', bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
            { val: bilan.n, label: 'N', bg: 'bg-slate-400/10', text: 'text-slate-500' },
            { val: bilan.d, label: 'D', bg: 'bg-red-500/10', text: 'text-red-500' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center gap-1.5">
              <div className={`w-14 h-14 rounded-full ${item.bg} flex items-center justify-center`}>
                <span className={`text-xl font-black ${item.text} leading-none`}>{item.val}</span>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${item.text}`}>{item.label}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* ─── Next Match Hero (Premium) ─── */}
      {nextMatch && !isLoadingMatches && (() => {
        const live = isMatchLive(nextMatch.date);
        const homeName = nextMatch.home?.short_name || nextMatch.home?.name || '';
        const awayName = nextMatch.away?.short_name || nextMatch.away?.name || '';
        
        const homeClNo = nextMatch.home?.club?.cl_no;
        const awayClNo = nextMatch.away?.club?.cl_no;
        const homeStanding = liveClassement.find(s => s.clNo === homeClNo);
        const awayStanding = liveClassement.find(s => s.clNo === awayClNo);
        const homeRank = homeStanding ? liveClassement.indexOf(homeStanding) + 1 : undefined;
        const awayRank = awayStanding ? liveClassement.indexOf(awayStanding) + 1 : undefined;
        
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={`relative rounded-2xl overflow-hidden border shadow-sm ${
              live ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-border/60'
            } bg-card`}
          >
            {live && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-400 to-red-500 animate-pulse" />
            )}

            <div className="px-5 py-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Timer size={14} className="text-accent" />
                  </div>
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-widest">Prochain Match</span>
                </div>
                {live && (
                  <span className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    LIVE
                  </span>
                )}
              </div>

              {/* Teams & VS */}
              <div className="flex items-center justify-center gap-5 mb-5">
                <div className="flex flex-col items-center gap-2.5 flex-1">
                  {nextMatch.home?.club?.logo ? (
                    <img src={nextMatch.home.club.logo} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-border/30 shadow-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : <div className="w-16 h-16 rounded-full bg-secondary" />}
                  <span className={`text-xs font-bold text-center leading-tight ${nextMatch.home?.club?.cl_no === OISEMONT_CL_NO ? 'text-accent' : 'text-foreground'}`}>
                    {homeName}
                  </span>
                  {homeRank && <span className="text-[9px] text-muted-foreground font-medium">{homeRank}e au classement</span>}
                </div>
                <div className="relative">
                  <motion.span 
                    animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-2xl font-black text-blue-500"
                    style={{ textShadow: '0 0 20px hsl(217 91% 60% / 0.5), 0 0 40px hsl(217 91% 60% / 0.2)' }}
                  >VS</motion.span>
                </div>
                <div className="flex flex-col items-center gap-2.5 flex-1">
                  {nextMatch.away?.club?.logo ? (
                    <img src={nextMatch.away.club.logo} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-border/30 shadow-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : <div className="w-16 h-16 rounded-full bg-secondary" />}
                  <span className={`text-xs font-bold text-center leading-tight ${nextMatch.away?.club?.cl_no === OISEMONT_CL_NO ? 'text-accent' : 'text-foreground'}`}>
                    {awayName}
                  </span>
                  {awayRank && <span className="text-[9px] text-muted-foreground font-medium">{awayRank}e au classement</span>}
                </div>
              </div>

              {/* Countdown */}
              {!live && (
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  {[
                    { val: countdown.days, label: 'JOURS' },
                    { val: countdown.hours, label: 'HEURES' },
                    { val: countdown.minutes, label: 'MIN' },
                    { val: countdown.seconds, label: 'SEC' },
                  ].map((c, i) => (
                    <React.Fragment key={c.label}>
                      {i > 0 && <span className="text-lg font-black text-accent/40 animate-pulse mx-0.5">:</span>}
                      <div className="bg-secondary rounded-xl px-3 py-2 text-center min-w-[48px]">
                        <div className="text-lg font-black text-foreground leading-none">{String(c.val).padStart(2, '0')}</div>
                        <div className="text-[7px] font-bold text-muted-foreground uppercase mt-1 tracking-wider">{c.label}</div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* Date & Time */}
              <p className="text-[11px] text-muted-foreground text-center mb-3">
                {nextMatch.date ? new Date(nextMatch.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                {nextMatch.time ? ` • ${nextMatch.time}` : ''}
              </p>

              {/* Bet button */}
              {currentUser && !live && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setBetMatch({
                    homeTeam: homeName,
                    awayTeam: awayName,
                    matchDate: nextMatch.date,
                    homeLogo: nextMatch.home?.club?.logo,
                    awayLogo: nextMatch.away?.club?.logo,
                  })}
                  className="w-full py-3 bg-accent text-accent-foreground rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-accent/20 hover:brightness-110 transition-all"
                >
                  <Zap size={15} />
                  <span>Parier sur ce match</span>
                </motion.button>
              )}

              {/* Location */}
              {(() => {
                const link = buildLocationLink(nextMatch.terrain);
                const label = [nextMatch.terrain?.name, nextMatch.terrain?.city].filter(Boolean).join(', ');
                if (!label) return null;
                return (
                  <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-border/30">
                    <MapPin size={11} className="text-muted-foreground shrink-0" />
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent underline underline-offset-2 truncate max-w-[250px] flex items-center gap-1">
                        {label} <ExternalLink size={9} />
                      </a>
                    ) : (
                      <span className="text-[10px] text-muted-foreground truncate">{label}</span>
                    )}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        );
      })()}

      {/* ─── Bet Leaderboard (remonté) ─── */}
      <BetLeaderboard />

      {/* ─── Matches sections ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Prochains matchs */}
        <motion.div 
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/50 bg-gradient-to-r from-accent/5 to-transparent">
            <div className="w-9 h-9 bg-gradient-to-br from-accent/20 to-accent/5 rounded-xl flex items-center justify-center">
              <Clock size={17} className="text-accent" />
            </div>
            <h3 className="font-bold text-foreground text-sm">Prochains matchs</h3>
          </div>
          {isLoadingMatches ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="w-10 h-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              <span className="text-xs text-muted-foreground">Chargement...</span>
            </div>
          ) : liveUpcoming.length === 0 ? (
            <div className="text-center py-14">
              <Calendar size={32} className="mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">Aucun match à venir</p>
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="divide-y divide-border/30">
              {liveUpcoming.map((group) => (
                <div key={group.mois}>
                  <div className="px-5 py-2 bg-secondary/30">
                    <span className="text-[11px] font-bold text-accent uppercase tracking-widest">{group.mois}</span>
                  </div>
                  {group.matchs.map((match: FFFLiveMatch, idx: number) => {
                    const isHome = match.home?.club?.cl_no === OISEMONT_CL_NO;
                    const homeName = match.home?.short_name || match.home?.name || '';
                    const awayName = match.away?.short_name || match.away?.name || '';
                    const homeLogo = match.home?.club?.logo;
                    const awayLogo = match.away?.club?.logo;
                    const mDate = match.date ? new Date(match.date) : null;
                    const now = new Date();
                    const diffDays = mDate ? Math.ceil((mDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 999;
                    const isImminent = diffDays <= 3 && diffDays >= 0;
                    const locationLink = buildLocationLink(match.terrain);
                    const locationLabel = [match.terrain?.name, match.terrain?.city].filter(Boolean).join(', ');
                    const live = match.date && isMatchLive(match.date);
                    
                    return (
                      <motion.div 
                        key={`${match.date}-${idx}`} 
                        variants={fadeUp}
                        className={`px-5 py-4 transition-all ${live ? 'bg-red-500/5' : isImminent ? 'bg-accent/5' : 'hover:bg-secondary/30'}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {mDate?.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {match.time ? ` • ${match.time}` : ''}
                          </span>
                          <div className="flex items-center gap-2">
                            {live && (
                              <span className="flex items-center gap-1 text-[9px] font-black uppercase text-red-500 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> LIVE
                              </span>
                            )}
                            {!live && isImminent && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                                {diffDays <= 0 ? "Auj." : diffDays === 1 ? 'Demain' : `J-${diffDays}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                            <span className={`text-xs font-bold truncate text-right ${isHome ? 'text-accent' : 'text-foreground'}`}>{homeName}</span>
                            {homeLogo ? <img src={homeLogo} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-border/30 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-8 h-8 rounded-full bg-secondary shrink-0" />}
                          </div>
                          <div className="px-2.5 py-1 rounded-lg bg-secondary/80 border border-border/50 text-[10px] font-black text-muted-foreground tracking-widest shrink-0">
                            VS
                          </div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {awayLogo ? <img src={awayLogo} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-border/30 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-8 h-8 rounded-full bg-secondary shrink-0" />}
                            <span className={`text-xs font-bold truncate ${!isHome ? 'text-accent' : 'text-foreground'}`}>{awayName}</span>
                          </div>
                        </div>
                        {locationLabel && (
                          <div className="flex items-center justify-center gap-1 mt-2">
                            <MapPin size={10} className="text-accent shrink-0" />
                            {locationLink ? (
                              <a href={locationLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent/80 underline underline-offset-2 truncate max-w-[200px] flex items-center gap-0.5">
                                {locationLabel} <ExternalLink size={8} />
                              </a>
                            ) : (
                              <span className="text-[10px] text-muted-foreground truncate">{locationLabel}</span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Derniers résultats */}
        <motion.div 
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center">
              <Award size={17} className="text-primary" />
            </div>
            <h3 className="font-bold text-foreground text-sm">Derniers résultats</h3>
          </div>
          {isLoadingMatches ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Chargement...</span>
            </div>
          ) : liveResults.length === 0 ? (
            <div className="text-center py-14">
              <Award size={32} className="mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">Aucun résultat</p>
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="divide-y divide-border/30">
              {liveResults.map((group) => (
                <div key={group.mois}>
                  <div className="px-5 py-2 bg-secondary/30">
                    <span className="text-[11px] font-bold text-primary uppercase tracking-widest">{group.mois}</span>
                  </div>
                  {group.matchs.map((match: FFFLiveMatch, idx: number) => {
                    const homeScore = match.home_score ?? null;
                    const awayScore = match.away_score ?? null;
                    const isHome = match.home?.club?.cl_no === OISEMONT_CL_NO;
                    const homeName = match.home?.short_name || match.home?.name || '';
                    const awayName = match.away?.short_name || match.away?.name || '';
                    const homeLogo = match.home?.club?.logo;
                    const awayLogo = match.away?.club?.logo;
                    const isHomeWin = homeScore !== null && awayScore !== null && homeScore > awayScore;
                    const isAwayWin = homeScore !== null && awayScore !== null && awayScore > homeScore;
                    const matchDateObj = match.date ? new Date(match.date) : null;
                    
                    const isOisemontWin = (isHome && isHomeWin) || (!isHome && isAwayWin);
                    const isOisemontLoss = (isHome && isAwayWin) || (!isHome && isHomeWin);

                    return (
                      <motion.div 
                        key={`${match.date}-${idx}`} 
                        variants={fadeUp}
                        className="px-5 py-4 hover:bg-secondary/30 transition-all"
                      >
                        <p className="text-[10px] text-muted-foreground text-center mb-3 font-medium">
                          {matchDateObj?.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                            <span className={`text-xs font-bold truncate text-right ${isHomeWin ? 'text-foreground' : 'text-muted-foreground'}`}>{homeName}</span>
                            {homeLogo ? <img src={homeLogo} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-border/30 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-8 h-8 rounded-full bg-secondary shrink-0" />}
                          </div>
                          <div className={`px-3 py-1.5 rounded-xl text-sm font-black min-w-[56px] text-center tracking-wider shadow-sm ${
                            isOisemontWin 
                              ? 'bg-emerald-500 text-white' 
                              : isOisemontLoss 
                                ? 'bg-red-500 text-white' 
                                : 'bg-secondary text-foreground border border-border/50'
                          }`}>
                            {homeScore} - {awayScore}
                          </div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {awayLogo ? <img src={awayLogo} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-border/30 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-8 h-8 rounded-full bg-secondary shrink-0" />}
                            <span className={`text-xs font-bold truncate ${isAwayWin ? 'text-foreground' : 'text-muted-foreground'}`}>{awayName}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* ─── Modal: Add Championship ─── */}
      {showAddChamp && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[70]" onClick={() => { resetForm(); }}>
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md border border-border shadow-2xl max-h-[90vh] flex flex-col" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                  <Trophy size={20} className="text-accent" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Nouveau championnat</h3>
              </div>
              <button onClick={() => resetForm()} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Team selector — admin+ only */}
              {currentUserRole === 'admin+' && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Équipe</label>
                <div className="flex gap-2 flex-wrap">
                  {allTeamOptions.map(team => (
                    <button
                      key={team}
                      type="button"
                      onClick={() => { setChampTeam(team); setCustomTeamName(''); }}
                      disabled={teamHasChampionship(team)}
                      className={`px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        champTeam === team
                          ? 'bg-accent text-accent-foreground shadow-sm'
                          : teamHasChampionship(team)
                            ? 'bg-secondary/50 text-muted-foreground/40 cursor-not-allowed line-through'
                            : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {BASE_TEAMS.includes(team) ? `Équipe ${team}` : team}
                      {teamHasChampionship(team) && ' ✓'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setChampTeam('__new__')}
                    className={`px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      champTeam === '__new__'
                        ? 'bg-accent text-accent-foreground shadow-sm'
                        : 'bg-secondary text-muted-foreground hover:bg-secondary/80 border-2 border-dashed border-border'
                    }`}
                  >
                    + Autre
                  </button>
                </div>
                {champTeam === '__new__' && (
                  <input
                    value={customTeamName}
                    onChange={e => setCustomTeamName(e.target.value)}
                    placeholder="Nom de l'équipe (ex: U18, Vétérans)"
                    className="w-full mt-2 px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all"
                  />
                )}
              </div>
              )}

              {/* FFF Competition selector */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Compétition FFF</label>
                {isLoadingEquipes ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                    <Loader2 size={16} className="animate-spin" />
                    Chargement des compétitions...
                  </div>
                ) : fffCompetitions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune compétition trouvée</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {fffCompetitions.map((comp, i) => (
                      <button
                        key={`${comp.cpNo}-${i}`}
                        type="button"
                        onClick={() => handleImportCompetition(comp)}
                        disabled={isImportingFFF}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                          selectedCompetition?.cpNo === comp.cpNo
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : 'bg-secondary border-border hover:bg-secondary/80 text-foreground'
                        } ${isImportingFFF ? 'opacity-50 cursor-wait' : ''}`}
                      >
                        <div className="font-semibold">{comp.competitionName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{comp.equipe} • {comp.category}</div>
                      </button>
                    ))}
                  </div>
                )}
                {isImportingFFF && (
                  <div className="flex items-center gap-2 text-sm text-accent mt-2 justify-center">
                    <Loader2 size={14} className="animate-spin" />
                    Import en cours...
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nom</label>
                <input value={champName} onChange={e => setChampName(e.target.value)} placeholder="Ex: Championnat District D6" className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" />
              </div>

              {/* Season */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Saison</label>
                <input value={champSeason} onChange={e => setChampSeason(e.target.value)} placeholder="2024-2025" className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" />
              </div>

              {/* Import summary */}
              {importedTeams.length > 0 && (
                <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                    <CheckCircle2 size={16} />
                    Données importées
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-secondary/50 rounded-lg p-2">
                      <div className="text-lg font-black text-foreground">{importedTeams.length}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Équipes</div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-2">
                      <div className="text-lg font-black text-foreground">{importedMatches.length}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Matchs</div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-2">
                      <div className="text-lg font-black text-foreground">{importedStandings.length}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Classement</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-border shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <button onClick={() => resetForm()} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
                Annuler
              </button>
              <button onClick={handleAddChamp} disabled={!champName.trim() || importedTeams.length < 2} className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-accent/20">
                Créer le championnat
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Modal: Add Match ─── */}
      {showAddMatch && (() => {
        const champ = championships.find(c => c.id === showAddMatch);
        if (!champ) return null;
        return (
          <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[70]" onClick={() => setShowAddMatch(null)}>
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md border border-border shadow-2xl max-h-[90vh] flex flex-col" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                    <Calendar size={20} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Nouveau match</h3>
                    <p className="text-xs text-muted-foreground">{champ.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowAddMatch(null)} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Journée</label>
                  <p className="text-[11px] text-muted-foreground/70 mb-2">Le numéro du tour (ex: J1 = 1er week-end de matchs)</p>
                  <input type="number" min="1" value={matchJournee} onChange={e => setMatchJournee(Number(e.target.value))} placeholder="Ex: 1" className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Équipe domicile</label>
                  <p className="text-[11px] text-muted-foreground/70 mb-2">L'équipe qui reçoit (joue à la maison)</p>
                  <select value={matchHome} onChange={e => setMatchHome(e.target.value)} className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all appearance-none">
                    <option value="">Sélectionner...</option>
                    {champ.teams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Équipe extérieur</label>
                  <p className="text-[11px] text-muted-foreground/70 mb-2">L'équipe qui se déplace</p>
                  <select value={matchAway} onChange={e => setMatchAway(e.target.value)} className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all appearance-none">
                    <option value="">Sélectionner...</option>
                    {champ.teams.filter(t => t !== matchHome).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Date du match</label>
                  <p className="text-[11px] text-muted-foreground/70 mb-2">Quand le match est prévu</p>
                  <NativeDatePicker value={matchDate} onChange={setMatchDate} placeholder="Date du match" />
                </div>
              </div>

              <div className="flex gap-3 p-5 border-t border-border shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <button onClick={() => setShowAddMatch(null)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
                  Annuler
                </button>
                <button onClick={() => handleAddMatch(showAddMatch)} disabled={!matchHome || !matchAway || !matchDate} className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-accent/20">
                  Ajouter
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* ─── Modal: Edit Score ─── */}
      {editingMatch && (() => {
        const match = matches.find(m => m.id === editingMatch);
        if (!match) return null;
        const champ = championships.find(c => c.id === match.championshipId);
        return (
          <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-[70]" onClick={() => setEditingMatch(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                    <Award size={20} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Entrer le score</h3>
                    <p className="text-xs text-muted-foreground">Journée {match.journee} • {champ?.name}</p>
                  </div>
                </div>
                <button onClick={() => setEditingMatch(null)} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="text-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {new Date(match.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 text-center space-y-3">
                    <div className="flex flex-col items-center gap-2">
                      <TeamLogo team={match.homeTeam} champId={match.championshipId} size={40} />
                      <span className="text-sm font-bold text-foreground leading-tight">{match.homeTeam}</span>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Home size={10} />
                        <span>Domicile</span>
                      </div>
                    </div>
                    <input
                      type="number" min="0" value={editHome} onChange={e => setEditHome(Number(e.target.value))}
                      className="w-20 mx-auto text-center rounded-xl border-2 border-border bg-secondary text-3xl font-black py-3 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                    />
                  </div>
                  <div className="text-2xl font-black text-muted-foreground/50 pt-8">—</div>
                  <div className="flex-1 text-center space-y-3">
                    <div className="flex flex-col items-center gap-2">
                      <TeamLogo team={match.awayTeam} champId={match.championshipId} size={40} />
                      <span className="text-sm font-bold text-foreground leading-tight">{match.awayTeam}</span>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Plane size={10} />
                        <span>Extérieur</span>
                      </div>
                    </div>
                    <input
                      type="number" min="0" value={editAway} onChange={e => setEditAway(Number(e.target.value))}
                      className="w-20 mx-auto text-center rounded-xl border-2 border-border bg-secondary text-3xl font-black py-3 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 p-5 border-t border-border">
                <button onClick={() => setEditingMatch(null)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
                  Annuler
                </button>
                <button onClick={() => handleSaveScore(editingMatch)} className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20">
                  Valider le score
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* ─── Modal: Refresh Result ─── */}
      {refreshResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-[70]" onClick={() => setRefreshResult(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${refreshResult.success ? 'bg-accent/10' : 'bg-destructive/10'}`}>
                  {refreshResult.success ? <CheckCircle2 size={20} className="text-accent" /> : <AlertCircle size={20} className="text-destructive" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {refreshResult.success ? 'Mise à jour terminée' : 'Erreur'}
                  </h3>
                  {refreshResult.champName && (
                    <p className="text-xs text-muted-foreground">{refreshResult.champName}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setRefreshResult(null)} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="p-5">
              {refreshResult.success ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/50 rounded-xl p-4 text-center border border-border/50">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <ArrowUpCircle size={14} className="text-accent" />
                        <span className="text-2xl font-black text-foreground">{refreshResult.updated}</span>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Score(s) mis à jour</span>
                    </div>
                    <div className="bg-secondary/50 rounded-xl p-4 text-center border border-border/50">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <PlusCircle size={14} className="text-accent" />
                        <span className="text-2xl font-black text-foreground">{refreshResult.added}</span>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Match(s) ajouté(s)</span>
                    </div>
                  </div>
                  {refreshResult.standingsCount > 0 && (
                    <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 flex items-center gap-3">
                      <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
                        <BarChart3 size={14} className="text-accent" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground">Classement mis à jour</span>
                        <p className="text-xs text-muted-foreground">{refreshResult.standingsCount} équipes</p>
                      </div>
                    </div>
                  )}
                  {refreshResult.updated === 0 && refreshResult.added === 0 && refreshResult.standingsCount === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">Aucun changement détecté — tout est déjà à jour !</p>
                  )}
                </div>
              ) : (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{refreshResult.error}</p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border">
              <button onClick={() => setRefreshResult(null)} className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20">
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Bet Modal ─── */}
      {betMatch && currentUser && (
        <BetModal
          isOpen={!!betMatch}
          onClose={() => setBetMatch(null)}
          homeTeam={betMatch.homeTeam}
          awayTeam={betMatch.awayTeam}
          matchDate={betMatch.matchDate}
          homeLogo={betMatch.homeLogo}
          awayLogo={betMatch.awayLogo}
          userId={currentUser.uid}
          userName={currentUser.name || 'Joueur'}
        />
      )}
    </div>
  );
};

export default ChampionnatTab;
