import React, { useState } from 'react';
import type { Event, Player, Member, Convocation } from '@/pages/Dashboard';
import { POSITIONS, TEAMS } from '@/pages/Dashboard';
import { Calendar, Plus, Check, X, Trash2, Clock, Shield, Users, Send, ChevronDown, ChevronUp } from 'lucide-react';

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
  onAddEvent: () => void;
  onUpdateConvocations: (eventId: string, convocations: Record<string, Convocation>) => void;
  onSendConvocationEmails: (eventId: string) => void;
}

const CONVOCATION_STATUSES = [
  { value: 'titulaire', label: 'Titulaire', color: 'bg-accent text-accent-foreground', icon: '🟢' },
  { value: 'remplacant', label: 'Remplaçant', color: 'bg-blue-500 text-white', icon: '🔵' },
  { value: 'non_convoque', label: 'Non convoqué', color: 'bg-muted text-muted-foreground', icon: '⚪' },
  { value: 'repos', label: 'Repos', color: 'bg-warning/20 text-warning', icon: '🟡' },
] as const;

const PresencesTab = ({ events, players, members, currentUser, canManage, canManageOwnPresence, togglePresence, deleteEvent, onAddEvent, onUpdateConvocations, onSendConvocationEmails }: Props) => {
  const [convocationMode, setConvocationMode] = useState<string | null>(null);
  const [draftConvocations, setDraftConvocations] = useState<Record<string, Convocation>>({});
  const [expandedConvocations, setExpandedConvocations] = useState<Record<string, boolean>>({});

  // Filter events: training = global, match = team-specific
  const filterEventsByTeam = (evts: Event[]) => {
    if (!currentUser) return evts;
    if (currentUser.role === 'admin') return evts;
    return evts.filter(e => {
      if (e.type !== 'match') return true; // training/other = global
      if (!e.team) return true; // legacy events without team
      return e.team === currentUser.team;
    });
  };

  const upcomingEvents = filterEventsByTeam(events)
    .filter(e => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Get players relevant for a match event (same team)
  const getPlayersForEvent = (event: Event) => {
    if (event.type === 'match' && event.team) {
      return players.filter(p => p.team === event.team);
    }
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
          const teamLabel = event.team ? TEAMS.find(t => t.id === event.team)?.label : null;

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
                  {canManage() && (
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
                        <div className="space-y-2 animate-fade-in">
                          {Object.entries(event.convocations)
                            .sort((a, b) => {
                              const order = { titulaire: 0, remplacant: 1, repos: 2, non_convoque: 3 };
                              return (order[a[1].status] || 3) - (order[b[1].status] || 3);
                            })
                            .map(([playerId, conv]) => {
                              const player = players.find(p => p.id === playerId);
                              if (!player) return null;
                              const statusInfo = CONVOCATION_STATUSES.find(s => s.value === conv.status);
                              return (
                                <div key={playerId} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-sm">{statusInfo?.icon}</span>
                                    <span className="font-medium text-sm text-foreground">{player.name}</span>
                                    {conv.position && (
                                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{conv.position}</span>
                                    )}
                                    {conv.number && (
                                      <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">#{conv.number}</span>
                                    )}
                                  </div>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo?.color}`}>
                                    {statusInfo?.label}
                                  </span>
                                </div>
                              );
                            })}
                          {canManage() && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => startConvocationMode(event.id, event)}
                                className="text-sm text-accent hover:underline font-medium"
                              >
                                Modifier les convocations
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Convocation mode (coach editing) */}
                  {isConvocationMode && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield size={16} className="text-accent" />
                        <h4 className="font-semibold text-sm text-foreground">Gestion des convocations</h4>
                      </div>
                      {eventPlayers.map(player => {
                        const draft = draftConvocations[player.id] || { status: 'non_convoque' as const };
                        const isConvoked = draft.status === 'titulaire' || draft.status === 'remplacant';
                        return (
                          <div key={player.id} className="p-3 bg-secondary/50 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm text-foreground">{player.name}</span>
                              <div className="flex gap-1">
                                {CONVOCATION_STATUSES.map(s => (
                                  <button
                                    key={s.value}
                                    onClick={() => updateDraft(player.id, { status: s.value as Convocation['status'] })}
                                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                      draft.status === s.value ? s.color + ' shadow-sm' : 'bg-card border border-border text-muted-foreground hover:border-accent/30'
                                    }`}
                                  >
                                    {s.icon} {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {isConvoked && (
                              <div className="flex gap-2 animate-fade-in">
                                <select
                                  value={draft.position || ''}
                                  onChange={(e) => updateDraft(player.id, { position: e.target.value || undefined })}
                                  className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                                >
                                  <option value="">Poste...</option>
                                  {POSITIONS.map(pos => (
                                    <option key={pos} value={pos}>{pos}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="1"
                                  max="99"
                                  value={draft.number || ''}
                                  onChange={(e) => updateDraft(player.id, { number: parseInt(e.target.value) || undefined })}
                                  placeholder="N°"
                                  className="w-16 bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => setConvocationMode(null)}
                          className="flex-1 py-2.5 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => publishConvocations(event.id)}
                          className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm flex items-center justify-center gap-2"
                        >
                          <Check size={16} /> Publier
                        </button>
                        <button
                          onClick={() => { publishConvocations(event.id); setTimeout(() => onSendConvocationEmails(event.id), 500); }}
                          className="py-2.5 px-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all text-sm flex items-center gap-2"
                          title="Publier et notifier par email"
                        >
                          <Send size={14} /> Email
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
