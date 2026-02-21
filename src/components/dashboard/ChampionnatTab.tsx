import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Trash2, Calendar, Award, ChevronDown, ChevronUp, X, Hash, CalendarDays, Home, Plane, Loader2, RefreshCw, Clock, CheckCircle2, AlertCircle, ArrowUpCircle, PlusCircle, BarChart3, Users, MapPin, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NativeDatePicker from '@/components/ui/native-date-picker';
import { 
  getEquipes, getAllCompetitions, getClassement, getResultats, getCalendrier,
  mapClassementToStandings, mapMatchesToScrapedMatches, extractTeamLogosFromClassement,
  encodeFFFApiRef, OISEMONT_CL_NO, getTeamChampionship,
  getTousMatchsAvenir, getTousResultats,
  type ScrapedMatch, type ScrapedStanding, type FFFCompetition, type FFFMonthGroup, type FFFLiveMatch
} from '@/lib/fffApi';
import { toast } from 'sonner';


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
  onAddMatch: (data: Omit<Match, 'id'>) => void;
  onUpdateMatchScore: (matchId: string, homeScore: number, awayScore: number) => void;
  onDeleteMatch: (id: string) => void;
  onRefreshFromFFF?: (championshipId: string, fffUrl: string) => Promise<{ success: boolean; updated: number; added: number; standingsCount: number; error?: string }>;
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

const ChampionnatTab: React.FC<Props> = ({
  championships,
  matches,
  currentUserRole,
  canManage,
  canUpdateChampionnat,
  onAddChampionship,
  onDeleteChampionship,
  onAddMatch,
  onUpdateMatchScore,
  onDeleteMatch,
  onRefreshFromFFF,
}) => {
  const TEAM_OPTIONS = ['A', 'B', 'C'] as const;
  const [selectedTeam, setSelectedTeam] = useState<string>('A');
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
  const [liveLogos, setLiveLogos] = useState<Record<string, string>>({});
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

  // Refresh result modal
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; updated: number; added: number; standingsCount: number; error?: string; champName?: string } | null>(null);

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

  // Auto-fetch live classement when team changes
  useEffect(() => {
    let cancelled = false;
    const teamMapping: Record<string, { categoryCode: string; code: number }> = {
      'A': { categoryCode: 'SEM', code: 1 },
      'B': { categoryCode: 'SEM', code: 2 },
      'C': { categoryCode: 'SEM', code: 3 },
    };
    
    const mapping = teamMapping[selectedTeam];
    if (!mapping) {
      setLiveClassement([]);
      setLiveLogos({});
      setLiveError(null);
      return;
    }

    const fetchLive = async () => {
      setIsLoadingLive(true);
      setLiveError(null);
      setLiveClassement([]);
      setLiveLogos({});
      try {
        const equipesData = await getEquipes(OISEMONT_CL_NO);
        const equipes = Array.isArray(equipesData) ? equipesData : equipesData?.equipes || [];
        const champParams = getTeamChampionship(equipes, mapping.categoryCode, mapping.code);
        
        if (!champParams) {
          setLiveError('Aucun championnat trouvé pour cette équipe');
          return;
        }
        
        const classementData = await getClassement(champParams.cpNo, champParams.phase, champParams.poule);
        if (cancelled) return;
        
        const members = classementData?.['hydra:member'] || classementData;
        const totalItems = classementData?.['hydra:totalItems'] ?? (Array.isArray(members) ? members.length : 0);
        
        if (totalItems === 0) {
          setLiveError('Classement non disponible');
          return;
        }
        
        const standings = mapClassementToStandings(members);
        const logos = extractTeamLogosFromClassement(members);
        setLiveClassement(standings);
        setLiveLogos(logos);
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching live classement:', err);
          setLiveError('Erreur lors du chargement du classement');
        }
      } finally {
        if (!cancelled) setIsLoadingLive(false);
      }
    };
    
    fetchLive();
    return () => { cancelled = true; };
  }, [selectedTeam]);

  // Auto-fetch live matches (upcoming + results) when team changes
  useEffect(() => {
    let cancelled = false;
    const teamMapping: Record<string, { categoryCode: string; code: number }> = {
      'A': { categoryCode: 'SEM', code: 1 },
      'B': { categoryCode: 'SEM', code: 2 },
      'C': { categoryCode: 'SEM', code: 3 },
    };
    
    const mapping = teamMapping[selectedTeam];
    if (!mapping) {
      setLiveUpcoming([]);
      setLiveResults([]);
      return;
    }

    const fetchMatches = async () => {
      setIsLoadingMatches(true);
      setLiveUpcoming([]);
      setLiveResults([]);
      try {
        const equipesData = await getEquipes(OISEMONT_CL_NO);
        const equipes = Array.isArray(equipesData) ? equipesData : equipesData?.equipes || [];
        const champParams = getTeamChampionship(equipes, mapping.categoryCode, mapping.code);
        
        if (!champParams) return;
        
        const [upcoming, results] = await Promise.all([
          getTousMatchsAvenir(champParams.cpNo, champParams.phase, champParams.poule),
          getTousResultats(champParams.cpNo, champParams.phase, champParams.poule),
        ]);
        if (cancelled) return;
        setLiveUpcoming(upcoming);
        setLiveResults(results);
      } catch (err) {
        if (!cancelled) console.error('Error fetching live matches:', err);
      } finally {
        if (!cancelled) setIsLoadingMatches(false);
      }
    };
    
    fetchMatches();
    return () => { cancelled = true; };
  }, [selectedTeam]);

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
    const teams = importedTeams.length > 0 ? importedTeams : [];
    if (teams.length < 2) { toast.warning('Importez une compétition FFF avec au moins 2 équipes'); return; }
    if (teamHasChampionship(champTeam)) { toast.error(`L'équipe ${champTeam} a déjà un championnat`); return; }
    
    const fffUrl = selectedCompetition 
      ? encodeFFFApiRef(selectedCompetition.cpNo, selectedCompetition.phase, selectedCompetition.poule)
      : undefined;

    onAddChampionship({ 
      name: champName, season: champSeason, teams, 
      fffUrl, 
      matches: importedMatches.length > 0 ? importedMatches : undefined, 
      standings: importedStandings.length > 0 ? importedStandings : undefined, 
      teamLogos: Object.keys(importedLogos).length > 0 ? importedLogos : undefined, 
      team: champTeam 
    });
    resetForm();
  };

  const resetForm = () => {
    setChampName(''); setImportedMatches([]); setImportedStandings([]); setImportedLogos({}); 
    setImportedTeams([]); setChampTeam('A'); setSelectedCompetition(null); setShowAddChamp(false);
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

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ─── Header ─── */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-accent to-primary p-5 sm:p-6 text-primary-foreground"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.4),transparent_60%)]" />
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-foreground/5 rounded-full blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary-foreground/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-primary-foreground/10">
              <Trophy size={22} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Championnats</h2>
              <p className="text-xs sm:text-sm text-primary-foreground/70 mt-0.5">Saison 2025-2026 • Équipe {selectedTeam}</p>
            </div>
          </div>
          {canManage() && !teamHasChampionship(selectedTeam) && (
            <motion.button 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              onClick={() => { setChampTeam(selectedTeam); setShowAddChamp(true); }} 
              className="flex items-center gap-1.5 bg-primary-foreground/20 backdrop-blur-sm text-primary-foreground px-4 py-2.5 rounded-xl font-semibold hover:bg-primary-foreground/30 transition-all text-xs sm:text-sm border border-primary-foreground/10"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Nouveau</span>
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ─── Team selector pills ─── */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.08 }}
        className="flex items-center gap-2 p-1.5 bg-secondary/60 backdrop-blur-sm rounded-2xl border border-border/50"
      >
        {TEAM_OPTIONS.map(team => (
          <motion.button
            key={team}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedTeam(team)}
            className={`relative flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              selectedTeam === team
                ? 'text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {selectedTeam === team && (
              <motion.div
                layoutId="team-pill"
                className="absolute inset-0 bg-accent rounded-xl shadow-lg shadow-accent/25"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">Équipe {team}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* ─── Live classement ─── */}
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
          {isLoadingLive && <Loader2 size={16} className="text-accent animate-spin" />}
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
            <motion.div key="table" variants={stagger} initial="hidden" animate="show" className="divide-y divide-border/30">
              {liveClassement.map((s, i) => {
                const isOisemont = s.clNo === OISEMONT_CL_NO;
                const logo = liveLogos[s.team?.toUpperCase()] || null;
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                
                return (
                  <motion.div
                    key={`${s.team}-${i}`}
                    variants={fadeUp}
                    className={`flex items-center gap-3 px-4 py-3 transition-all ${
                      isOisemont 
                        ? 'bg-accent/8 border-l-[3px] border-l-accent' 
                        : 'hover:bg-secondary/40'
                    }`}
                  >
                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                      i === 0 ? 'bg-yellow-500/15 text-yellow-600' :
                      i === 1 ? 'bg-slate-400/15 text-slate-500' :
                      i === 2 ? 'bg-amber-600/15 text-amber-700' :
                      'bg-secondary text-muted-foreground'
                    }`}>
                      {medal || s.rank}
                    </div>

                    {/* Logo + Name */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {logo ? (
                        <img src={logo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-border/50" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 text-[10px] font-bold text-muted-foreground">{s.team?.charAt(0)}</div>
                      )}
                      <span className={`text-sm truncate ${isOisemont ? 'font-extrabold text-accent' : 'font-medium text-foreground'}`}>{s.team}</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2 text-[11px] shrink-0">
                      <div className="flex items-center gap-0.5">
                        <span className="text-muted-foreground">{s.played}J</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="text-emerald-600 font-semibold">{s.won}V</span>
                        <span>{s.drawn}N</span>
                        <span className="text-red-500">{s.lost}D</span>
                      </div>
                      <div className={`font-semibold text-[11px] ${s.goalDiff > 0 ? 'text-emerald-600' : s.goalDiff < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {s.goalDiff > 0 ? '+' : ''}{s.goalDiff}
                      </div>
                    </div>

                    {/* Points */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      isOisemont
                        ? 'bg-accent text-accent-foreground shadow-md shadow-accent/20'
                        : i < 3 ? 'bg-primary/10 text-primary' : 'bg-secondary text-foreground'
                    }`}>
                      {s.points}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-14">Sélectionnez une équipe pour voir le classement</p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Bilan rapide ─── */}
      {(bilan.v + bilan.n + bilan.d) > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp size={14} className="text-emerald-600" />
              <span className="text-2xl font-black text-emerald-600">{bilan.v}</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70">Victoires</span>
          </div>
          <div className="bg-secondary border border-border/50 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Minus size={14} className="text-muted-foreground" />
              <span className="text-2xl font-black text-foreground">{bilan.n}</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nuls</span>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingDown size={14} className="text-red-500" />
              <span className="text-2xl font-black text-red-500">{bilan.d}</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500/70">Défaites</span>
          </div>
        </motion.div>
      )}

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
                    const matchDate = match.date ? new Date(match.date) : null;
                    const now = new Date();
                    const diffDays = matchDate ? Math.ceil((matchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 999;
                    const isImminent = diffDays <= 3 && diffDays >= 0;
                    const ville = match.terrain?.city || '';
                    
                    return (
                      <motion.div 
                        key={`${match.date}-${idx}`} 
                        variants={fadeUp}
                        className={`px-5 py-4 transition-all ${isImminent ? 'bg-accent/5' : 'hover:bg-secondary/30'}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {matchDate?.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {match.time ? ` • ${match.time}` : ''}
                          </span>
                          {isImminent && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full animate-pulse">
                              {diffDays <= 0 ? "Auj." : diffDays === 1 ? 'Demain' : `J-${diffDays}`}
                            </span>
                          )}
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
                        {ville && (
                          <p className="text-[10px] text-muted-foreground mt-2 text-center flex items-center justify-center gap-1">
                            <MapPin size={10} /> {ville}
                          </p>
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
                    const isDraw = homeScore !== null && awayScore !== null && homeScore === awayScore;
                    const matchDateObj = match.date ? new Date(match.date) : null;
                    
                    // Determine result color for Oisemont
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

      {/* ─── Admin bar ─── */}
      {canManage() && filteredChampionships.map(champ => (
        <motion.div 
          key={champ.id} 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                <Trophy size={16} className="text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">{champ.name}</h3>
                <p className="text-[11px] text-muted-foreground">{champ.season} • Éq. {champ.team || 'A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canUpdateChampionnat() && champ.fffUrl && onRefreshFromFFF && (
                <span
                  onClick={async () => {
                    setRefreshingChamp(champ.id);
                    try {
                      const result = await onRefreshFromFFF(champ.id, champ.fffUrl!);
                      setRefreshResult({ ...result, champName: champ.name });
                    } finally {
                      setRefreshingChamp(null);
                    }
                  }}
                  className="p-2 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-accent transition-all cursor-pointer"
                  title="Mettre à jour depuis la FFF"
                >
                  <RefreshCw size={16} className={refreshingChamp === champ.id ? 'animate-spin' : ''} />
                </span>
              )}
              <span onClick={() => onDeleteChampionship(champ.id)} className="p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all cursor-pointer">
                <Trash2 size={16} />
              </span>
            </div>
          </div>
        </motion.div>
      ))}

      {filteredChampionships.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 bg-card rounded-2xl border border-border/60"
        >
          <Trophy size={48} className="mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Aucun championnat pour l'équipe {selectedTeam}</p>
          {canManage() && !teamHasChampionship(selectedTeam) && <p className="text-sm text-muted-foreground mt-1">Créez le championnat de l'équipe {selectedTeam}</p>}
        </motion.div>
      )}

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
              {/* Team selector */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Équipe</label>
                <div className="flex gap-2">
                  {TEAM_OPTIONS.map(team => (
                    <button
                      key={team}
                      type="button"
                      onClick={() => setChampTeam(team)}
                      disabled={teamHasChampionship(team)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                        champTeam === team
                          ? 'bg-accent text-accent-foreground shadow-sm'
                          : teamHasChampionship(team)
                            ? 'bg-secondary/50 text-muted-foreground/40 cursor-not-allowed line-through'
                            : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                      }`}
                    >
                      Équipe {team}
                      {teamHasChampionship(team) && ' ✓'}
                    </button>
                  ))}
                </div>
              </div>

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
    </div>
  );
};

export default ChampionnatTab;
