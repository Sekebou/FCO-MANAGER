import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Event, Player, Member, Convocation } from '@/pages/Dashboard';
import type { Championship } from '@/components/dashboard/ChampionnatTab';
import { POSITIONS } from '@/pages/Dashboard';
import PitchView from './PitchView';
import { Calendar, CalendarDays, Plus, Check, X, Trash2, Clock, Shield, Send, ChevronDown, ChevronUp, UserCheck, UserX, Pencil, Repeat, CircleDot, Bell, MapPin, ExternalLink, ClipboardCheck, Coins, ArrowLeft, Users, Dumbbell, Trophy, ChevronRight, Timer, User } from 'lucide-react';
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
  championships?: Championship[];
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
  onResetHeader?: () => void;
}

const CONVOCATION_STATUSES = [
  { value: 'convoque', label: 'Convoqué', shortLabel: 'Convoqué', activeClass: 'bg-accent text-accent-foreground ring-2 ring-accent/30 shadow-sm', dotClass: 'bg-accent', icon: UserCheck },
  { value: 'non_convoque', label: 'Non convoqué', shortLabel: 'Non convoqué', activeClass: 'bg-destructive text-destructive-foreground ring-2 ring-destructive/30 shadow-sm', dotClass: 'bg-destructive', icon: UserX },
] as const;

const PresencesTab = ({ events, players, members, championships, currentUser, canManage, canCreateEvent, canManageOwnPresence, togglePresence, deleteEvent, canDeleteEvent, onAddEvent, onUpdateConvocations, onSendConvocationNotif, onResetHeader }: Props) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<'all' | 'match' | 'training'>('all');
  const [convocationMode, setConvocationMode] = useState<string | null>(null);
  const [draftConvocations, setDraftConvocations] = useState<Record<string, Convocation>>({});
  const [expandedConvocations, setExpandedConvocations] = useState<Record<string, boolean>>({});
  const [expandedPlayers, setExpandedPlayers] = useState<Record<string, boolean>>({});
  const [expandedConvocationsEdit, setExpandedConvocationsEdit] = useState<Record<string, boolean>>({});

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const upcomingEvents = events
    .filter(e => new Date(e.date) >= sevenDaysAgo)
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (a.time) { const [h, m] = a.time.split(':').map(Number); dateA.setHours(h || 0, m || 0); }
      if (b.time) { const [h, m] = b.time.split(':').map(Number); dateB.setHours(h || 0, m || 0); }
      return dateA.getTime() - dateB.getTime();
    });

  // Helper: resolve logos for a match event
  const getMatchLogos = (event: Event): { homeLogo?: string; awayLogo?: string; homeName: string; awayName: string } | null => {
    if (event.type !== 'match' || !event.title.toLowerCase().includes(' vs ')) return null;
    const parts = event.title.split(/\s+vs\s+/i);
    const homeName = (parts[0] || '').trim();
    const awayName = (parts[1] || '').trim();
    // Prefer logos stored on event
    if (event.homeLogo || event.awayLogo) return { homeLogo: event.homeLogo, awayLogo: event.awayLogo, homeName, awayName };
    // Fallback: look up from championships teamLogos
    if (championships?.length) {
      for (const c of championships) {
        const logos = c.teamLogos || {};
        const allKeys = Object.keys(logos);
        const findLogo = (name: string) => {
          const n = name.toLowerCase();
          return logos[name] || allKeys.find(k => k.toLowerCase().includes(n) || n.includes(k.toLowerCase())) ? (logos[name] || logos[allKeys.find(k => k.toLowerCase().includes(n) || n.includes(k.toLowerCase()))!]) : undefined;
        };
        const hLogo = findLogo(homeName);
        const aLogo = findLogo(awayName);
        if (hLogo || aLogo) return { homeLogo: hLogo, awayLogo: aLogo, homeName, awayName };
      }
    }
    return { homeName, awayName };
  };

  const selectedEvent = selectedEventId ? events.find(e => e.id === selectedEventId) : null;

  const isEventPast = (event: Event) => {
    const eventDate = new Date(event.date);
    if (event.time) {
      const [h, m] = event.time.split(':').map(Number);
      eventDate.setHours(h || 0, m || 0);
      eventDate.setHours(eventDate.getHours() + 2);
    } else {
      eventDate.setHours(23, 59, 59);
    }
    return eventDate < now;
  };

  const getPlayersForEvent = (_event: Event) => players;

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

  // ─── DETAIL VIEW ───
  if (selectedEvent) {
    const event = selectedEvent;
    const eventPlayers = getPlayersForEvent(event);
    const presences = event.presences || {};
    const presentCount = Object.values(presences).filter(p => p === 'present').length;
    const absentCount = Object.values(presences).filter(p => p === 'absent').length;
    const unknownCount = eventPlayers.length - presentCount - absentCount;
    const isConvocationMode = convocationMode === event.id;
    const isConvocationExpanded = expandedConvocations[event.id];

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Back button */}
        <button
          onClick={() => { setSelectedEventId(null); setConvocationMode(null); window.scrollTo(0, 0); onResetHeader?.(); }}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <ArrowLeft size={16} /> Retour aux événements
        </button>

        {/* Event header card */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                event.type === 'match' ? 'bg-accent/15' : event.type === 'training' ? 'bg-purple-100' : 'bg-muted'
              }`}>
                {event.type === 'match' ? <Trophy size={20} className="text-accent" /> : event.type === 'training' ? <Dumbbell size={20} className="text-purple-600" /> : <Calendar size={20} className="text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-lg text-foreground truncate">{event.title}</h3>
                {/* Date/time in header only for non-training (training shows in enriched section) */}
                {event.type !== 'training' && (
                  <p className="text-muted-foreground text-sm">
                    {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {event.time && <span className="ml-1.5">• {event.time}</span>}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-1 items-center shrink-0">
              {event.recurrence === 'recurring' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary inline-flex items-center gap-1">
                  <Repeat size={10} /> Récurrent
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                event.type === 'match' ? 'bg-accent/10 text-accent' :
                event.type === 'training' ? 'bg-purple-100 text-purple-700' :
                'bg-muted text-muted-foreground'
              }`}>
                {event.type === 'match' ? 'Match' : event.type === 'training' ? 'Entraînement' : 'Autre'}
              </span>
            </div>
          </div>

          {/* Location link - only for match and other (training shows it in enriched section) */}
          {event.location && event.type !== 'training' && (
            <div className="mt-3">
              {event.type === 'match' && (
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-0.5">Lieu du match</span>
              )}
              <a href={`https://waze.com/ul?q=${encodeURIComponent(event.location)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 group">
                <MapPin size={13} className="shrink-0 text-accent/70" />
                <span className="text-xs text-accent/80 underline underline-offset-2 truncate group-active:text-accent">{event.location}</span>
                <ExternalLink size={10} className="shrink-0 text-accent/50" />
              </a>
            </div>
          )}

          {/* Enriched training detail */}
          {event.type === 'training' && (
            <div className="mt-4 space-y-2.5 bg-secondary/40 rounded-xl p-3.5 border border-border/50">
              <div className="flex items-center gap-2.5">
                <Calendar size={14} className="text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground capitalize">
                  {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {event.time && (
                <div className="flex items-center gap-2.5">
                  <Clock size={14} className="text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">{event.time}</span>
                </div>
              )}
              {event.duration && (
                <div className="flex items-center gap-2.5">
                  <Dumbbell size={14} className="text-purple-500 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-foreground">{event.duration} minutes</span>
                    <span className="text-xs text-muted-foreground ml-1.5">— Durée de la séance</span>
                  </div>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-2.5">
                  <MapPin size={14} className="text-accent shrink-0" />
                  <a href={`https://waze.com/ul?q=${encodeURIComponent(event.location)}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent/80 underline underline-offset-2">
                    {event.location}
                  </a>
                </div>
              )}
            </div>
          )}

          {event.createdByName && (
            <p className="flex items-center gap-1.5 text-muted-foreground/60 text-[11px] mt-2">
              par {event.createdByName}
              {(() => {
                const creator = members.find(m => m.id === event.createdBy);
                return creator ? <RoleBadge role={creator.role} displayRole={creator.displayRole} compact /> : null;
              })()}
            </p>
          )}

          {event.type === 'other' && event.reason && (
            <p className="text-[11px] text-foreground/70 mt-2 bg-secondary inline-block px-2 py-0.5 rounded-full">{event.reason}</p>
          )}

          {(event.type === 'match' || event.type === 'training') && (
            <p className="text-[10px] text-accent/70 mt-3 flex items-center gap-1">
              <Coins size={12} className="text-amber-500 shrink-0" /> 5 pts de pari seront ajoutés à votre solde en répondant
            </p>
          )}

          {/* Presence counters */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <motion.span 
              key={`present-${event.id}-${presentCount}`}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex items-center gap-1 bg-accent/10 text-accent px-2.5 py-1 rounded-full text-xs font-semibold"
            >
              <Check size={12} /> {presentCount} Présent{presentCount > 1 ? 's' : ''}
            </motion.span>
            <motion.span 
              key={`absent-${event.id}-${absentCount}`}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.04 }}
              className="flex items-center gap-1 bg-destructive/10 text-destructive px-2.5 py-1 rounded-full text-xs font-semibold"
            >
              <X size={12} /> {absentCount} Absent{absentCount > 1 ? 's' : ''}
            </motion.span>
            <motion.span 
              key={`waiting-${event.id}-${unknownCount}`}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.08 }}
              className="flex items-center gap-1 bg-warning/10 text-warning px-2.5 py-1 rounded-full text-xs font-semibold"
            >
              <Clock size={12} /> {unknownCount} En attente
            </motion.span>
          </div>
        </div>

        {/* Past event banner */}
        {isEventPast(event) && (
          <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-xl px-3 py-2">
            <Clock size={14} className="text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground">Événement terminé — les réponses sont verrouillées</span>
          </div>
        )}

        {/* Presences list */}
        {!isConvocationMode && !event.convocationsPublished && (
          <div className="bg-card border border-border rounded-2xl p-3 shadow-sm">
            <h4 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <Users size={15} className="text-primary" /> Réponses des joueurs
            </h4>
            <div className="space-y-1.5">
              {eventPlayers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 text-sm">Aucun joueur enregistré</p>
              ) : (() => {
                const MAX = 8;
                const isExpanded = expandedPlayers[event.id];
                const visible = isExpanded ? eventPlayers : eventPlayers.slice(0, MAX);
                const hasMore = eventPlayers.length > MAX;
                return (
                  <>
                    {visible.map(player => {
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
                              <div className="relative overflow-visible">
                                <motion.button
                                  onClick={() => !isEventPast(event) && togglePresence(event.id, player.id, 'present')}
                                  disabled={isEventPast(event)}
                                  whileTap={{ scale: 0.82 }}
                                  animate={status === 'present' ? { scale: [1, 1.25, 0.95, 1.08, 1] } : { scale: 1 }}
                                  transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                                  className={`px-2.5 h-8 rounded-lg flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                                    status === 'present'
                                      ? 'bg-accent text-accent-foreground shadow-md shadow-accent/30'
                                      : 'bg-card border border-border hover:border-accent/50 text-muted-foreground'
                                  }`}
                                >
                                  <Check size={12} /> Présent
                                </motion.button>
                                <AnimatePresence>
                                  {status === 'present' && (
                                    <>
                                      <motion.span key={`p1-${player.id}`} initial={{ opacity: 1, y: 0, x: 0, scale: 0.8 }} animate={{ opacity: 0, y: -36, x: -6, scale: 1.8 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-accent font-black text-base">✓</motion.span>
                                      <motion.span key={`p2-${player.id}`} initial={{ opacity: 1, y: 0, x: 0, scale: 0.6 }} animate={{ opacity: 0, y: -28, x: 14, scale: 1.4 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-accent font-black text-xs">✓</motion.span>
                                      <motion.span key={`p3-${player.id}`} initial={{ opacity: 0.8, y: 0, x: 0, scale: 0.5 }} animate={{ opacity: 0, y: -20, x: -14, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }} className="absolute top-1 left-1/2 -translate-x-1/2 pointer-events-none text-accent/60 font-black text-[10px]">✓</motion.span>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>
                              <div className="relative overflow-visible">
                                <motion.button
                                  onClick={() => !isEventPast(event) && togglePresence(event.id, player.id, 'absent')}
                                  disabled={isEventPast(event)}
                                  whileTap={isEventPast(event) ? {} : { scale: 0.82 }}
                                  animate={status === 'absent' ? { scale: [1, 1.25, 0.95, 1.08, 1] } : { scale: 1 }}
                                  transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                                  className={`px-2.5 h-8 rounded-lg flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                                    status === 'absent'
                                      ? 'bg-destructive text-destructive-foreground shadow-md shadow-destructive/30'
                                      : 'bg-card border border-border hover:border-destructive/50 text-muted-foreground'
                                  }`}
                                >
                                  <X size={12} /> Absent
                                </motion.button>
                                <AnimatePresence>
                                  {status === 'absent' && (
                                    <>
                                      <motion.span key={`a1-${player.id}`} initial={{ opacity: 1, y: 0, x: 0, scale: 0.8 }} animate={{ opacity: 0, y: -36, x: -6, scale: 1.8 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-destructive font-black text-base">✕</motion.span>
                                      <motion.span key={`a2-${player.id}`} initial={{ opacity: 1, y: 0, x: 0, scale: 0.6 }} animate={{ opacity: 0, y: -28, x: 14, scale: 1.4 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-destructive font-black text-xs">✕</motion.span>
                                      <motion.span key={`a3-${player.id}`} initial={{ opacity: 0.8, y: 0, x: 0, scale: 0.5 }} animate={{ opacity: 0, y: -20, x: -14, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }} className="absolute top-1 left-1/2 -translate-x-1/2 pointer-events-none text-destructive/60 font-black text-[10px]">✕</motion.span>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          ) : (
                            <span className={`px-2.5 h-8 rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0 ${
                              status === 'present' ? 'bg-accent/10 text-accent' :
                              status === 'absent' ? 'bg-destructive/10 text-destructive' :
                              'bg-warning/10 text-warning'
                            }`}>
                              {status === 'present' ? <><Check size={12} /> Présent</> : status === 'absent' ? <><X size={12} /> Absent</> : <><Clock size={12} /> En attente</>}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {hasMore && (
                      <button
                        onClick={() => setExpandedPlayers(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/60 rounded-xl transition-all"
                      >
                        {isExpanded ? <><ChevronUp size={14} /> Réduire</> : <><ChevronDown size={14} /> {eventPlayers.length - MAX} joueur{eventPlayers.length - MAX > 1 ? 's' : ''} de plus</>}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Convocation section - only for match events */}
        {event.type === 'match' && (
          <div className="bg-card border border-border rounded-2xl p-3 shadow-sm">
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
                        const order: Record<string, number> = { convoque: 0, non_convoque: 1 };
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
                              {canSeeDetails && conv.position && <span className="text-[11px] text-muted-foreground/80 font-medium">{conv.position}</span>}
                              {canSeeDetails && conv.number && <span className="text-[11px] font-bold text-foreground/60">#{conv.number}</span>}
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
                        <button onClick={() => startConvocationMode(event.id, event)} className="flex-1 flex items-center justify-center gap-2 text-sm text-accent bg-accent/10 hover:bg-accent/20 font-semibold py-2 rounded-lg transition-colors">
                          <Pencil size={14} /> Modifier
                        </button>
                        {onSendConvocationNotif && event.convocations && (
                          <button onClick={() => onSendConvocationNotif(event, event.convocations!)} className="flex-1 flex items-center justify-center gap-2 text-sm text-primary bg-primary/10 hover:bg-primary/20 font-semibold py-2 rounded-lg transition-colors" title="Notifier les joueurs convoqués">
                            <Bell size={14} /> Convoqués
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Pitch view */}
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
                  <button onClick={() => setConvocationMode(null)} className="text-muted-foreground hover:text-foreground p-1"><X size={16} /></button>
                </div>
                <div className="text-[11px] text-muted-foreground/70 bg-muted/40 rounded-lg px-3 py-1.5 mb-2 flex items-center gap-1.5">
                  <UserCheck size={11} className="shrink-0 text-muted-foreground/50" />
                  <span className="truncate">Affichage limité aux joueurs présents</span>
                </div>
                {eventPlayers.filter(p => presences[p.id] === 'present').length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">Aucun joueur n'a encore répondu présent.</p>
                )}
                {(() => {
                  const presentPlayers = eventPlayers.filter(p => presences[p.id] === 'present');
                  const MAX_CONV = 8;
                  const isConvEditExpanded = expandedConvocationsEdit[event.id];
                  const visibleConvPlayers = isConvEditExpanded ? presentPlayers : presentPlayers.slice(0, MAX_CONV);
                  const hasMoreConv = presentPlayers.length > MAX_CONV;
                  return (
                    <>
                      {visibleConvPlayers.map(player => {
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
                                  if (photoURL) return <img src={photoURL} alt={player.name} className="w-7 h-7 rounded-full object-cover shrink-0" />;
                                  return (
                                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                      <span className="text-primary text-[10px] font-bold">{initials}</span>
                                    </div>
                                  );
                                })()}
                                {(() => {
                                  const [firstName, ...rest] = player.name.split(' ');
                                  const lastName = rest.join(' ');
                                  return (
                                    <div className="flex flex-col leading-tight min-w-0">
                                      <span className="font-semibold text-sm text-foreground">{firstName}</span>
                                      {lastName && <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">{lastName}</span>}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <div className="relative overflow-visible">
                                  <motion.button onClick={() => updateDraft(player.id, { status: 'convoque' })} whileTap={{ scale: 0.82 }} animate={isConvoked ? { scale: [1, 1.25, 0.95, 1.08, 1] } : { scale: 1 }} transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }} className={`px-1.5 h-7 rounded-lg flex items-center gap-0.5 text-[10px] font-semibold transition-colors ${isConvoked ? 'bg-accent text-accent-foreground shadow-md shadow-accent/30' : 'bg-card border border-border hover:border-accent/50 text-muted-foreground'}`}>
                                    <UserCheck size={11} /> Oui
                                  </motion.button>
                                  <AnimatePresence>
                                    {isConvoked && (
                                      <>
                                        <motion.span key="p1" initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -28, x: -6, scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 0.55 }} className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-accent text-xs font-bold z-10">✓</motion.span>
                                        <motion.span key="p2" initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -22, x: 8, scale: 1.1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: 0.06 }} className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-accent text-xs font-bold z-10">✓</motion.span>
                                      </>
                                    )}
                                  </AnimatePresence>
                                </div>
                                <div className="relative overflow-visible">
                                  <motion.button onClick={() => updateDraft(player.id, { status: 'non_convoque' })} whileTap={{ scale: 0.82 }} animate={isNotConvoked ? { scale: [1, 1.25, 0.95, 1.08, 1] } : { scale: 1 }} transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }} className={`px-1.5 h-7 rounded-lg flex items-center gap-0.5 text-[10px] font-semibold transition-colors ${isNotConvoked ? 'bg-destructive text-destructive-foreground shadow-md shadow-destructive/30' : 'bg-card border border-border hover:border-destructive/50 text-muted-foreground'}`}>
                                    <UserX size={11} /> Non
                                  </motion.button>
                                  <AnimatePresence>
                                    {isNotConvoked && (
                                      <>
                                        <motion.span key="n1" initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -28, x: -6, scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 0.55 }} className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-destructive text-xs font-bold z-10">✕</motion.span>
                                        <motion.span key="n2" initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -22, x: 8, scale: 1.1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: 0.06 }} className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-destructive text-xs font-bold z-10">✕</motion.span>
                                      </>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>
                            </div>
                            {isConvoked && (
                              <div className="mt-2 flex gap-1.5 items-center">
                                <div className="relative flex-1 inline-flex items-center bg-secondary/50 border border-border/60 rounded-lg px-2 h-7 gap-1 cursor-pointer">
                                  <span className="text-[11px] font-medium text-foreground flex-1 truncate">
                                    {conv?.position || <span className="text-muted-foreground">Poste</span>}
                                  </span>
                                  <ChevronDown size={9} className="text-muted-foreground shrink-0" />
                                  <select value={conv?.position || ''} onChange={e => updateDraft(player.id, { position: e.target.value })} className="absolute inset-0 opacity-0 w-full cursor-pointer" style={{ fontSize: 16 }}>
                                    <option value="">Poste</option>
                                    {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                  </select>
                                </div>
                                <input type="number" placeholder="#" value={conv?.number || ''} onChange={e => updateDraft(player.id, { number: e.target.value ? parseInt(e.target.value) : undefined })} className="w-12 h-7 text-[11px] bg-secondary/50 border border-border/60 rounded-lg px-1.5 text-foreground text-center focus:outline-none focus:border-accent/50" style={{ fontSize: 16 }} min={1} max={99} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {hasMoreConv && (
                        <button onClick={() => setExpandedConvocationsEdit(prev => ({ ...prev, [event.id]: !prev[event.id] }))} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/60 rounded-xl transition-all">
                          {isConvEditExpanded ? <><ChevronUp size={14} /> Réduire</> : <><ChevronDown size={14} /> {presentPlayers.length - MAX_CONV} joueur{presentPlayers.length - MAX_CONV > 1 ? 's' : ''} de plus</>}
                        </button>
                      )}
                    </>
                  );
                })()}
                <div className="pt-3 flex gap-2">
                  <button onClick={() => setConvocationMode(null)} className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:bg-secondary/80 transition-all">Annuler</button>
                  <button onClick={() => publishConvocations(event.id)} className="flex-1 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-all flex items-center justify-center gap-2">
                    <Send size={14} /> Publier
                  </button>
                </div>
              </div>
            )}

            {/* Start convocation mode button */}
            {!isConvocationMode && !event.convocationsPublished && canManage() && (
              <button onClick={() => startConvocationMode(event.id, event)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 text-sm font-semibold transition-all">
                <Shield size={14} /> Gérer les convocations
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── LIST VIEW (cards) ───
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent/20 rounded-xl flex items-center justify-center">
            <ClipboardCheck className="text-accent" size={18} />
          </div>
          <h2 className="text-lg font-bold text-foreground">Gestion des présences</h2>
        </div>
        {canCreateEvent() && (
          <button onClick={onAddEvent} className="bg-primary text-primary-foreground px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-primary/90 transition-all text-xs font-medium">
            <Plus size={16} /> Événement
          </button>
        )}
      </div>

      {/* Native-feel segmented filter */}
      <div className="bg-secondary/60 backdrop-blur-sm p-1.5 rounded-2xl border border-border/50 flex gap-1">
        {([
          { key: 'all' as const, label: 'Tous', icon: Calendar, count: upcomingEvents.length },
          { key: 'match' as const, label: 'Matchs', icon: Trophy, count: upcomingEvents.filter(e => e.type === 'match').length },
          { key: 'training' as const, label: 'Entraîn.', icon: Dumbbell, count: upcomingEvents.filter(e => e.type === 'training').length },
        ]).map(tab => {
          const isActive = eventFilter === tab.key;
          const TabIcon = tab.icon;
          return (
            <motion.button
              key={tab.key}
              onClick={() => setEventFilter(tab.key)}
              whileTap={{ scale: 0.97 }}
              className={`relative flex-1 flex items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-colors overflow-hidden ${
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="presences-filter-pill"
                  className="absolute inset-0 bg-card rounded-xl shadow-sm border border-border/60"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative flex items-center gap-1 min-w-0">
                <TabIcon size={12} className="shrink-0" />
                <span className="truncate">{tab.label}</span>
                <span className={`text-[9px] font-black px-1 py-0.5 rounded-md min-w-[18px] text-center shrink-0 ${
                  isActive ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
                }`}>{tab.count}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      {(() => {
        const filteredEvents = eventFilter === 'all'
          ? upcomingEvents
          : upcomingEvents.filter(e => e.type === eventFilter);

        return filteredEvents.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <Calendar className="mx-auto mb-3 text-muted-foreground" size={48} />
            <p className="text-muted-foreground font-medium">
              {eventFilter === 'all' ? 'Aucun événement à venir' : eventFilter === 'match' ? 'Aucun match à venir' : 'Aucun entraînement à venir'}
            </p>
            {canManage() && <p className="text-sm text-muted-foreground/70 mt-2">Cliquez sur "+ Événement" pour en créer un</p>}
          </div>
        ) : (
        <div className="space-y-0 max-w-3xl mx-auto">
          {filteredEvents.map((event, idx) => {
            const presences = event.presences || {};

            const presentCount = Object.values(presences).filter(p => p === 'present').length;
            const absentCount = Object.values(presences).filter(p => p === 'absent').length;
            const pendingCount = players.length - presentCount - absentCount;
            const isPast = isEventPast(event);
            const matchInfo = getMatchLogos(event);
            const isMatch = !!matchInfo;

            return (
              <React.Fragment key={event.id}>
                {/* Divider between cards */}
                {idx > 0 && (
                  <div className="flex items-center gap-3 py-2 px-2">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                    <div className="w-1.5 h-1.5 rounded-full bg-border" />
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                )}
              <div
                className={`relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-all ${isPast ? 'opacity-50' : 'active:shadow-md hover:shadow-lg hover:border-border/80'}`}
              >
                {/* Main clickable area */}
                <button
                  onClick={() => setSelectedEventId(event.id)}
                  className="w-full text-left"
                >
                  {/* Match card: special layout with logos */}
                  {isMatch && matchInfo ? (
                    <div className="p-4 sm:p-5">
                      {/* Date + time row */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full"
                          >Match</span>
                          <span className="text-[11px] font-medium text-muted-foreground capitalize">
                            {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {event.time && (
                            <span
                              className="text-sm font-black text-accent-foreground bg-accent px-2.5 py-0.5 rounded-lg shadow-sm shadow-accent/30"
                            >{event.time}</span>
                          )}
                          <ChevronRight size={16} className="text-muted-foreground/40" />
                        </div>
                      </div>

                      {/* Teams row with logos */}
                      <div className="flex items-center justify-center gap-4 py-2">
                        {/* Home team */}
                        <div
                          className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
                        >
                          {matchInfo.homeLogo ? (
                            <img src={matchInfo.homeLogo} alt="" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-contain bg-secondary/50 p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-secondary flex items-center justify-center">
                              <Shield size={22} className="text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-xs font-bold text-foreground text-center leading-tight line-clamp-2">{matchInfo.homeName}</span>
                        </div>

                        {/* VS */}
                        <div
                          className="flex flex-col items-center shrink-0"
                        >
                          <span className="text-2xl font-black text-accent drop-shadow-sm">VS</span>
                        </div>

                        {/* Away team */}
                        <div
                          className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
                        >
                          {matchInfo.awayLogo ? (
                            <img src={matchInfo.awayLogo} alt="" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-contain bg-secondary/50 p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-secondary flex items-center justify-center">
                              <Shield size={22} className="text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-xs font-bold text-foreground text-center leading-tight line-clamp-2">{matchInfo.awayName}</span>
                        </div>
                      </div>

                      {/* Location + counters row */}
                      <div
                        className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-border/50"
                      >
                        <div className="flex items-center justify-between">
                          {event.location ? (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate flex-1 mr-2 uppercase font-semibold tracking-wide">
                              <MapPin size={10} className="shrink-0 text-accent/60" /> {event.location}
                            </p>
                          ) : <div />}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-accent">
                              <Check size={10} /> {presentCount}
                            </span>
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-destructive">
                              <X size={10} /> {absentCount}
                            </span>
                            {pendingCount > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-warning">
                                <Clock size={10} /> {pendingCount}
                              </span>
                            )}
                          </div>
                        </div>
                        {event.createdByName && (
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <User size={9} className="shrink-0" /> {event.createdByName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Training / Other card — same size as match */
                    <div className="p-4 sm:p-5">
                      {/* Date + time row (same as match) */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            event.type === 'training' ? 'bg-purple-100 text-purple-700' : 'bg-accent/10 text-accent'
                          }`}>
                            {event.type === 'training' ? 'Entraînement' : 'Autre'}
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground capitalize">
                            {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {event.time && (
                            <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg shadow-sm ${
                              event.type === 'training'
                                ? 'bg-purple-600 text-white shadow-purple-600/30'
                                : 'bg-muted text-foreground'
                            }`}>{event.time}</span>
                          )}
                          <ChevronRight size={16} className="text-muted-foreground/40" />
                        </div>
                      </div>

                      {/* Central content area — same height as match logos */}
                      <div className="flex items-center justify-center py-2 min-h-[88px]">
                        <div className="flex flex-col items-center gap-2">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                            event.type === 'training' ? 'bg-purple-500/10' : 'bg-muted'
                          }`}>
                            {event.type === 'training' ? <Dumbbell size={28} className="text-purple-600" /> : <Calendar size={28} className="text-muted-foreground" />}
                          </div>
                          <h3 className="font-bold text-sm text-foreground text-center leading-tight line-clamp-2 max-w-[220px]">{event.title}</h3>
                          {event.duration && (
                            <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                              <Timer size={10} className="shrink-0" /> {event.duration} min
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Location + counters row (same as match) */}
                      <div className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          {event.location ? (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate flex-1 mr-2 uppercase font-semibold tracking-wide">
                              <MapPin size={10} className="shrink-0 text-accent/60" /> {event.location}
                            </p>
                          ) : <div />}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-accent">
                              <Check size={10} /> {presentCount}
                            </span>
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-destructive">
                              <X size={10} /> {absentCount}
                            </span>
                            {pendingCount > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-warning">
                                <Clock size={10} /> {pendingCount}
                              </span>
                            )}
                          </div>
                        </div>
                        {event.createdByName && (
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <User size={9} className="shrink-0" /> {event.createdByName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* "Tap for details" hint */}
                  {!isPast && (
                  <div className="px-3.5 pb-1.5 mt-1">
                      <p className="text-[9px] text-muted-foreground/50 text-center">Appuyez pour voir plus de détails sur l'événement</p>
                    </div>
                  )}
                  {isPast && (
                    <div className="mx-3.5 mb-2 -mt-0.5">
                      <span className="text-[9px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Clock size={8} /> Terminé
                      </span>
                    </div>
                  )}
                </button>

                {/* Quick presence buttons */}
                {!isPast && currentUser?.playerId && (() => {
                  const myStatus = (event.presences || {})[currentUser.playerId!];
                  return (
                    <div className="flex items-center gap-1.5 px-3.5 pb-2.5">
                      <div className="relative flex-1 overflow-visible">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          animate={myStatus === 'present' ? { scale: [1, 1.15, 0.95, 1.05, 1] } : { scale: 1 }}
                          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                          onClick={(e) => { e.stopPropagation(); togglePresence(event.id, currentUser.playerId!, 'present'); }}
                          className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                            myStatus === 'present' ? 'bg-accent text-accent-foreground shadow-sm shadow-accent/30' : 'bg-secondary border border-border text-muted-foreground hover:border-accent/50'
                          }`}
                        >
                          <Check size={12} /> Présent
                        </motion.button>
                        <AnimatePresence>
                          {myStatus === 'present' && (
                            <>
                              <motion.span key={`qp1-${event.id}`} initial={{ opacity: 1, y: 0, scale: 0.8 }} animate={{ opacity: 0, y: -28, x: -8, scale: 1.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-accent font-black text-sm">✓</motion.span>
                              <motion.span key={`qp2-${event.id}`} initial={{ opacity: 0.8, y: 0, scale: 0.5 }} animate={{ opacity: 0, y: -22, x: 10, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-accent font-black text-[10px]">✓</motion.span>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="relative flex-1 overflow-visible">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          animate={myStatus === 'absent' ? { scale: [1, 1.15, 0.95, 1.05, 1] } : { scale: 1 }}
                          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                          onClick={(e) => { e.stopPropagation(); togglePresence(event.id, currentUser.playerId!, 'absent'); }}
                          className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                            myStatus === 'absent' ? 'bg-destructive text-destructive-foreground shadow-sm shadow-destructive/30' : 'bg-secondary border border-border text-muted-foreground hover:border-destructive/50'
                          }`}
                        >
                          <X size={12} /> Absent
                        </motion.button>
                        <AnimatePresence>
                          {myStatus === 'absent' && (
                            <>
                              <motion.span key={`qa1-${event.id}`} initial={{ opacity: 1, y: 0, scale: 0.8 }} animate={{ opacity: 0, y: -28, x: -8, scale: 1.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-destructive font-black text-sm">✕</motion.span>
                              <motion.span key={`qa2-${event.id}`} initial={{ opacity: 0.8, y: 0, scale: 0.5 }} animate={{ opacity: 0, y: -22, x: 10, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-destructive font-black text-[10px]">✕</motion.span>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })()}

                {canDeleteEvent(event) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-all z-10"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              </React.Fragment>
            );
          })}
        </div>
        );
      })()}
    </div>
  );
};

export default PresencesTab;
