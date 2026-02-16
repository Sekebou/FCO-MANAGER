import React, { useState } from 'react';
import type { Event, Player, Member, Convocation } from '@/pages/Dashboard';
import { POSITIONS } from '@/pages/Dashboard';
import PitchView from './PitchView';
import { Calendar, Plus, Check, X, Trash2, Clock, Shield, Users, Send, ChevronDown, ChevronUp, UserCheck, UserX, Hash, Crosshair, Pencil } from 'lucide-react';

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
  canManageOwnPresence: (playerId: string) => boolean | null;
  togglePresence: (eventId: string, playerId: string, status: string) => void;
  deleteEvent: (eventId: string) => void;
  canDeleteEvent: (event: Event) => boolean;
  onAddEvent: () => void;
  onUpdateConvocations: (eventId: string, convocations: Record<string, Convocation>) => void;
  onSendConvocationEmails: (eventId: string) => void;
}

const CONVOCATION_STATUSES = [
  { value: 'convoque', label: 'Convoqué', shortLabel: 'Convoqué', activeClass: 'bg-accent text-accent-foreground ring-2 ring-accent/30 shadow-sm', dotClass: 'bg-accent', icon: UserCheck },
  { value: 'non_convoque', label: 'Non convoqué', shortLabel: 'Non convoqué', activeClass: 'bg-destructive text-destructive-foreground ring-2 ring-destructive/30 shadow-sm', dotClass: 'bg-destructive', icon: UserX },
] as const;

const PresencesTab = ({ events, players, members, currentUser, canManage, canManageOwnPresence, togglePresence, deleteEvent, canDeleteEvent, onAddEvent, onUpdateConvocations, onSendConvocationEmails }: Props) => {
  const [convocationMode, setConvocationMode] = useState<string | null>(null);
  const [draftConvocations, setDraftConvocations] = useState<Record<string, Convocation>>({});
  const [expandedConvocations, setExpandedConvocations] = useState<Record<string, boolean>>({});

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
    // Pre-populate from existing convocations or presences
    const draft: Record<string, Convocation> = {};
    const eventPlayers = getPlayersForEvent(event);
    eventPlayers.forEach(p => {
      if (event.convocations?.[p.id]) {
        draft[p.id] = event.convocations[p.id];
      }
      // No pre-fill: coach decides everything from scratch
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground">Gestion des présences</h2>
        <div className="flex gap-2">
          {canManage() && (
            <button onClick={onAddEvent} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all text-sm font-medium">
              <Plus size={18} /> Événement
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
          const teamLabel = null;

          return (
            <div key={event.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm animate-fade-in">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg text-foreground">{event.title}</h3>
                    {teamLabel && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                        {teamLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {event.createdByName && (
                      <span className="text-muted-foreground/60"> · par {event.createdByName}</span>
                    )}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span className="flex items-center gap-1.5 bg-accent/10 text-accent px-3 py-1.5 rounded-full text-xs font-semibold">
                      <Check size={13} /> {presentCount} Présent{presentCount > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1.5 bg-destructive/10 text-destructive px-3 py-1.5 rounded-full text-xs font-semibold">
                      <X size={13} /> {absentCount} Absent{absentCount > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1.5 bg-warning/10 text-warning px-3 py-1.5 rounded-full text-xs font-semibold">
                      <Clock size={13} /> {unknownCount} En attente
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    event.type === 'match' ? 'bg-accent/10 text-accent' :
                    event.type === 'training' ? 'bg-purple-100 text-purple-700' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {event.type === 'match' ? 'Match' : event.type === 'training' ? 'Entraînement' : 'Autre'}
                  </span>
                  {canDeleteEvent(event) && (
                    <button onClick={() => deleteEvent(event.id)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-all">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Presences list */}
              <div className="space-y-2">
                {eventPlayers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">Aucun joueur enregistré</p>
                ) : (
                  eventPlayers.map(player => {
                    const status = presences[player.id];
                    return (
                      <div key={player.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                        <div className="flex items-center gap-2.5">
                          {(() => {
                            const member = members.find(m => m.playerId === player.id);
                            const photoURL = member?.photoURL;
                            const initials = player.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                            if (photoURL) {
                              return <img src={photoURL} alt={player.name} className="w-7 h-7 rounded-full object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
                            }
                            return (
                              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                                <span className="text-primary-foreground text-[10px] font-bold">{initials}</span>
                              </div>
                            );
                          })()}
                          <span className="font-medium text-sm text-foreground">{player.name}</span>
                        </div>
                        {canManageOwnPresence(player.id) ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => togglePresence(event.id, player.id, 'present')}
                              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all ${
                                status === 'present' ? 'bg-accent text-accent-foreground shadow-sm' : 'bg-card border border-border hover:border-accent/50 text-muted-foreground'
                              }`}
                            >
                              <Check size={14} /> Présent
                            </button>
                            <button
                              onClick={() => togglePresence(event.id, player.id, 'absent')}
                              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all ${
                                status === 'absent' ? 'bg-destructive text-destructive-foreground shadow-sm' : 'bg-card border border-border hover:border-destructive/50 text-muted-foreground'
                              }`}
                            >
                              <X size={14} /> Absent
                            </button>
                          </div>
                        ) : (
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                            status === 'present' ? 'bg-success/10 text-success' :
                            status === 'absent' ? 'bg-destructive/10 text-destructive' :
                            'bg-warning/10 text-warning'
                          }`}>
                            {status === 'present' ? <><Check size={12} /> Présent</> : status === 'absent' ? <><X size={12} /> Absent</> : <><Clock size={12} /> En attente</>}
                          </span>
                        )}
                      </div>
                    );
                  })
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
                              return (
                                <div key={playerId} className="flex items-center justify-between p-2.5 bg-secondary/40 rounded-lg group hover:bg-secondary/70 transition-all">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusInfo?.dotClass}`} />
                                    <span className="font-medium text-sm text-foreground">{player.name}</span>
                                    {conv.position && (
                                      <span className="text-[11px] text-muted-foreground/80 font-medium">{conv.position}</span>
                                    )}
                                    {conv.number && (
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
                            <button
                              onClick={() => startConvocationMode(event.id, event)}
                              className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-accent bg-accent/10 hover:bg-accent/20 font-semibold py-2 rounded-lg transition-colors"
                            >
                              <Pencil size={14} /> Modifier les convocations
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pitch view for published convocations */}
                  {event.convocationsPublished && event.convocations && !isConvocationMode && (
                    <PitchView convocations={event.convocations} players={players} />
                  )}

                  {/* Convocation mode (coach editing) */}
                  {isConvocationMode && (
                    <div className="space-y-1 animate-fade-in">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Shield size={16} className="text-accent" />
                          <h4 className="font-semibold text-sm text-foreground">Gestion des convocations</h4>
                        </div>
                        <div className="flex gap-1">
                          {CONVOCATION_STATUSES.map(s => {
                            const Icon = s.icon;
                            const count = Object.values(draftConvocations).filter(d => d.status === s.value).length;
                            return (
                              <span key={s.value} className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                <div className={`w-1.5 h-1.5 rounded-full ${s.dotClass}`} />
                                {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {eventPlayers.map(player => {
                        const draft = draftConvocations[player.id] || { status: 'non_convoque' as const };
                        const isConvoked = draft.status === 'convoque';
                        const presence = event.presences?.[player.id];
                        return (
                          <div key={player.id} className="p-3 bg-secondary/30 rounded-xl space-y-2.5 border border-transparent hover:border-border/50 transition-all">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-medium text-sm text-foreground truncate">{player.name}</span>
                                {presence && (
                                  <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${presence === 'present' ? 'bg-accent' : 'bg-destructive'}`} title={presence === 'present' ? 'Présent' : 'Absent'} />
                                )}
                              </div>
                              <div className="flex gap-0.5 shrink-0">
                                {CONVOCATION_STATUSES.map(s => {
                                  const Icon = s.icon;
                                  const isActive = draft.status === s.value;
                                  return (
                                    <button
                                      key={s.value}
                                      onClick={() => updateDraft(player.id, { status: s.value as Convocation['status'] })}
                                      className={`relative px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                                        isActive ? s.activeClass : 'bg-card border border-border/60 text-muted-foreground/70 hover:bg-secondary hover:text-foreground'
                                      }`}
                                      title={s.label}
                                    >
                                      <Icon size={12} />
                                      <span className="hidden sm:inline">{s.shortLabel}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {isConvoked && (
                              <div className="flex gap-2 animate-fade-in pl-0.5">
                                <div className="flex-1 relative">
                                  <Crosshair size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                  <select
                                    value={draft.position || ''}
                                    onChange={(e) => updateDraft(player.id, { position: e.target.value || undefined })}
                                    className="w-full pl-8 pr-3 py-1.5 bg-card border border-border/60 rounded-lg text-xs text-foreground outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 appearance-none transition-all"
                                  >
                                    <option value="">Poste...</option>
                                    {POSITIONS.map(pos => (
                                      <option key={pos} value={pos}>{pos}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="relative w-[72px]">
                                  <Hash size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                                  <input
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={draft.number || ''}
                                    onChange={(e) => updateDraft(player.id, { number: parseInt(e.target.value) || undefined })}
                                    placeholder="N°"
                                    className="w-full pl-8 pr-2 py-1.5 bg-card border border-border/60 rounded-lg text-xs text-foreground outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex gap-2 pt-3">
                        <button
                          onClick={() => setConvocationMode(null)}
                          className="flex-1 py-2.5 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => publishConvocations(event.id)}
                          className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Check size={15} /> Publier
                        </button>
                        <button
                          onClick={() => { publishConvocations(event.id); setTimeout(() => onSendConvocationEmails(event.id), 500); }}
                          className="py-2.5 px-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all text-sm flex items-center gap-2 shadow-sm"
                          title="Publier et notifier par email"
                        >
                          <Send size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Start convocation button */}
                  {canManage() && !isConvocationMode && !event.convocationsPublished && (
                    <button
                      onClick={() => startConvocationMode(event.id, event)}
                      className="w-full py-2.5 bg-accent/10 text-accent rounded-xl font-medium hover:bg-accent/20 transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <Shield size={16} /> Gérer les convocations
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
