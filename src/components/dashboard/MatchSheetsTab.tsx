import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Trophy, Calendar, Clock, MapPin, ChevronDown, ChevronUp, Users, Shield, Lock } from 'lucide-react';
import PitchView from './PitchView';
import { Separator } from '@/components/ui/separator';
import type { Convocation, Player } from '@/pages/Dashboard';

export interface MatchSheet {
  id: string;
  eventId?: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  team?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  convocations: Record<string, Convocation>;
  createdAt: string;
  createdBy?: string;
}

interface Props {
  matchSheets: MatchSheet[];
  players: Player[];
  isManager?: boolean;
}

const teamColors: Record<string, string> = {
  A: 'bg-primary/15 text-primary border-primary/30',
  B: 'bg-accent/15 text-accent border-accent/30',
  C: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
};

const MatchSheetsTab: React.FC<Props> = ({ matchSheets, players, isManager = false }) => {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const now = new Date();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const sorted = [...matchSheets].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (!q) return sorted;
    return sorted.filter(ms =>
      ms.title.toLowerCase().includes(q) ||
      ms.homeTeam?.toLowerCase().includes(q) ||
      ms.awayTeam?.toLowerCase().includes(q) ||
      ms.date.includes(q) ||
      ms.team?.toLowerCase().includes(q)
    );
  }, [matchSheets, search]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Feuilles de match</h2>
          <p className="text-xs text-muted-foreground">{matchSheets.length} feuille{matchSheets.length > 1 ? 's' : ''} archivée{matchSheets.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par adversaire, date..."
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Shield className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground font-medium">
            {search ? 'Aucun résultat' : 'Aucune feuille de match'}
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {search ? 'Essayez une autre recherche' : 'Les compositions seront archivées ici après publication'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(ms => {
            const isExpanded = expandedId === ms.id;
            const isPast = new Date(ms.date) < now;
            const isLocked = !isManager && !isPast;
            const hasVs = ms.homeTeam && ms.awayTeam;
            const hasScore = ms.homeScore != null && ms.awayScore != null;

            const convokedPlayers = Object.entries(ms.convocations)
              .filter(([, c]) => c.status === 'convoque')
              .map(([playerId, conv]) => {
                const player = players.find(p => p.id === playerId);
                return player ? { id: playerId, name: player.name, conv } : null;
              })
              .filter(Boolean) as { id: string; name: string; conv: Convocation }[];

            return (
              <div
                key={ms.id}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Card Header — VS style */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ms.id)}
                  className="w-full text-left"
                >
                  {/* Top meta bar */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <div className="flex items-center gap-2">
                      {ms.team && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${teamColors[ms.team] || 'bg-muted text-muted-foreground border-border'}`}>
                          {ms.team}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <Calendar size={10} /> {formatDate(ms.date)}
                      </span>
                      {ms.time && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                          <Clock size={10} /> {ms.time}
                        </span>
                      )}
                    </div>
                    {isLocked ? (
                      <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                        <Lock size={12} className="text-muted-foreground" />
                      </div>
                    ) : (
                      isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />
                    )}
                  </div>

                  {hasVs ? (
                    /* ── VS Layout with logos ── */
                    <div className="flex items-center justify-between px-4 py-3">
                      {/* Home */}
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-border/30 flex items-center justify-center overflow-hidden">
                          {ms.homeLogo ? (
                            <img src={ms.homeLogo} alt="" className="w-10 h-10 object-contain" />
                          ) : (
                            <Shield size={24} className="text-primary/40" />
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-foreground text-center leading-tight line-clamp-2 capitalize max-w-[100px]">
                          {ms.homeTeam?.toLowerCase()}
                        </span>
                      </div>

                      {/* Score or VS */}
                      <div className="shrink-0 mx-2 flex flex-col items-center gap-1">
                        {hasScore ? (
                          <div className="flex items-center gap-1.5 bg-secondary rounded-xl px-4 py-2">
                            <span className="text-xl font-black text-foreground">{ms.homeScore}</span>
                            <span className="text-sm text-muted-foreground font-bold">-</span>
                            <span className="text-xl font-black text-foreground">{ms.awayScore}</span>
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                            <span className="text-xs font-black text-primary tracking-tight">VS</span>
                          </div>
                        )}
                      </div>

                      {/* Away */}
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-border/30 flex items-center justify-center overflow-hidden">
                          {ms.awayLogo ? (
                            <img src={ms.awayLogo} alt="" className="w-10 h-10 object-contain" />
                          ) : (
                            <Shield size={24} className="text-muted-foreground/40" />
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-foreground text-center leading-tight line-clamp-2 capitalize max-w-[100px]">
                          {ms.awayTeam?.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* ── Simple title layout ── */
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Trophy size={18} className="text-primary" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground truncate flex-1">{ms.title}</h3>
                    </div>
                  )}

                  {/* Location in header */}
                  {ms.location && (
                    <div className="px-4 pb-2.5 -mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin size={9} /> <span className="truncate capitalize">{ms.location.toLowerCase()}</span>
                      </span>
                    </div>
                  )}
                </button>

                {/* Expanded: pitch + info — no layout animation to prevent stretching */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.3 }, opacity: { duration: 0.25, delay: 0.05 } } }}
                      exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.25 }, opacity: { duration: 0.15 } } }}
                      className="border-t border-border overflow-hidden"
                    >
                      <div className={`p-4 relative ${isLocked ? 'select-none' : ''}`}>
                        {/* Lock overlay */}
                        {isLocked && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/60 backdrop-blur-sm rounded-b-2xl">
                            <Lock size={28} className="text-muted-foreground mb-2" />
                            <p className="text-sm font-semibold text-muted-foreground">Composition verrouillée</p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">Disponible après le match</p>
                          </div>
                        )}

                        <div className={isLocked ? 'filter blur-md' : ''}>
                          {convokedPlayers.length > 0 ? (
                            <PitchView convocations={ms.convocations} players={players} />
                          ) : (
                            <div className="text-center py-8">
                              <Users size={32} className="mx-auto text-muted-foreground/50 mb-2" />
                              <p className="text-sm text-muted-foreground">Aucun joueur convoqué</p>
                            </div>
                          )}

                          <div className="my-4 flex items-center gap-3">
                            <Separator className="flex-1" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Infos match</span>
                            <Separator className="flex-1" />
                          </div>

                          <div className="space-y-2">
                            {hasScore && hasVs && (
                              <div className="flex items-center justify-center gap-3 py-2">
                                <div className="flex items-center gap-2">
                                  {ms.homeLogo && <img src={ms.homeLogo} alt="" className="w-5 h-5 object-contain" />}
                                  <span className="text-xs font-semibold text-foreground truncate max-w-[80px]">{ms.homeTeam}</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-secondary rounded-lg px-3 py-1.5">
                                  <span className="text-lg font-black text-foreground">{ms.homeScore}</span>
                                  <span className="text-xs text-muted-foreground">-</span>
                                  <span className="text-lg font-black text-foreground">{ms.awayScore}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-foreground truncate max-w-[80px]">{ms.awayTeam}</span>
                                  {ms.awayLogo && <img src={ms.awayLogo} alt="" className="w-5 h-5 object-contain" />}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 gap-1.5">
                              {ms.location && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                                  <MapPin size={12} className="shrink-0" />
                                  <span className="truncate">{ms.location}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                                <span className="inline-flex items-center gap-1.5">
                                  <Calendar size={12} /> {formatDate(ms.date)}
                                </span>
                                {ms.time && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Clock size={12} /> {ms.time}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                                <Users size={12} className="shrink-0" />
                                <span>{convokedPlayers.length} joueur{convokedPlayers.length > 1 ? 's' : ''} convoqué{convokedPlayers.length > 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(MatchSheetsTab);
