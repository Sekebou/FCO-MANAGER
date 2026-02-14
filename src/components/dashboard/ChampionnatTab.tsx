import React, { useState } from 'react';
import { Trophy, Plus, Trash2, Calendar, Award, ChevronDown, ChevronUp, X, Hash, CalendarDays, Home, Plane, Link, Loader2, RefreshCw } from 'lucide-react';
import { scrapeFFFTeams, type ScrapedMatch } from '@/lib/api/scrape-fff';

export interface Championship {
  id: string;
  name: string;
  season: string;
  teams: string[];
  fffUrl?: string;
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
  canManage: () => boolean | undefined;
  onAddChampionship: (data: { name: string; season: string; teams: string[]; fffUrl?: string; matches?: ScrapedMatch[] }) => void;
  onDeleteChampionship: (id: string) => void;
  onAddMatch: (data: Omit<Match, 'id'>) => void;
  onUpdateMatchScore: (matchId: string, homeScore: number, awayScore: number) => void;
  onDeleteMatch: (id: string) => void;
  onRefreshFromFFF?: (championshipId: string, fffUrl: string) => Promise<void>;
}

const ChampionnatTab: React.FC<Props> = ({
  championships,
  matches,
  canManage,
  onAddChampionship,
  onDeleteChampionship,
  onAddMatch,
  onUpdateMatchScore,
  onDeleteMatch,
  onRefreshFromFFF,
}) => {
  const [showAddChamp, setShowAddChamp] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState<string | null>(null);
  const [expandedChamp, setExpandedChamp] = useState<string | null>(championships[0]?.id || null);

  // Add championship form state
  const [champName, setChampName] = useState('');
  const [champSeason, setChampSeason] = useState('2024-2025');
  const [teamsInput, setTeamsInput] = useState('');
  const [fffUrl, setFffUrl] = useState('');
  const [isScrapingFFF, setIsScrapingFFF] = useState(false);
  const [importedMatches, setImportedMatches] = useState<ScrapedMatch[]>([]);
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

  const getChampMatches = (champId: string) => matches.filter(m => m.championshipId === champId);

  const getStandings = (champId: string) => {
    const champ = championships.find(c => c.id === champId);
    if (!champ) return [];
    const champMatches = getChampMatches(champId).filter(m => m.played);

    const stats: Record<string, { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number }> = {};

    champ.teams.forEach(team => {
      stats[team] = { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
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
    if (teams.length < 2) { alert('Ajoutez au moins 2 équipes'); return; }
    onAddChampionship({ name: champName, season: champSeason, teams, fffUrl: fffUrl.trim() || undefined, matches: importedMatches.length > 0 ? importedMatches : undefined });
    setChampName(''); setTeamsInput(''); setFffUrl(''); setImportedMatches([]); setShowAddChamp(false);
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
      } else {
        alert(result.error || 'Aucune équipe trouvée sur cette page');
      }
    } catch {
      alert('Erreur lors de la récupération des équipes');
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

  const upcomingMatches = matches
    .filter(m => !m.played)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  const recentResults = matches
    .filter(m => m.played)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
            <Trophy className="text-accent" size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Championnats</h2>
            <p className="text-sm text-muted-foreground">{championships.length} championnat(s)</p>
          </div>
        </div>
        {canManage() && (
          <button onClick={() => setShowAddChamp(true)} className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2.5 rounded-xl font-medium hover:bg-accent/90 transition-all shadow-sm">
            <Plus size={18} /> Nouveau
          </button>
        )}
      </div>

      {/* Quick overview: upcoming + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Prochains matchs */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-accent" />
            <h3 className="font-semibold text-foreground">Prochains matchs</h3>
          </div>
          {upcomingMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun match à venir</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingMatches.map(m => {
                const champ = championships.find(c => c.id === m.championshipId);
                return (
                  <div key={m.id} className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span>{m.homeTeam}</span>
                        <span className="text-muted-foreground font-normal">vs</span>
                        <span>{m.awayTeam}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        J{m.journee} • {champ?.name}
                      </div>
                    </div>
                    <div className="text-xs font-medium text-accent bg-accent/10 px-2.5 py-1 rounded-lg">
                      {new Date(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Derniers résultats */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} className="text-accent" />
            <h3 className="font-semibold text-foreground">Derniers résultats</h3>
          </div>
          {recentResults.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun résultat</p>
          ) : (
            <div className="space-y-2.5">
              {recentResults.map(m => (
                <div key={m.id} className="flex items-center bg-secondary/50 rounded-xl px-4 py-3.5">
                  <span className={`text-sm font-bold flex-1 text-right ${m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore ? 'text-accent' : 'text-foreground'}`}>
                    {m.homeTeam}
                  </span>
                  <div className="mx-4 bg-primary text-primary-foreground px-5 py-1.5 rounded-xl text-base font-black min-w-[80px] text-center tracking-wider shadow-md">
                    {m.homeScore} - {m.awayScore}
                  </div>
                  <span className={`text-sm font-bold flex-1 ${m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore ? 'text-accent' : 'text-foreground'}`}>
                    {m.awayTeam}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Championships list */}
      {championships.map(champ => {
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
                  <p className="text-xs text-muted-foreground">{champ.season} • {champ.teams.length} équipes • {champMatches.length} matchs</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage() && champ.fffUrl && onRefreshFromFFF && (
                  <span
                    onClick={async (e) => {
                      e.stopPropagation();
                      setRefreshingChamp(champ.id);
                      try {
                        await onRefreshFromFFF(champ.id, champ.fffUrl!);
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
                            <td className="py-2.5 px-2 font-semibold text-foreground">{s.team}</td>
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
                    <div key={j} className="mb-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Journée {j}</div>
                      <div className="space-y-2">
                        {champMatches.filter(m => m.journee === j).map(m => (
                          <div key={m.id} className="flex items-center bg-secondary/50 rounded-xl px-4 py-3.5 gap-3">
                            <div className="flex-1 text-right">
                              <span className={`text-sm font-bold ${m.played && m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore ? 'text-accent' : 'text-foreground'}`}>
                                {m.homeTeam}
                              </span>
                            </div>

                            {m.played ? (
                              <div className="bg-primary text-primary-foreground px-5 py-1.5 rounded-xl text-base font-black min-w-[80px] text-center tracking-wider shadow-md">
                                {m.homeScore} - {m.awayScore}
                              </div>
                            ) : editingMatch === m.id ? (
                              <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-1.5 shadow-sm">
                                <input type="number" min="0" value={editHome} onChange={e => setEditHome(Number(e.target.value))} className="w-12 text-center rounded-lg border border-border bg-secondary text-base font-bold py-1.5 focus:ring-2 focus:ring-accent/50 outline-none" />
                                <span className="text-muted-foreground font-bold text-lg">-</span>
                                <input type="number" min="0" value={editAway} onChange={e => setEditAway(Number(e.target.value))} className="w-12 text-center rounded-lg border border-border bg-secondary text-base font-bold py-1.5 focus:ring-2 focus:ring-accent/50 outline-none" />
                                <button onClick={() => handleSaveScore(m.id)} className="text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-lg font-semibold hover:brightness-110 transition-all shadow-sm">OK</button>
                                <button onClick={() => setEditingMatch(null)} className="text-xs text-muted-foreground hover:text-foreground px-1.5 transition-colors">✕</button>
                              </div>
                            ) : (
                              <div className="min-w-[60px] text-center">
                                {canManage() ? (
                                  <button onClick={() => { setEditingMatch(m.id); setEditHome(0); setEditAway(0); }} className="text-xs bg-accent/10 text-accent px-3 py-1 rounded-lg font-medium hover:bg-accent/20 transition-all">
                                    Score
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex-1">
                              <span className={`text-sm font-bold ${m.played && m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore ? 'text-accent' : 'text-foreground'}`}>
                                {m.awayTeam}
                              </span>
                            </div>

                            <div className="text-xs text-muted-foreground hidden sm:block">
                              {new Date(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </div>

                            {canManage() && (
                              <button onClick={() => onDeleteMatch(m.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
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

      {championships.length === 0 && (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Trophy size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Aucun championnat</p>
          {canManage() && <p className="text-sm text-muted-foreground mt-1">Créez votre premier championnat</p>}
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
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nom</label>
                <input value={champName} onChange={e => setChampName(e.target.value)} placeholder="Ex: Championnat District U15" className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" />
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
                <p className="text-xs text-muted-foreground mt-1.5">Collez l'URL d'une page équipe/classement FFF pour importer les clubs et matchs</p>
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
    </div>
  );
};

export default ChampionnatTab;
