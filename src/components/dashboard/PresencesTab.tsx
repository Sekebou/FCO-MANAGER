import React, { useState } from 'react';
import type { Event, Player, Member, Convocation } from '@/pages/Dashboard';
import { POSITIONS } from '@/pages/Dashboard';
import PitchView from './PitchView';
import { Calendar, Plus, Check, X, Trash2, Clock, Shield, Users, Send, ChevronDown, ChevronUp, UserCheck, UserX, Hash, Crosshair, Pencil, Repeat, CircleDot, Bell, ChevronRight } from 'lucide-react';
import RoleBadge from '@/components/ui/role-badge';

interface AppUser {
  uid: string;
  name: string;
  role: string;
  team?: string;
  playerId?: string;
  [key: string]: any;
}

interface Props {
  events: Event[];
  players: Player[];
  members: Member[];
  currentUser: AppUser | null;
  canManage: () => boolean | null;
  canCreateEvent: () => boolean | null;
  canManageOwnPresence: (playerId: string) => boolean | null;
  togglePresence: (eventId: string, playerId: string, status: string) => void;
  deleteEvent: (eventId: string) => void;
  canDeleteEvent: (event: Event) => boolean;
  onAddEvent: () => void;
  onUpdateConvocations: (eventId: string, convocations: Record<string, Convocation>) => void;
  onSendConvocationNotif?: (event: Event, convocations: Record<string, Convocation>) => void;
}

const CONVOCATION_STATUSES = [
  { value: 'convoque', label: 'Convoqué', shortLabel: 'Convoqué', activeClass: 'bg-accent text-accent-foreground ring-2 ring-accent/30 shadow-sm', dotClass: 'bg-accent', icon: UserCheck },
  { value: 'non_convoque', label: 'Non convoqué', shortLabel: 'Non convoqué', activeClass: 'bg-destructive text-destructive-foreground ring-2 ring-destructive/30 shadow-sm', dotClass: 'bg-destructive', icon: UserX },
] as const;

const MAX_VISIBLE_PLAYERS = 8;

const PresencesTab = ({ events, players, members, currentUser, canManage, canCreateEvent, canManageOwnPresence, togglePresence, deleteEvent, canDeleteEvent, onAddEvent, onUpdateConvocations, onSendConvocationNotif }: Props) => {
  const [convocationMode, setConvocationMode] = useState<string | null>(null);
  const [draftConvocations, setDraftConvocations] = useState<Record<string, Convocation>>({});
  const [expandedConvocations, setExpandedConvocations] = useState<Record<string, boolean>>({});
  const [expandedPlayers, setExpandedPlayers] = useState<Record<string, boolean>>({});

  // All events visible to everyone (no team filtering)
  const upcomingEvents = events
    .filter(e => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // All players participate in all events
  const getPlayersForEvent = (_event: Event) => {
    return players;
  };

  const startConvocationMode = (eventId: string, event: Event) => {
    setConvocationMode(eventId);
    const draft: Record<string, Convocation> = {};
    const eventPlayers = getPlayersForEvent(event);
    eventPlayers.forEach(p => {
      if (event.convocations?.[p.id]) {
        draft[p.id] = event.convocations[p.id];
      }
    });
    setDraftConvocations(draft);
  };

  const updateDraft = (playerId: string, updates: Partial<Convocation>) => {
    setDraftConvocations(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], ...updates } as Convocation,
    }));
  };

  const publishConvocations = (eventId: string) => {
    onUpdateConvocations(eventId, draftConvocations);
    setConvocationMode(null);
  };

  const toggleExpandPlayers = (eventId: string) => {
    setExpandedPlayers(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2 sm:gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Gestion des présences</h2>
        <div className="flex gap-2">
          {canCreateEvent() && (
            <button onClick={onAddEvent} className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl flex items-center gap-1.5 sm:gap-2 hover:bg-primary/90 transition-all text-xs sm:text-sm font-medium">
              <Plus size={16} /> Événement
            </button>
          )}
        </div>
      </div>

      {upcomingEvents.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Calendar className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground font-medium">Aucun événement à venir</p>
          {canManage() && <p className="text-sm text-muted-foreground/70 mt-2">Cliquez sur "+ Événement" pour en créer un</p>}
        </div>
      ) : (
        upcomingEvents.map(event => {
          const eventPlayers = getPlayersForEvent(event);
          const presences = event.presences || {};
          const presentCount = Object.values(presences).filter(p => p === 'present').length;
          const absentCount = Object.values(presences).filter(p => p === 'absent').length;
          const unknownCount = eventPlayers.length - presentCount - absentCount;
          const isConvocationMode = convocationMode === event.id;
          const isConvocationExpanded = expandedConvocations[event.id];
          const isPlayersExpanded = expandedPlayers[event.id];
          const visiblePlayers = isPlayersExpanded ? eventPlayers : eventPlayers.slice(0, MAX_VISIBLE_PLAYERS);
          const hasMorePlayers = eventPlayers.length > MAX_VISIBLE_PLAYERS;

          return (
            <div key={event.id} className="bg-card border border-border rounded-2xl p-3 sm:p-5 shadow-sm animate-fade-in">
              {/* Header: title + badges */}
              <div className="mb-3 sm:mb-4">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-semibold text-base sm:text-lg text-foreground truncate min-w-0 flex-1">{event.title}</h3>
                  <div className="flex gap-1 items-center shrink-0 flex-wrap justify-end">
                    {event.recurrence === 'recurring' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary inline-flex items-center gap-1">
                        <Repeat size={10} /> Récurrent
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground inline-flex items-center gap-1">
                        <CircleDot size={10} /> Ponctuel
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      event.type === 'match' ? 'bg-accent/10 text-accent' :
                      event.type === 'training' ? 'bg-purple-100 text-purple-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {event.type === 'match' ? 'Match' : event.type === 'training' ? 'Entraînement' : 'Autre'}
                    </span>
                    {canDeleteEvent(event) && (
                      <button onClick={() => deleteEvent(event.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded-lg transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {/* Date + creator on separate lines */}
                <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                  {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  {event.time && <span className="ml-1.5">• {event.time}</span>}
                </p>
                {event.location && (
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">📍 {event.location}</p>
                )}
                {event.createdByName && (
                  <p className="flex items-center gap-1.5 text-muted-foreground/60 text-[11px] mt-0.5">
                    par {event.createdByName}
                    {(() => {
                      const creator = members.find(m => m.id === event.createdBy);
                      return creator ? <RoleBadge role={creator.role} compact /> : null;
                    })()}
                  </p>
                )}
                {event.type === 'other' && event.reason && (
                  <p className="text-[11px] text-foreground/70 mt-1 bg-secondary inline-block px-2 py-0.5 rounded-full">{event.reason}</p>
                )}
                {/* Presence counters */}
                <div className="mt-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="flex items-center gap-1 bg-accent/10 text-accent px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap">
                      <Check size={11} className="shrink-0" /> {presentCount} Présent{presentCount > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1 bg-destructive/10 text-destructive px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap">
                      <X size={11} className="shrink-0" /> {absentCount} Absent{absentCount > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1 bg-warning/10 text-warning px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap">
                      <Clock size={11} className="shrink-0" /> {unknownCount} En attente
                    </span>
                  </div>
                </div>
              </div>

              {/* Presences list — max 8 visible, then "Voir plus" */}
              <div className="space-y-1.5">
                {eventPlayers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">Aucun joueur enregistré</p>
                ) : (
                  <>
                    {visiblePlayers.map(player => {
                      const status = presences[player.id];
                      return (
                        <div key={player.id} className="flex items-center justify-between p-2 sm:p-2.5 bg-secondary/40 rounded-xl gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {(() => {
                              const member = members.find(m => m.playerId === player.id);
                              const photoURL = member?.photoURL;
                              const initials = player.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                              if (photoURL) {
                                return <img src={photoURL} alt={player.name} className="w-7 h-7 rounded-full object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
                              }
                              return (
                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                  <span className="text-primary text-[10px] font-bold">{initials}</span>
                                </div>
                              );
                            })()}
                            <span className="font-medium text-xs sm:text-sm text-foreground truncate">{player.name}</span>
                          </div>
                          {canManageOwnPresence(player.id) ? (
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => togglePresence(event.id, player.id, 'present')}
                                className={`w-9 h-8 rounded-lg flex items-center justify-center text-[11px] font-semibold transition-all ${
                                  status === 'present'
                                    ? 'bg-accent text-accent-foreground shadow-sm'
                                    : 'bg-card border border-border hover:border-accent/50 text-muted-foreground'
                                }`}
                                title="Présent"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => togglePresence(event.id, player.id, 'absent')}
                                className={`w-9 h-8 rounded-lg flex items-center justify-center text-[11px] font-semibold transition-all ${
                                  status === 'absent'
                                    ? 'bg-destructive text-destructive-foreground shadow-sm'
                                    : 'bg-card border border-border hover:border-destructive/50 text-muted-foreground'
                                }`}
                                title="Absent"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className={`w-8 h-8 rounded-lg text-[11px] font-semibold flex items-center justify-center shrink-0 ${
                              status === 'present' ? 'bg-accent/10 text-accent' :
                              status === 'absent' ? 'bg-destructive/10 text-destructive' :
                              'bg-warning/10 text-warning'
                            }`}>
                              {status === 'present' ? <Check size={13} /> : status === 'absent' ? <X size={13} /> : <Clock size={13} />}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Voir plus / moins */}
                    {hasMorePlayers && (
                      <button
                        onClick={() => toggleExpandPlayers(event.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/60 rounded-xl transition-all mt-1"
                      >
                        {isPlayersExpanded ? (
                          <><ChevronUp size={14} /> Réduire</>
                        ) : (
                          <><ChevronDown size={14} /> Voir {eventPlayers.length - MAX_VISIBLE_PLAYERS} joueur{eventPlayers.length - MAX_VISIBLE_PLAYERS > 1 ? 's' : ''} de plus</>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Convocation section - only for match events */}
              {event.type === 'match' && (
                <div className="mt-4 pt-4 border-t border-border">
                  {/* Show published convocations */}
                  {event.convocationsPublished && event.convocations && !isConvocationMode && (
                    <div>
                      <button
                        onClick={() => setExpandedConvocations(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                        className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3 w-full"
                      >
                        <Shield size={16} className="text-accent" />
                        Convocations publiées
                        {isConvocationExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {isConvocationExpanded && (
                        <div className="space-y-1.5 animate-fade-in">
                          {Object.entries(event.convocations)
                          .sort((a, b) => {
                              const order = { convoque: 0, non_convoque: 1 };
                              return (order[a[1].status] ?? 1) - (order[b[1].status] ?? 1);
                            })
                            .map(([playerId, conv]) => {
                              const player = players.find(p => p.id === playerId);
                              if (!player) return null;
                              const statusInfo = CONVOCATION_STATUSES.find(s => s.value === conv.status);
                              const StatusIcon = statusInfo?.icon || UserX;
                              const isMatchPast = new Date(event.date) < new Date();
                              const canSeeDetails = isMatchPast || canManage();
                              return (
                                <div key={playerId} className="flex items-center justify-between p-2.5 bg-secondary/40 rounded-lg group hover:bg-secondary/70 transition-all">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusInfo?.dotClass}`} />
                                    <span className="font-medium text-sm text-foreground">{player.name}</span>
                                    {canSeeDetails && conv.position && (
                                      <span className="text-[11px] text-muted-foreground/80 font-medium">{conv.position}</span>
                                    )}
                                    {canSeeDetails && conv.number && (
                                      <span className="text-[11px] font-bold text-foreground/60">#{conv.number}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <StatusIcon size={13} className="text-muted-foreground" />
                                    <span className="text-[11px] font-semibold text-muted-foreground">{statusInfo?.label}</span>
                                  </div>
                                </div>
                              );
                            })}
                          {canManage() && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => startConvocationMode(event.id, event)}
                                className="flex-1 flex items-center justify-center gap-2 text-sm text-accent bg-accent/10 hover:bg-accent/20 font-semibold py-2 rounded-lg transition-colors"
                              >
                                <Pencil size={14} /> Modifier
                              </button>
                              {onSendConvocationNotif && event.convocations && (
                                <button
                                  onClick={() => onSendConvocationNotif(event, event.convocations!)}
                                  className="flex-1 flex items-center justify-center gap-2 text-sm text-primary bg-primary/10 hover:bg-primary/20 font-semibold py-2 rounded-lg transition-colors"
                                  title="Notifier les joueurs convoqués"
                                >
                                  <Bell size={14} /> Convoqués
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pitch view - visible after match OR for admin/coach */}
                  {event.convocationsPublished && event.convocations && !isConvocationMode && (new Date(event.date) < new Date() || canManage()) && (
                    <PitchView convocations={event.convocations} players={players} />
                  )}

                  {/* Convocation mode (coach editing) */}
                  {isConvocationMode && (
                    <div className="space-y-1 animate-fade-in">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Shield size={16} className="text-accent" />
                          <span className="font-semibold text-sm text-foreground">Sélectionner les joueurs</span>
                        </div>
                        <button onClick={() => setConvocationMode(null)} className="text-muted-foreground hover:text-foreground p-1">
                          <X size={16} />
                        </button>
                      </div>
                      {eventPlayers.map(player => {
                        const conv = draftConvocations[player.id];
                        const isConvoked = conv?.status === 'convoque';
                        const isNotConvoked = conv?.status === 'non_convoque';
                        return (
                          <div key={player.id} className={`p-2.5 rounded-xl border transition-all ${
                            isConvoked ? 'bg-accent/8 border-accent/30' :
                            isNotConvoked ? 'bg-destructive/5 border-destructive/20' :
                            'bg-secondary/30 border-transparent'
                          }`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {(() => {
                                  const member = members.find(m => m.playerId === player.id);
                                  const photoURL = member?.photoURL;
                                  const initials = player.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                  if (photoURL) {
                                    return <img src={photoURL} alt={player.name} className="w-7 h-7 rounded-full object-cover shrink-0" />;
                                  }
                                  return (
                                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                      <span className="text-primary text-[10px] font-bold">{initials}</span>
                                    </div>
                                  );
                                })()}
                                <span className="font-medium text-sm text-foreground truncate">{player.name}</span>
                                {player.position && <span className="text-[10px] text-muted-foreground hidden sm:inline">{player.position}</span>}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                {CONVOCATION_STATUSES.map(s => {
                                  const Icon = s.icon;
                                  const isActive = conv?.status === s.value;
                                  return (
                                    <button
                                      key={s.value}
                                      onClick={() => updateDraft(player.id, { status: s.value as 'convoque' | 'non_convoque' })}
                                      className={`w-9 h-8 rounded-lg flex items-center justify-center transition-all ${
                                        isActive ? s.activeClass : 'bg-card border border-border text-muted-foreground hover:border-primary/40'
                                      }`}
                                      title={s.label}
                                    >
                                      <Icon size={14} />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {isConvoked && (
                              <div className="mt-2 flex gap-1.5">
                                <select
                                  value={conv?.position || ''}
                                  onChange={e => updateDraft(player.id, { position: e.target.value })}
                                  className="flex-1 text-[11px] bg-card border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:border-accent/50"
                                  style={{ fontSize: 16 }}
                                >
                                  <option value="">Poste</option>
                                  {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                </select>
                                <input
                                  type="number"
                                  placeholder="#"
                                  value={conv?.number || ''}
                                  onChange={e => updateDraft(player.id, { number: e.target.value ? parseInt(e.target.value) : undefined })}
                                  className="w-16 text-[11px] bg-card border border-border rounded-lg px-2 py-1.5 text-foreground text-center focus:outline-none focus:border-accent/50"
                                  style={{ fontSize: 16 }}
                                  min={1}
                                  max={99}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="pt-3 flex gap-2">
                        <button onClick={() => setConvocationMode(null)} className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:bg-secondary/80 transition-all">
                          Annuler
                        </button>
                        <button onClick={() => publishConvocations(event.id)} className="flex-1 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-all flex items-center justify-center gap-2">
                          <Send size={14} /> Publier
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Start convocation mode button */}
                  {!isConvocationMode && !event.convocationsPublished && canManage() && (
                    <button
                      onClick={() => startConvocationMode(event.id, event)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 text-sm font-semibold transition-all"
                    >
                      <Shield size={14} /> Gérer les convocations
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default PresencesTab;
