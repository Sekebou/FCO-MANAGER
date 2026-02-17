import React, { useState } from 'react';
import { Trophy, Plus, Trash2, Calendar, Award, ChevronDown, ChevronUp, X, Hash, CalendarDays, Home, Plane, Link, Loader2, RefreshCw, Clock, CheckCircle2, AlertCircle, ArrowUpCircle, PlusCircle, BarChart3, Users } from 'lucide-react';
import { scrapeFFFTeams, type ScrapedMatch, type ScrapedStanding } from '@/lib/api/scrape-fff';
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
  const [teamsInput, setTeamsInput] = useState('');
  const [fffUrl, setFffUrl] = useState('');
  const [isScrapingFFF, setIsScrapingFFF] = useState(false);
  const [importedMatches, setImportedMatches] = useState<ScrapedMatch[]>([]);
  const [importedStandings, setImportedStandings] = useState<ScrapedStanding[]>([]);
  const [importedLogos, setImportedLogos] = useState<Record<string, string>>({});
  const [refreshingChamp, setRefreshingChamp] = useState<string | null>(null);

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
    // Search across all championships for the team logo
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

  const getStandings = (champId: string) => {
    const champ = championships.find(c => c.id === champId);
    if (!champ) return [];

    // Use FFF standings if available
    if (champ.fffStandings && champ.fffStandings.length > 0) {
      return champ.fffStandings.map(s => ({
        team: s.team,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        gf: s.goalsFor,
        ga: s.goalsAgainst,
        points: s.points,
        forfeits: s.forfeits,
        penalties: s.penalties,
      }));
    }

    // Fallback: calculate from local matches
    const champMatches = getChampMatches(champId).filter(m => m.played);
    const stats: Record<string, { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number; forfeits: number; penalties: number }> = {};

    champ.teams.forEach(team => {
      stats[team] = { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, forfeits: 0, penalties: 0 };
    });

    champMatches.forEach(m => {
      if (m.homeScore === null || m.awayScore === null) return;
      const home = stats[m.homeTeam];
      const away = stats[m.awayTeam];
      if (!home || !away) return;

      home.played++; away.played++;
      home.gf += m.homeScore; home.ga += m.awayScore;
      away.gf += m.awayScore; away.ga += m.homeScore;

      if (m.homeScore > m.awayScore) {
        home.won++; away.lost++; home.points += 3;
      } else if (m.homeScore < m.awayScore) {
        away.won++; home.lost++; away.points += 3;
      } else {
        home.drawn++; away.drawn++; home.points++; away.points++;
      }
    });

    return Object.values(stats).sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  };

  const handleAddChamp = () => {
    if (!champName.trim()) return;
    const teams = teamsInput.split('\n').map(t => t.trim()).filter(Boolean);
    if (teams.length < 2) { toast.warning('Ajoutez au moins 2 équipes'); return; }
    if (teamHasChampionship(champTeam)) { toast.error(`L'équipe ${champTeam} a déjà un championnat`); return; }
    onAddChampionship({ name: champName, season: champSeason, teams, fffUrl: fffUrl.trim() || undefined, matches: importedMatches.length > 0 ? importedMatches : undefined, standings: importedStandings.length > 0 ? importedStandings : undefined, teamLogos: Object.keys(importedLogos).length > 0 ? importedLogos : undefined, team: champTeam });
    setChampName(''); setTeamsInput(''); setFffUrl(''); setImportedMatches([]); setImportedStandings([]); setImportedLogos({}); setChampTeam('A'); setShowAddChamp(false);
  };

  const handleImportFFF = async () => {
    if (!fffUrl.trim()) return;
    setIsScrapingFFF(true);
    try {
      const result = await scrapeFFFTeams(fffUrl);
      if (result.success && result.teams && result.teams.length > 0) {
        setTeamsInput(result.teams.join('\n'));
        if (result.matches && result.matches.length > 0) {
          setImportedMatches(result.matches);
        }
        if (result.standings && result.standings.length > 0) {
          setImportedStandings(result.standings);
        }
        if (result.teamLogos && Object.keys(result.teamLogos).length > 0) {
          setImportedLogos(result.teamLogos);
        }
      } else {
        toast.error(result.error || 'Aucune équipe trouvée sur cette page');
      }
    } catch {
      toast.error('Erreur lors de la récupération des équipes');
    } finally {
      setIsScrapingFFF(false);
    }
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

  // Use local date to avoid timezone issues with YYYY-MM-DD strings
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const filteredChampIds = new Set(filteredChampionships.map(c => c.id));

  const upcomingMatches = matches
    .filter(m => !m.played && m.date >= todayStr && filteredChampIds.has(m.championshipId))
    .sort((a, b) => a.date.localeCompare(b.date));

  const recentResults = matches
    .filter(m => m.played && filteredChampIds.has(m.championshipId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-xl flex items-center justify-center">
            <Trophy className="text-accent" size={18} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Championnats</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">{filteredChampionships.length} champ. — Éq. {selectedTeam}</p>
          </div>
        </div>
        {canManage() && !teamHasChampionship(selectedTeam) && (
          <button onClick={() => { setChampTeam(selectedTeam); setShowAddChamp(true); }} className="flex items-center gap-1.5 sm:gap-2 bg-accent text-accent-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-medium hover:bg-accent/90 transition-all shadow-sm text-xs sm:text-sm">
            <Plus size={16} /> <span className="hidden sm:inline">Nouveau</span>
          </button>
        )}
      </div>

      {/* Team selector */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {TEAM_OPTIONS.map(team => (
          <button
            key={team}
            onClick={() => setSelectedTeam(team)}
            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              selectedTeam === team
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            Éq. {team}
          </button>
        ))}
      </div>

      {/* Quick overview: upcoming + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Prochains matchs */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-secondary/30">
            <div className="w-8 h-8 bg-accent/15 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-accent" />
            </div>
            <h3 className="font-semibold text-foreground">Prochains matchs</h3>
            <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium">{upcomingMatches.length}</span>
          </div>
          {upcomingMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Aucun match à venir</p>
          ) : (
            <div className="divide-y divide-border/50">
              {upcomingMatches.map((m, idx) => {
                const champ = championships.find(c => c.id === m.championshipId);
                const matchDate = new Date(m.date);
                const now = new Date();
                const diffDays = Math.ceil((matchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isImminent = diffDays <= 3;
                return (
                  <div key={m.id} className={`px-5 py-4 transition-all ${isImminent ? 'bg-accent/5' : ''} ${idx === 0 ? 'border-l-4 border-l-accent' : ''}`}>
                    {/* Date + badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {matchDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      {isImminent && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2.5 py-1 rounded-full animate-pulse">
                          {diffDays <= 0 ? "Aujourd'hui" : diffDays === 1 ? 'Demain' : `J-${diffDays}`}
                        </span>
                      )}
                    </div>
                    {/* Teams */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                        <span className="text-sm font-bold text-foreground truncate text-right">{m.homeTeam}</span>
                        <TeamLogo team={m.homeTeam} champId={m.championshipId} size={32} />
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-secondary border border-border text-xs font-black text-muted-foreground tracking-widest shrink-0 min-w-[56px] text-center">
                        VS
                      </div>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <TeamLogo team={m.awayTeam} champId={m.championshipId} size={32} />
                        <span className="text-sm font-bold text-foreground truncate">{m.awayTeam}</span>
                      </div>
                    </div>
                    {/* Champ info */}
                    <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-muted-foreground">
                      <Trophy size={10} />
                      <span>Journée {m.journee} • {champ?.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Derniers résultats */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-secondary/30">
            <div className="w-8 h-8 bg-accent/15 rounded-lg flex items-center justify-center">
              <Award size={16} className="text-accent" />
            </div>
            <h3 className="font-semibold text-foreground">Derniers résultats</h3>
            <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium">{recentResults.length}</span>
          </div>
          {recentResults.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Aucun résultat</p>
          ) : (
            <div className="divide-y divide-border/50">
              {recentResults.map(m => {
                const isHomeWin = m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore;
                const isAwayWin = m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore;
                const isDraw = m.homeScore !== null && m.awayScore !== null && m.homeScore === m.awayScore;
                return (
                  <div key={m.id} className="px-5 py-4">
                    {/* Date */}
                    <div className="text-center mb-3">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        <span className="mx-1.5">•</span>
                        Journée {m.journee}
                      </span>
                    </div>
                    {/* Teams + Score */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                        <span className={`text-sm font-bold truncate text-right ${isHomeWin ? 'text-accent' : 'text-foreground'}`}>
                          {m.homeTeam}
                        </span>
                        <TeamLogo team={m.homeTeam} champId={m.championshipId} size={32} />
                      </div>
                      <div className={`px-5 py-2 rounded-xl text-base font-black min-w-[72px] text-center tracking-widest shadow-sm ${
                        isDraw ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
                      }`}>
                        {m.homeScore} - {m.awayScore}
                      </div>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <TeamLogo team={m.awayTeam} champId={m.championshipId} size={32} />
                        <span className={`text-sm font-bold truncate ${isAwayWin ? 'text-accent' : 'text-foreground'}`}>
                          {m.awayTeam}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Championships list */}
      {filteredChampionships.map(champ => {
        const standings = getStandings(champ.id);
        const champMatches = getChampMatches(champ.id).sort((a, b) => a.journee - b.journee || new Date(a.date).getTime() - new Date(b.date).getTime());
        const isExpanded = expandedChamp === champ.id;
        const journees = [...new Set(champMatches.map(m => m.journee))].sort((a, b) => a - b);

        return (
          <div key={champ.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* Champ header */}
            <button
              onClick={() => setExpandedChamp(isExpanded ? null : champ.id)}
              className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent/60 rounded-xl flex items-center justify-center">
                  <Trophy size={20} className="text-accent-foreground" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-foreground">{champ.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {champ.season} • {champ.teams.length} équipes • {champMatches.length} matchs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canUpdateChampionnat() && champ.fffUrl && onRefreshFromFFF && (
                  <span
                    onClick={async (e) => {
                      e.stopPropagation();
                      setRefreshingChamp(champ.id);
                      try {
                        const result = await onRefreshFromFFF(champ.id, champ.fffUrl!);
                        setRefreshResult({ ...result, champName: champ.name });
                      } finally {
                        setRefreshingChamp(null);
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-accent transition-all cursor-pointer"
                    title="Mettre à jour les scores depuis la FFF"
                  >
                    <RefreshCw size={16} className={refreshingChamp === champ.id ? 'animate-spin' : ''} />
                  </span>
                )}
                {canManage() && (
                  <span onClick={(e) => { e.stopPropagation(); onDeleteChampionship(champ.id); }} className="p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all cursor-pointer">
                    <Trash2 size={16} />
                  </span>
                )}
                {isExpanded ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border p-5 space-y-6">
                {/* Classement */}
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Award size={16} className="text-accent" /> Classement
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                          <th className="text-left py-2.5 px-2">#</th>
                          <th className="text-left py-2.5 px-2">Équipe</th>
                          <th className="text-center py-2.5 px-2">MJ</th>
                          <th className="text-center py-2.5 px-2">V</th>
                          <th className="text-center py-2.5 px-2">N</th>
                          <th className="text-center py-2.5 px-2">D</th>
                          <th className="text-center py-2.5 px-2">BP</th>
                          <th className="text-center py-2.5 px-2">BC</th>
                          <th className="text-center py-2.5 px-2">Diff</th>
                          <th className="text-center py-2.5 px-2 font-bold">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((s, i) => (
                          <tr key={s.team} className={`border-b border-border/50 ${i < 3 ? 'bg-accent/5' : ''} hover:bg-secondary/30 transition-colors`}>
                            <td className="py-2.5 px-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                i === 0 ? 'bg-yellow-400/20 text-yellow-600' : i === 1 ? 'bg-gray-300/20 text-gray-500' : i === 2 ? 'bg-amber-600/20 text-amber-700' : 'text-muted-foreground'
                              }`}>{i + 1}</span>
                            </td>
                            <td className="py-2.5 px-2 font-semibold text-foreground">
                              <div className="flex items-center gap-2">
                                <TeamLogo team={s.team} champId={champ.id} size={20} />
                                <span>{s.team}</span>
                              </div>
                            </td>
                            <td className="text-center py-2.5 px-2 text-muted-foreground">{s.played}</td>
                            <td className="text-center py-2.5 px-2 text-emerald-500 font-medium">{s.won}</td>
                            <td className="text-center py-2.5 px-2 text-muted-foreground">{s.drawn}</td>
                            <td className="text-center py-2.5 px-2 text-red-400 font-medium">{s.lost}</td>
                            <td className="text-center py-2.5 px-2 text-muted-foreground">{s.gf}</td>
                            <td className="text-center py-2.5 px-2 text-muted-foreground">{s.ga}</td>
                            <td className="text-center py-2.5 px-2 font-medium">
                              <span className={s.gf - s.ga > 0 ? 'text-emerald-500' : s.gf - s.ga < 0 ? 'text-red-400' : 'text-muted-foreground'}>
                                {s.gf - s.ga > 0 ? '+' : ''}{s.gf - s.ga}
                              </span>
                            </td>
                            <td className="text-center py-2.5 px-2 font-bold text-foreground text-base">{s.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Matchs par journée */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Calendar size={16} className="text-accent" /> Matchs
                    </h4>
                    {canManage() && (
                      <button onClick={() => setShowAddMatch(champ.id)} className="text-sm flex items-center gap-1.5 text-accent hover:text-accent/80 font-medium transition-all">
                        <Plus size={16} /> Ajouter un match
                      </button>
                    )}
                  </div>

                  {journees.map(j => (
                    <div key={j} className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 bg-accent/10 rounded-lg flex items-center justify-center">
                          <Hash size={13} className="text-accent" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Journée {j}</span>
                      </div>
                      <div className="bg-secondary/30 rounded-xl border border-border/50 overflow-hidden divide-y divide-border/40">
                        {champMatches.filter(m => m.journee === j).map(m => {
                          const isHomeWin = m.played && m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore;
                          const isAwayWin = m.played && m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore;
                          const isDraw = m.played && m.homeScore !== null && m.awayScore !== null && m.homeScore === m.awayScore;
                          return (
                            <div key={m.id} className="px-4 py-3.5 hover:bg-secondary/50 transition-colors">
                              {/* Date row */}
                              <div className="text-center mb-2">
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                  {new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              {/* Teams + Score */}
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2.5 flex-1 justify-end min-w-0">
                                  <span className={`text-sm font-bold truncate text-right ${isHomeWin ? 'text-accent' : 'text-foreground'}`}>
                                    {m.homeTeam}
                                  </span>
                                  <TeamLogo team={m.homeTeam} champId={champ.id} size={28} />
                                </div>

                                {m.played ? (
                                  <div className={`px-4 py-1.5 rounded-xl text-sm font-black min-w-[68px] text-center tracking-widest shadow-sm ${
                                    isDraw ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
                                  }`}>
                                    {m.homeScore} - {m.awayScore}
                                  </div>
                                ) : (
                                  <div className="min-w-[68px] text-center">
                                    {canManage() ? (
                                      <button onClick={() => { setEditingMatch(m.id); setEditHome(0); setEditAway(0); }} className="text-xs bg-accent/10 text-accent px-3.5 py-1.5 rounded-lg font-medium hover:bg-accent/20 transition-all">
                                        Score
                                      </button>
                                    ) : (
                                      <div className="px-4 py-1.5 rounded-xl bg-secondary border border-border text-xs font-semibold text-muted-foreground min-w-[68px] text-center">
                                        VS
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  <TeamLogo team={m.awayTeam} champId={champ.id} size={28} />
                                  <span className={`text-sm font-bold truncate ${isAwayWin ? 'text-accent' : 'text-foreground'}`}>
                                    {m.awayTeam}
                                  </span>
                                </div>

                                {canManage() && (
                                  <button onClick={() => onDeleteMatch(m.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all shrink-0">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {champMatches.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucun match programmé</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filteredChampionships.length === 0 && (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Trophy size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Aucun championnat pour l'équipe {selectedTeam}</p>
          {canManage() && !teamHasChampionship(selectedTeam) && <p className="text-sm text-muted-foreground mt-1">Créez le championnat de l'équipe {selectedTeam}</p>}
        </div>
      )}

      {/* Modal: Add Championship */}
      {showAddChamp && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setShowAddChamp(false)}>
          <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                  <Trophy size={20} className="text-accent" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Nouveau championnat</h3>
              </div>
              <button onClick={() => setShowAddChamp(false)} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
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
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nom</label>
                <input value={champName} onChange={e => setChampName(e.target.value)} placeholder="Ex: Championnat District D1" className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Saison</label>
                <input value={champSeason} onChange={e => setChampSeason(e.target.value)} placeholder="2024-2025" className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Importer depuis la FFF</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={fffUrl} onChange={e => setFffUrl(e.target.value)} placeholder="URL epreuves.fff.fr..." className="w-full pl-9 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" />
                  </div>
                  <button
                    type="button"
                    onClick={handleImportFFF}
                    disabled={!fffUrl.trim() || isScrapingFFF}
                    className="px-4 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center gap-2 whitespace-nowrap"
                  >
                    {isScrapingFFF ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                    {isScrapingFFF ? 'Import...' : 'Importer'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Collez l'URL d'une page équipe/classement FFF pour importer les clubs et matchs.{' '}
                  <a href="https://epreuves.fff.fr" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:brightness-110 transition-all">
                    Trouver mon championnat sur epreuves.fff.fr
                  </a>
                </p>
                {importedMatches.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 bg-accent/10 text-accent px-3 py-2 rounded-lg">
                    <Trophy size={14} />
                    <span className="text-xs font-medium">{importedMatches.length} match(s) trouvé(s) — seront importés automatiquement</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Équipes (une par ligne)</label>
                <textarea value={teamsInput} onChange={e => setTeamsInput(e.target.value)} rows={6} placeholder={"FCO\nAS Rivière\nFC Montagne\nUS Vallée"} className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all resize-none" />
                <p className="text-xs text-muted-foreground mt-1.5">{teamsInput.split('\n').filter(t => t.trim()).length} équipe(s) ajoutée(s)</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowAddChamp(false)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
                Annuler
              </button>
              <button onClick={handleAddChamp} disabled={!champName.trim() || teamsInput.split('\n').filter(t => t.trim()).length < 2} className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-accent/20">
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Match */}
      {showAddMatch && (() => {
        const champ = championships.find(c => c.id === showAddMatch);
        if (!champ) return null;
        return (
          <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setShowAddMatch(null)}>
            <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
              {/* Header */}
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

              {/* Body */}
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
                  <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" />
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-5 border-t border-border">
                <button onClick={() => setShowAddMatch(null)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
                  Annuler
                </button>
                <button onClick={() => handleAddMatch(showAddMatch)} disabled={!matchHome || !matchAway || !matchDate} className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-accent/20">
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Edit Score */}
      {editingMatch && (() => {
        const match = matches.find(m => m.id === editingMatch);
        if (!match) return null;
        const champ = championships.find(c => c.id === match.championshipId);
        return (
          <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setEditingMatch(null)}>
            <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
              {/* Header */}
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

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Date */}
                <div className="text-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {new Date(match.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>

                {/* Teams + Score inputs */}
                <div className="flex items-center gap-4">
                  {/* Home */}
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
                      type="number"
                      min="0"
                      value={editHome}
                      onChange={e => setEditHome(Number(e.target.value))}
                      className="w-20 mx-auto text-center rounded-xl border-2 border-border bg-secondary text-3xl font-black py-3 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                    />
                  </div>

                  {/* Separator */}
                  <div className="text-2xl font-black text-muted-foreground/50 pt-8">—</div>

                  {/* Away */}
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
                      type="number"
                      min="0"
                      value={editAway}
                      onChange={e => setEditAway(Number(e.target.value))}
                      className="w-20 mx-auto text-center rounded-xl border-2 border-border bg-secondary text-3xl font-black py-3 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-5 border-t border-border">
                <button onClick={() => setEditingMatch(null)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
                  Annuler
                </button>
                <button onClick={() => handleSaveScore(editingMatch)} className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20">
                  Valider le score
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Refresh Result */}
      {refreshResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setRefreshResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
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

            {/* Body */}
            <div className="p-5">
              {refreshResult.success ? (
                <div className="space-y-3">
                  {/* Stats cards */}
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

            {/* Footer */}
            <div className="p-5 border-t border-border">
              <button onClick={() => setRefreshResult(null)} className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChampionnatTab;
