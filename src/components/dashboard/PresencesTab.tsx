import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Event, Player, Member, Convocation } from '@/pages/Dashboard';
import type { Championship } from '@/components/dashboard/ChampionnatTab';
import { POSITIONS } from '@/pages/Dashboard';
import PitchView from './PitchView';
import ConvocationWizard from './ConvocationWizard';
import { Calendar, CalendarDays, Plus, Check, X, Trash2, Clock, Shield, Send, ChevronDown, ChevronUp, UserCheck, UserX, Pencil, Bell, MapPin, ExternalLink, ClipboardCheck, Coins, ArrowLeft, Users, Dumbbell, Trophy, ChevronRight, Timer, User, Download, Archive, Search, MessageSquare, Briefcase, Baby, Frown, HeartPulse, PenLine } from 'lucide-react';
import { exportMatchSheet } from '@/lib/pdfExport';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import RoleBadge from '@/components/ui/role-badge';
import { getNowParis, isEventTerminatedParis } from '@/lib/dateUtils';

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
  togglePresence: (eventId: string, playerId: string, status: string, absenceReason?: string) => void;
  deleteEvent: (eventId: string) => void;
  canDeleteEvent: (event: Event) => boolean;
  onAddEvent: () => void;
  onPublishAndNotifyConvocations: (eventId: string, event: Event, convocations: Record<string, Convocation>, customNotif?: { title: string; body: string }) => Promise<void>;
  onSendReminder?: (event: Event) => Promise<void>;
  onResetHeader?: () => void;
  onNavigateToMatchSheet?: (eventId: string) => void;
  initialSelectedEventId?: string | null;
}

const CONVOCATION_STATUSES = [
  { value: 'convoque', label: 'Convoqué', shortLabel: 'Convoqué', activeClass: 'bg-accent text-accent-foreground ring-2 ring-accent/30 shadow-sm', dotClass: 'bg-accent', icon: UserCheck },
  { value: 'non_convoque', label: 'Non convoqué', shortLabel: 'Non convoqué', activeClass: 'bg-destructive text-destructive-foreground ring-2 ring-destructive/30 shadow-sm', dotClass: 'bg-destructive', icon: UserX },
] as const;

const PresencesTab = ({ events, players, members, championships, currentUser, canManage, canCreateEvent, canManageOwnPresence, togglePresence, deleteEvent, canDeleteEvent, onAddEvent, onPublishAndNotifyConvocations, onSendReminder, onResetHeader, onNavigateToMatchSheet, initialSelectedEventId }: Props) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialSelectedEventId || null);
  const [eventFilter, setEventFilter] = useState<'all' | 'match' | 'training'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [convocationMode, setConvocationMode] = useState<string | null>(null);
  const [draftConvocations, setDraftConvocations] = useState<Record<string, Convocation>>({});
  const [expandedConvocations, setExpandedConvocations] = useState<Record<string, boolean>>({});
  const [expandedPlayers, setExpandedPlayers] = useState<Record<string, boolean>>({});
  const [expandedConvocationsEdit, setExpandedConvocationsEdit] = useState<Record<string, boolean>>({});
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [convocationSearch, setConvocationSearch] = useState('');
  const [absenceModal, setAbsenceModal] = useState<{ eventId: string; playerId: string } | null>(null);
  const [absenceReason, setAbsenceReason] = useState('');
  const [absenceOtherText, setAbsenceOtherText] = useState('');

  const ABSENCE_REASONS = [
    { label: 'Travail', icon: Briefcase },
    { label: "Garde d'enfants", icon: Baby },
    { label: 'Pas motivé / pas envie', icon: Frown },
    { label: 'Blessé / malade', icon: HeartPulse },
    { label: 'Autre', icon: PenLine },
  ];
  const [expandedArchiveConvos, setExpandedArchiveConvos] = useState<Record<string, boolean>>({});
  useBodyScrollLock(!!convocationMode || !!absenceModal);

  // React to navigation with a specific event ID
  useEffect(() => {
    if (initialSelectedEventId) {
      setSelectedEventId(initialSelectedEventId);
    }
  }, [initialSelectedEventId]);

  const now = getNowParis();
  const todayStr = now.toLocaleDateString('en-CA');

  // Helper: check if an event is terminated (10 min after start time, Paris TZ)
  const isEventTerminated = (event: Event): boolean => isEventTerminatedParis(event);

  const isManager = canManage();

  // Active events: exclude terminated events
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const activeEvents = events
    .filter(e => !isEventTerminated(e))
    .filter(e => new Date(e.date) >= sevenDaysAgo)
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (a.time) { const [h, m] = a.time.split(':').map(Number); dateA.setHours(h || 0, m || 0); }
      if (b.time) { const [h, m] = b.time.split(':').map(Number); dateB.setHours(h || 0, m || 0); }
      return dateA.getTime() - dateB.getTime();
    });

  // Archived events (terminated — both matches and trainings)
  const archivedEvents = events
    .filter(e => isEventTerminated(e))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // newest first

  const [archiveFilter, setArchiveFilter] = useState<'all' | 'match' | 'training'>('all');

  const upcomingEvents = showArchived ? archivedEvents : activeEvents;

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

  // Deduplicate players: if two players share the same name (case-insensitive),
  // keep the one linked to a member profile (account), discard the orphan duplicate
  const deduplicatedPlayers = useMemo(() => {
    const memberPlayerIds = new Set(members.filter(m => m.playerId).map(m => m.playerId));
    const seen = new Map<string, Player>();
    for (const p of players) {
      const key = p.name.trim().toLowerCase();
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, p);
      } else {
        // Prefer the one linked to a profile
        const existingLinked = memberPlayerIds.has(existing.id);
        const currentLinked = memberPlayerIds.has(p.id);
        if (currentLinked && !existingLinked) {
          seen.set(key, p);
        }
      }
    }
    return Array.from(seen.values());
  }, [players, members]);

  // Player IDs belonging to dirigeants or community managers — they can see events but not respond
  const nonRespondingPlayerIds = useMemo(() => {
    return new Set(members.filter(m => (m.role === 'dirigeant' || m.role === 'photographe') && m.playerId).map(m => m.playerId!));
  }, [members]);

  const isNonRespondingPlayer = (playerId: string) => nonRespondingPlayerIds.has(playerId);

  const getPlayersForEvent = (_event: Event) => deduplicatedPlayers;

  const startConvocationMode = (eventId: string, event: Event) => {
    setConvocationMode(eventId);
    setPublishError(null);
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

  const publishConvocations = async (eventId: string, convocationsOverride?: Record<string, Convocation>, customNotif?: { title: string; body: string }) => {
    if (publishing) return;
    const event = events.find(e => e.id === eventId);
    if (!event) {
      setPublishError('Événement introuvable');
      return;
    }
    const convsToPublish = convocationsOverride || draftConvocations;
    const convokedCount = Object.values(convsToPublish).filter(c => c.status === 'convoque').length;
    if (convokedCount === 0) {
      setPublishError('Aucun joueur convoqué');
      return;
    }
    setPublishError(null);
    setPublishing(true);
    try {
      // Add a timeout to prevent infinite hang on mobile
      const publishPromise = onPublishAndNotifyConvocations(eventId, event, convsToPublish, customNotif);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Délai dépassé — vérifie ta connexion et réessaie')), 30000)
      );
      await Promise.race([publishPromise, timeoutPromise]);
      setConvocationMode(null);
      setConvocationSearch('');
      setPublishError(null);
    } catch (err: any) {
      const msg = err?.message || 'Échec de la publication';
      setPublishError(msg);
      console.error('Publish convocations error:', err);
    } finally {
      setPublishing(false);
    }
  };

  // ─── DETAIL VIEW ───
  if (selectedEvent) {
    const event = selectedEvent;
    const eventPlayers = getPlayersForEvent(event);
    const respondingPlayers = eventPlayers.filter(p => !isNonRespondingPlayer(p.id));
    const presences = event.presences || {};
    const playerIds = new Set(eventPlayers.map(p => p.id));
    const presentCount = respondingPlayers.filter(p => presences[p.id] === 'present').length;
    const absentCount = respondingPlayers.filter(p => presences[p.id] === 'absent').length;
    const unknownCount = respondingPlayers.length - presentCount - absentCount;
    const isConvocationMode = convocationMode === event.id;
    const isConvocationExpanded = expandedConvocations[event.id];

    return (
      <>
      <div className="space-y-4 animate-fade-in">
        {/* Back button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setSelectedEventId(null); setConvocationMode(null); window.scrollTo(0, 0); onResetHeader?.(); }}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <ArrowLeft size={16} /> Retour aux événements
          </button>
          {canManage() && (
            <button
              onClick={() => exportMatchSheet(event, players, members)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-all"
              title="Exporter feuille de match (PDF)"
            >
              <Download size={13} /> PDF
            </button>
          )}
        </div>

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
                <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-2">{event.title}</h3>
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

        {/* Reminder button - only for managers, non-past events, hide when convocations published */}
        {!isEventPast(event) && canManage() && !event.convocationsPublished && unknownCount > 0 && onSendReminder && (
          <button
            onClick={async () => {
              setSendingReminder(true);
              try { await onSendReminder(event); } catch {}
              setSendingReminder(false);
            }}
            disabled={sendingReminder}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-warning/10 text-warning hover:bg-warning/20 text-sm font-semibold transition-all disabled:opacity-50 border border-warning/20"
          >
            {sendingReminder ? (
              <span className="animate-pulse">Envoi du rappel…</span>
            ) : (
              <><Bell size={14} /> Envoyer un rappel ({unknownCount} en attente)</>
            )}
          </button>
        )}

        {event.convocationsPublished && event.convocations && !isConvocationMode && (
          <div className="bg-card border border-border rounded-2xl p-3 shadow-sm">
            <button
              onClick={() => setExpandedConvocations(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
              className="flex items-center gap-2 text-sm font-semibold text-foreground w-full"
            >
              <Shield size={16} className="text-accent" />
              Convocations publiées
              {isConvocationExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {isConvocationExpanded && (
              <div className="space-y-1.5 mt-3 animate-fade-in">
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
                    <button onClick={() => {
                      void publishConvocations(event.id, event.convocations || {});
                    }} disabled={publishing} className="flex-1 flex items-center justify-center gap-2 text-sm text-primary bg-primary/10 hover:bg-primary/20 font-semibold py-2 rounded-lg transition-colors disabled:opacity-50" title="Re-notifier les joueurs convoqués">
                      <Bell size={14} /> {publishing ? 'Envoi…' : 'Re-notifier'}
                    </button>
                  </div>
                )}
                {onNavigateToMatchSheet && (
                  <button
                    onClick={() => onNavigateToMatchSheet(event.id)}
                    className="w-full flex items-center justify-center gap-2 text-sm text-primary bg-primary/10 hover:bg-primary/20 font-semibold py-2 rounded-lg transition-colors mt-2 border border-primary/20"
                  >
                    <ExternalLink size={14} /> Voir la feuille de match
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {/* Convocation button - for match events */}
        {event.type === 'match' && !isEventPast(event) && !event.convocationsPublished && canManage() && (
            <button onClick={() => startConvocationMode(event.id, event)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 text-sm font-semibold transition-all border border-accent/20">
              <Shield size={14} /> Gérer les convocations
            </button>
        )}

        {/* Past event banner */}
        {isEventPast(event) && (
          <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 ${isManager ? 'bg-accent/5 border-accent/20' : 'bg-muted/60 border-border'}`}>
            {isManager ? <Pencil size={14} className="text-accent shrink-0" /> : <Clock size={14} className="text-muted-foreground shrink-0" />}
            <span className={`text-xs font-semibold ${isManager ? 'text-accent' : 'text-muted-foreground'}`}>
              {isManager ? 'Événement terminé — vous pouvez corriger les réponses' : 'Événement terminé — les réponses sont verrouillées'}
            </span>
          </div>
        )}

        {/* Presences list */}
        {!isConvocationMode && (
          <div className="bg-card border border-border rounded-2xl p-3 shadow-sm">
            <h4 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <Users size={15} className="text-primary" /> Réponses des joueurs
            </h4>

            {/* Status filter tabs */}
            {(() => {
              const presentPlayers = eventPlayers.filter(p => presences[p.id] === 'present');
              const absentPlayers = eventPlayers.filter(p => presences[p.id] === 'absent');
              const waitingPlayers = eventPlayers.filter(p => !presences[p.id] || (presences[p.id] !== 'present' && presences[p.id] !== 'absent'));

              const convoEntries = event.convocationsPublished && event.convocations ? Object.values(event.convocations as Record<string, any>) : [];
              const convokedPlayerIds = convoEntries.filter((c: any) => c.status === 'convoque').map((c: any) => c.playerId);
              const convokedPlayers = eventPlayers.filter(p => convokedPlayerIds.includes(p.id));

              const tabs: { key: string; label: string; count: number; icon: any; color: string; bgActive: string; dot: string }[] = [
                { key: 'present', label: 'Présents', count: presentPlayers.length, icon: Check, color: 'text-accent', bgActive: 'bg-accent/15 border-accent/30', dot: 'bg-accent' },
                { key: 'absent', label: 'Absents', count: absentPlayers.length, icon: X, color: 'text-destructive', bgActive: 'bg-destructive/15 border-destructive/30', dot: 'bg-destructive' },
                { key: 'waiting', label: 'En attente', count: waitingPlayers.length, icon: Clock, color: 'text-warning', bgActive: 'bg-warning/15 border-warning/30', dot: 'bg-warning' },
              ];
              if (convokedPlayers.length > 0) {
                tabs.push({ key: 'convoked', label: 'Convoqués', count: convokedPlayers.length, icon: ClipboardCheck, color: 'text-primary', bgActive: 'bg-primary/15 border-primary/30', dot: 'bg-primary' });
              }

              const presenceFilter = expandedPlayers[`filter_${event.id}`] as unknown as string || 'present';
              const setPresenceFilter = (f: string) => setExpandedPlayers(prev => ({ ...prev, [`filter_${event.id}`]: f as any }));

              const filteredPlayers = presenceFilter === 'present' ? presentPlayers
                : presenceFilter === 'absent' ? absentPlayers
                : presenceFilter === 'convoked' ? convokedPlayers
                : waitingPlayers;

              return (
                <>
                  <div className="flex gap-1.5 mb-3">
                    {tabs.map(tab => {
                      const isActive = presenceFilter === tab.key;
                      const TabIcon = tab.icon;
                      return (
                        <motion.button
                          key={tab.key}
                          onClick={() => setPresenceFilter(tab.key)}
                          whileTap={{ scale: 0.95 }}
                          className={`flex-1 flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all border ${
                            isActive
                              ? `${tab.bgActive} ${tab.color}`
                              : 'border-transparent bg-secondary/40 text-muted-foreground hover:bg-secondary/60'
                          }`}
                        >
                          <TabIcon size={12} />
                          <span className="truncate">{tab.label}</span>
                          <span className={`text-[9px] font-black px-1 py-0.5 rounded-md min-w-[16px] text-center ${
                            isActive ? `${tab.dot}/20 ${tab.color}` : 'bg-muted text-muted-foreground'
                          }`}>{tab.count}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="space-y-1.5">
                    {filteredPlayers.length === 0 ? (
                      <p className="text-muted-foreground text-center py-6 text-sm">
                        {presenceFilter === 'present' ? 'Aucun joueur présent' : presenceFilter === 'absent' ? 'Aucun joueur absent' : presenceFilter === 'convoked' ? 'Aucun joueur convoqué' : 'Aucun joueur en attente'}
                      </p>
                    ) : (
                      filteredPlayers.map(player => {
                        const status = presences[player.id];
                        const absReason = event.absenceReasons?.[player.id];
                        const canSeeReason = absReason && status === 'absent' && (
                          isManager || currentUser?.playerId === player.id
                        );
                        return (
                          <div key={player.id} className="space-y-0">
                            <div className="flex items-center justify-between p-2 sm:p-2.5 bg-secondary/40 rounded-xl gap-2">
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
                                {presenceFilter === 'convoked' && (() => {
                                  const convo = event.convocations ? Object.values(event.convocations as Record<string, any>).find((c: any) => c.playerId === player.id) : null;
                                  return convo?.number ? <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md shrink-0">#{convo.number}</span> : null;
                                })()}
                              </div>
                              {isNonRespondingPlayer(player.id) ? (
                                <span className="px-2.5 h-8 rounded-lg text-[10px] font-medium flex items-center gap-1 shrink-0 bg-muted/50 text-muted-foreground/50 italic">
                                  Non concerné
                                </span>
                              ) : (canManageOwnPresence(player.id) && !event.convocationsPublished) || isManager ? (
                                <div className="flex gap-1 shrink-0">
                                  <div className="relative overflow-visible">
                                    <motion.button
                                      onClick={() => {
                                        const locked = event.convocationsPublished || isEventPast(event);
                                        if (!locked || isManager) togglePresence(event.id, player.id, 'present');
                                      }}
                                      disabled={(event.convocationsPublished || isEventPast(event)) && !isManager}
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
                                      onClick={() => {
                                        const locked = event.convocationsPublished || isEventPast(event);
                                        if (locked && !isManager) return;
                                        const alreadyAbsent = status === 'absent';
                                        if (alreadyAbsent) {
                                          togglePresence(event.id, player.id, 'absent');
                                        } else {
                                          setAbsenceModal({ eventId: event.id, playerId: player.id });
                                          setAbsenceReason('');
                                          setAbsenceOtherText('');
                                        }
                                      }}
                                      disabled={(event.convocationsPublished || isEventPast(event)) && !isManager}
                                      whileTap={((event.convocationsPublished || isEventPast(event)) && !isManager) ? {} : { scale: 0.82 }}
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
                            {canSeeReason && (
                              <div className="flex items-start gap-1.5 px-3 py-1.5 ml-9">
                                <MessageSquare size={11} className="text-destructive/50 shrink-0 mt-0.5" />
                                <span className="text-[11px] text-destructive/70 italic leading-snug">« {absReason} »</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}


        {/* Full-screen convocation wizard */}
        <AnimatePresence>
          {isConvocationMode && (
            <ConvocationWizard
              event={event}
              players={eventPlayers}
              members={members}
              draftConvocations={draftConvocations}
              updateDraft={updateDraft}
              setDraftConvocations={setDraftConvocations}
              onPublish={(customNotif) => void publishConvocations(event.id, undefined, customNotif)}
              onCancel={() => { setConvocationMode(null); setConvocationSearch(''); setPublishError(null); }}
              publishing={publishing}
              publishError={publishError}
            />
          )}
        </AnimatePresence>

      </div>
      {/* Absence Reason Modal (detail view) */}
      <AnimatePresence>
        {absenceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[70]"
            onClick={() => setAbsenceModal(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm border border-border shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
                    <MessageSquare size={20} className="text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Signaler une absence</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Visible uniquement par le staff</p>
                  </div>
                </div>
                <button onClick={() => setAbsenceModal(null)} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Choisis une raison <span className="text-destructive">*</span></p>
                {ABSENCE_REASONS.map((reason) => (
                  <button
                    key={reason.label}
                    onClick={() => {
                      setAbsenceReason(reason.label);
                      if (reason.label !== 'Autre') setAbsenceOtherText('');
                    }}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium transition-all text-left ${
                      absenceReason === reason.label
                        ? 'border-destructive bg-destructive/10 text-foreground ring-2 ring-destructive/30'
                        : 'border-border bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    <reason.icon size={18} className={absenceReason === reason.label ? 'text-destructive' : 'text-muted-foreground'} />
                    <span>{reason.label}</span>
                    {absenceReason === reason.label && (
                      <Check size={16} className="ml-auto text-destructive" />
                    )}
                  </button>
                ))}
                {absenceReason === 'Autre' && (
                  <textarea
                    placeholder="Précise ta raison…"
                    className="w-full mt-2 p-3.5 bg-secondary border border-border rounded-xl h-20 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive/30 text-sm resize-none transition-all"
                    value={absenceOtherText}
                    onChange={(e) => setAbsenceOtherText(e.target.value)}
                    maxLength={200}
                    autoFocus
                  />
                )}
              </div>
              <div className="p-5 border-t border-border">
                <button
                  disabled={!absenceReason || (absenceReason === 'Autre' && !absenceOtherText.trim())}
                  onClick={() => {
                    const finalReason = absenceReason === 'Autre' ? absenceOtherText.trim() : absenceReason;
                    togglePresence(absenceModal.eventId, absenceModal.playerId, 'absent', finalReason);
                    setAbsenceModal(null);
                  }}
                  className="w-full py-3.5 bg-destructive text-destructive-foreground rounded-xl font-semibold hover:brightness-110 transition-all text-sm shadow-lg shadow-destructive/20 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Confirmer l'absence
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
    );
  }

  // ─── LIST VIEW (cards) ───
  return (
    <>
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${showArchived ? 'bg-muted' : 'bg-accent/20'}`}>
            {showArchived ? <Archive className="text-muted-foreground" size={18} /> : <ClipboardCheck className="text-accent" size={18} />}
          </div>
          <h2 className="text-lg font-bold text-foreground">{showArchived ? 'Archives de présence' : 'Gestion des présences'}</h2>
        </div>
        {!showArchived && canCreateEvent() && (
          <button onClick={onAddEvent} className="bg-primary text-primary-foreground px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-primary/90 transition-all text-xs font-medium">
            <Plus size={16} /> Événement
          </button>
        )}
      </div>

      {/* Native-feel segmented filter */}
      {!showArchived && (
        <div className="bg-secondary/60 backdrop-blur-sm p-1.5 rounded-2xl border border-border/50 flex gap-1">
          {([
            { key: 'all' as const, label: 'Tous', icon: Calendar, count: activeEvents.length },
            { key: 'match' as const, label: 'Matchs', icon: Trophy, count: activeEvents.filter(e => e.type === 'match').length },
            { key: 'training' as const, label: 'Entraîn.', icon: Dumbbell, count: activeEvents.filter(e => e.type === 'training').length },
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
      )}

      {/* Archive toggle for managers */}
      {isManager && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowArchived(!showArchived); setArchiveSearch(''); setArchiveFilter('all'); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                showArchived
                  ? 'bg-muted text-foreground border border-border'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <Archive size={13} />
              {showArchived ? 'Retour aux événements' : `Archives (${archivedEvents.length})`}
            </button>
            {showArchived && (
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Rechercher…"
                  value={archiveSearch}
                  onChange={e => setArchiveSearch(e.target.value)}
                  className="w-full h-9 bg-secondary/60 border border-border/60 rounded-xl pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/50"
                  style={{ fontSize: 16 }}
                />
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              </div>
            )}
          </div>
          {showArchived && (
            <div className="bg-secondary/60 backdrop-blur-sm p-1 rounded-xl border border-border/50 flex gap-1">
              {([
                { key: 'all' as const, label: 'Tous', icon: Calendar, count: archivedEvents.length },
                { key: 'match' as const, label: 'Matchs', icon: Trophy, count: archivedEvents.filter(e => e.type === 'match').length },
                { key: 'training' as const, label: 'Entraîn.', icon: Dumbbell, count: archivedEvents.filter(e => e.type === 'training').length },
              ]).map(tab => {
                const isActive = archiveFilter === tab.key;
                const TabIcon = tab.icon;
                return (
                  <motion.button
                    key={tab.key}
                    onClick={() => setArchiveFilter(tab.key)}
                    whileTap={{ scale: 0.97 }}
                    className={`relative flex-1 flex items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] font-bold transition-colors overflow-hidden ${
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="archive-filter-pill"
                        className="absolute inset-0 bg-card rounded-lg shadow-sm border border-border/60"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative flex items-center gap-1 min-w-0">
                      <TabIcon size={11} className="shrink-0" />
                      <span className="truncate">{tab.label}</span>
                      <span className={`text-[9px] font-black px-1 py-0.5 rounded-md min-w-[16px] text-center shrink-0 ${
                        isActive ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
                      }`}>{tab.count}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(() => {
        let filteredEvents: Event[];
        if (showArchived) {
          let archiveList = archiveFilter === 'all' ? archivedEvents : archivedEvents.filter(e => e.type === archiveFilter);
          const search = archiveSearch.toLowerCase().trim();
          filteredEvents = search
            ? archiveList.filter(e => e.title.toLowerCase().includes(search) || e.date.includes(search) || e.location?.toLowerCase().includes(search))
            : archiveList;
        } else {
          filteredEvents = eventFilter === 'all'
            ? upcomingEvents
            : upcomingEvents.filter(e => e.type === eventFilter);
        }

        return filteredEvents.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            {showArchived ? <Archive className="mx-auto mb-3 text-muted-foreground" size={48} /> : <Calendar className="mx-auto mb-3 text-muted-foreground" size={48} />}
            <p className="text-muted-foreground font-medium">
              {showArchived
                ? (archiveSearch ? 'Aucun événement trouvé' : 'Aucun événement archivé')
                : eventFilter === 'all' ? 'Aucun événement à venir' : eventFilter === 'match' ? 'Aucun match à venir' : 'Aucun entraînement à venir'}
            </p>
            {!showArchived && canManage() && <p className="text-sm text-muted-foreground/70 mt-2">Cliquez sur "+ Événement" pour en créer un</p>}
          </div>
        ) : (
        <div className="space-y-4 max-w-3xl mx-auto">
          {(() => {
            const renderCard = (event: Event) => {
              const presences = event.presences || {};
              const cardRespondingPlayers = deduplicatedPlayers.filter(p => !isNonRespondingPlayer(p.id));
              const presentCount = cardRespondingPlayers.filter(p => presences[p.id] === 'present').length;
              const absentCount = cardRespondingPlayers.filter(p => presences[p.id] === 'absent').length;
              const pendingCount = cardRespondingPlayers.length - presentCount - absentCount;
              const isPast = isEventPast(event);
              const isArchived = showArchived && isEventTerminated(event);
              const matchInfo = getMatchLogos(event);
              const isMatch = !!matchInfo;

              return (
                <div key={event.id}>
                  <div className="flex items-center gap-3 my-1">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                    <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest shrink-0">
                      {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {isArchived && <span className="ml-1.5 text-muted-foreground/40">• Archivé</span>}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
              <div
                className={`relative bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-all ${(isPast || isArchived) ? 'opacity-50 grayscale-[30%]' : 'active:shadow-md hover:shadow-lg hover:border-border/80'}`}
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
                        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                          {matchInfo.homeLogo ? (
                            <img src={matchInfo.homeLogo} alt="" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-contain bg-secondary/50 p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-secondary flex items-center justify-center">
                              <Shield size={22} className="text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-xs font-bold text-foreground text-center leading-tight line-clamp-2">{matchInfo.homeName}</span>
                        </div>
                        <div className="flex flex-col items-center shrink-0">
                          <span className="text-2xl font-black text-accent drop-shadow-sm">VS</span>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
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
                      <div className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          {event.location ? (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate flex-1 mr-2 uppercase font-semibold tracking-wide">
                              <MapPin size={10} className="shrink-0 text-accent/60" /> {event.location}
                            </p>
                          ) : <div />}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-accent"><Check size={10} /> {presentCount}</span>
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-destructive"><X size={10} /> {absentCount}</span>
                            {pendingCount > 0 && <span className="flex items-center gap-0.5 text-[10px] font-bold text-warning"><Clock size={10} /> {pendingCount}</span>}
                          </div>
                        </div>
                        {event.createdByName && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User size={9} className="shrink-0" /> {event.createdByName}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${event.type === 'training' ? 'bg-purple-100 text-purple-700' : 'bg-accent/10 text-accent'}`}>
                            {event.type === 'training' ? 'Entraînement' : 'Autre'}
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground capitalize">
                            {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {event.time && (
                            <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg shadow-sm ${event.type === 'training' ? 'bg-purple-600 text-white shadow-purple-600/30' : 'bg-muted text-foreground'}`}>{event.time}</span>
                          )}
                          <ChevronRight size={16} className="text-muted-foreground/40" />
                        </div>
                      </div>
                      <div className="flex items-center justify-center py-2 min-h-[88px]">
                        <div className="flex flex-col items-center gap-2">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${event.type === 'training' ? 'bg-purple-500/10' : 'bg-muted'}`}>
                            {event.type === 'training' ? <Dumbbell size={28} className="text-purple-600" /> : <Calendar size={28} className="text-muted-foreground" />}
                          </div>
                          <h3 className="font-bold text-sm text-foreground text-center leading-tight line-clamp-2 max-w-[220px]">{event.title}</h3>
                          {event.duration && (
                            <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><Timer size={10} className="shrink-0" /> {event.duration} min</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          {event.location ? (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate flex-1 mr-2 uppercase font-semibold tracking-wide">
                              <MapPin size={10} className="shrink-0 text-accent/60" /> {event.location}
                            </p>
                          ) : <div />}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-accent"><Check size={10} /> {presentCount}</span>
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-destructive"><X size={10} /> {absentCount}</span>
                            {pendingCount > 0 && <span className="flex items-center gap-0.5 text-[10px] font-bold text-warning"><Clock size={10} /> {pendingCount}</span>}
                          </div>
                        </div>
                        {event.createdByName && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User size={9} className="shrink-0" /> {event.createdByName}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {!isPast && !isArchived && (
                    <div className="px-3.5 pb-1.5 mt-1">
                      <p className="text-[9px] text-muted-foreground/50 text-center">Appuyez pour voir plus de détails sur l'événement</p>
                    </div>
                  )}
                  {(isPast || isArchived) && (
                    <div className="mx-3.5 mb-2 -mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[9px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Clock size={8} /> Terminé</span>
                      {(() => {
                        const presences = event.presences || {};
                        const pCount = Object.values(presences).filter(s => s === 'present').length;
                        const aCount = Object.values(presences).filter(s => s === 'absent').length;
                        const convos = event.convocations ? Object.keys(event.convocations as Record<string, any>).length : 0;
                        return (
                          <>
                            {pCount > 0 && <span className="text-[9px] font-semibold bg-accent/10 text-accent px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"><Check size={8} /> {pCount}</span>}
                            {aCount > 0 && <span className="text-[9px] font-semibold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"><X size={8} /> {aCount}</span>}
                            {convos > 0 && <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"><ClipboardCheck size={8} /> {convos}</span>}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </button>

                {!isPast && !isArchived && currentUser?.playerId && (() => {
                  if (event.convocationsPublished) {
                    const isConvoked = event.convocations && Object.keys(event.convocations).length > 0 && Object.values(event.convocations as Record<string, any>).some((c: any) => c.playerId === currentUser.playerId);
                    return (
                      <div className="px-3.5 pb-2.5 space-y-1.5">
                        <div className="flex items-center justify-center">
                          <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 ${isConvoked ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}`}>
                            {isConvoked ? <><Check size={12} /> Convoqué</> : <><ClipboardCheck size={12} /> Convocations publiées</>}
                          </span>
                        </div>
                        {onNavigateToMatchSheet && event.type === 'match' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onNavigateToMatchSheet(event.id); }}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                          >
                            <ExternalLink size={11} /> Voir la feuille de match
                          </button>
                        )}
                      </div>
                    );
                  }
                  const isNonResponding = currentUser.role === 'dirigeant' || currentUser.role === 'photographe';
                  if (isNonResponding) {
                    return (
                      <div className="flex items-center justify-center px-3.5 pb-2.5">
                        <span className="text-[10px] italic text-muted-foreground/50">Non concerné par les présences</span>
                      </div>
                    );
                  }
                  const myStatus = (event.presences || {})[currentUser.playerId!];
                  return (
                    <div className="flex items-center gap-1.5 px-3.5 pb-2.5">
                      <div className="relative flex-1 overflow-visible">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          animate={myStatus === 'present' ? { scale: [1, 1.15, 0.95, 1.05, 1] } : { scale: 1 }}
                          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                          onClick={(e) => { e.stopPropagation(); togglePresence(event.id, currentUser.playerId!, 'present'); }}
                          className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold transition-all ${myStatus === 'present' ? 'bg-accent text-accent-foreground shadow-sm shadow-accent/30' : 'bg-secondary border border-border text-muted-foreground hover:border-accent/50'}`}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            if (myStatus === 'absent') {
                              togglePresence(event.id, currentUser.playerId!, 'absent');
                            } else {
                              setAbsenceModal({ eventId: event.id, playerId: currentUser.playerId! });
                              setAbsenceReason('');
                              setAbsenceOtherText('');
                            }
                          }}
                          className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold transition-all ${myStatus === 'absent' ? 'bg-destructive text-destructive-foreground shadow-sm shadow-destructive/30' : 'bg-secondary border border-border text-muted-foreground hover:border-destructive/50'}`}
                        >
                          <X size={12} /> Absent
                        </motion.button>
                        <AnimatePresence>
                          {myStatus === 'absent' && (
                            <>
                              <motion.span key={`qa1-${event.id}`} initial={{ opacity: 1, y: 0, scale: 0.8 }} animate={{ opacity: 0, y: -28, x: -6, scale: 1.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-destructive font-black text-sm">✕</motion.span>
                              <motion.span key={`qa2-${event.id}`} initial={{ opacity: 0.8, y: 0, scale: 0.5 }} animate={{ opacity: 0, y: -22, x: 8, scale: 1.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-destructive font-black text-[10px]">✕</motion.span>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })()}

                {!isArchived && canDeleteEvent(event) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-all z-10"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
                </div>
              );
            };

            // When "all" is selected, show all events in chronological order (already sorted)
            if (eventFilter === 'all') {
              return filteredEvents.map(renderCard);
            }

            // Filtered: simple list
            return filteredEvents.map(renderCard);
          })()}
        </div>
        );
      })()}
    </div>

      {/* Absence Reason Modal */}
      <AnimatePresence>
        {absenceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[70]"
            onClick={() => setAbsenceModal(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm border border-border shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
                    <MessageSquare size={20} className="text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Signaler une absence</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Visible uniquement par le staff</p>
                  </div>
                </div>
                <button onClick={() => setAbsenceModal(null)} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              <div className="p-5 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Choisis une raison <span className="text-destructive">*</span></p>
                {ABSENCE_REASONS.map((reason) => (
                  <button
                    key={reason.label}
                    onClick={() => {
                      setAbsenceReason(reason.label);
                      if (reason.label !== 'Autre') setAbsenceOtherText('');
                    }}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium transition-all text-left ${
                      absenceReason === reason.label
                        ? 'border-destructive bg-destructive/10 text-foreground ring-2 ring-destructive/30'
                        : 'border-border bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    <reason.icon size={18} className={absenceReason === reason.label ? 'text-destructive' : 'text-muted-foreground'} />
                    <span>{reason.label}</span>
                    {absenceReason === reason.label && (
                      <Check size={16} className="ml-auto text-destructive" />
                    )}
                  </button>
                ))}
                {absenceReason === 'Autre' && (
                  <textarea
                    placeholder="Précise ta raison…"
                    className="w-full mt-2 p-3.5 bg-secondary border border-border rounded-xl h-20 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive/30 text-sm resize-none transition-all"
                    value={absenceOtherText}
                    onChange={(e) => setAbsenceOtherText(e.target.value)}
                    maxLength={200}
                    autoFocus
                  />
                )}
              </div>
              <div className="p-5 border-t border-border">
                <button
                  disabled={!absenceReason || (absenceReason === 'Autre' && !absenceOtherText.trim())}
                  onClick={() => {
                    const finalReason = absenceReason === 'Autre' ? absenceOtherText.trim() : absenceReason;
                    togglePresence(absenceModal.eventId, absenceModal.playerId, 'absent', finalReason);
                    setAbsenceModal(null);
                  }}
                  className="w-full py-3.5 bg-destructive text-destructive-foreground rounded-xl font-semibold hover:brightness-110 transition-all text-sm shadow-lg shadow-destructive/20 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Confirmer l'absence
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PresencesTab;
