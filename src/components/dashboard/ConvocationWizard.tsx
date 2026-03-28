import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Player, Member, Convocation } from '@/pages/Dashboard';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import {
  Shield, X, Search, Check, UserCheck, UserX, ChevronRight, ChevronLeft,
  Send, Users, Trophy, MapPin, Clock, Bell, ClipboardList, Hash, MessageSquare, Sparkles
} from 'lucide-react';

interface Props {
  event: {
    id: string;
    title: string;
    date: string;
    time?: string;
    location?: string;
    type: string;
    presences?: Record<string, string>;
    convocations?: Record<string, Convocation>;
    homeLogo?: string;
    awayLogo?: string;
  };
  players: Player[];
  members: Member[];
  draftConvocations: Record<string, Convocation>;
  updateDraft: (playerId: string, updates: Partial<Convocation>) => void;
  setDraftConvocations: React.Dispatch<React.SetStateAction<Record<string, Convocation>>>;
  onPublish: (customNotif?: { title: string; body: string }) => void;
  onCancel: () => void;
  publishing: boolean;
  publishError: string | null;
}

const STEPS = [
  { num: 1, label: 'Sélection', icon: Users },
  { num: 2, label: 'Numéros', icon: Hash },
  { num: 3, label: 'Validation', icon: ClipboardList },
  { num: 4, label: 'Notification', icon: Bell },
];

const ConvocationWizard: React.FC<Props> = ({
  event, players, members, draftConvocations, updateDraft, setDraftConvocations,
  onPublish, onCancel, publishing, publishError,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [search, setSearch] = useState('');
  useBodyScrollLock(true);
  const [showNonConvoked, setShowNonConvoked] = useState(false);
  const notifMode = 'custom';
  const [customNotifTitle, setCustomNotifTitle] = useState('');
  const [customNotifBody, setCustomNotifBody] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const getPlayerPhoto = (playerId: string) => {
    const member = members.find(m => m.playerId === playerId);
    return member?.photoURL;
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const selectedIds = useMemo(
    () => Object.entries(draftConvocations).filter(([, c]) => c.status === 'convoque').map(([id]) => id),
    [draftConvocations]
  );

  const selectedPlayers = useMemo(
    () => players.filter(p => selectedIds.includes(p.id)),
    [players, selectedIds]
  );

  const nonSelectedPlayers = useMemo(
    () => players.filter(p => !selectedIds.includes(p.id)),
    [players, selectedIds]
  );

  // Filter & sort players: present first, then absent, then no response
  const filteredPlayers = useMemo(() => {
    const s = search.toLowerCase().trim();
    let list = s ? players.filter(p => p.name.toLowerCase().includes(s)) : [...players];
    const order = (id: string) => {
      const status = event.presences?.[id];
      if (status === 'present') return 0;
      if (status === 'absent') return 2;
      return 1;
    };
    list.sort((a, b) => order(a.id) - order(b.id));
    return list;
  }, [players, search, event.presences]);

  const togglePlayer = (playerId: string) => {
    const current = draftConvocations[playerId];
    if (current?.status === 'convoque') {
      // Deselect: remove from draft
      setDraftConvocations(prev => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
    } else {
      updateDraft(playerId, { status: 'convoque' });
    }
  };

  const allHaveNumbers = selectedPlayers.every(p => draftConvocations[p.id]?.number);
  const canGoNext = step === 1 ? selectedIds.length > 0 : step === 2 ? allHaveNumbers : true;

  // Default notification preview
  const eventDateFormatted = new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const defaultNotifTitle = '✅ Convocation';
  const defaultNotifBody = `Tu es convoqué pour ${event.title} le ${eventDateFormatted}${event.time ? ' à ' + event.time : ''} ! Consulte les détails sur l'app.`;

  // ─── STEP 1: Player Selection ───
  const renderStep1 = () => (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher un joueur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 bg-secondary/60 border border-border/60 rounded-xl pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/50"
            style={{ fontSize: 16 }}
          />
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <X size={12} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Player grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="grid grid-cols-2 gap-2 py-1">
          {filteredPlayers.map(player => {
            const isSelected = selectedIds.includes(player.id);
            const photo = getPlayerPhoto(player.id);
            const presenceStatus = event.presences?.[player.id];
            return (
              <motion.button
                key={player.id}
                onClick={() => togglePlayer(player.id)}
                whileTap={{ scale: 0.95 }}
                className={`relative overflow-hidden flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? 'border-accent bg-accent/10 shadow-md shadow-accent/10'
                    : 'border-transparent bg-secondary/40 hover:bg-secondary/60'
                }`}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-1.5 right-1.5 w-5 h-5 bg-accent rounded-full flex items-center justify-center"
                  >
                    <Check size={12} className="text-accent-foreground" strokeWidth={3} />
                  </motion.div>
                )}

                {/* Avatar */}
                {photo ? (
                  <img
                    src={photo}
                    alt={player.name}
                    className={`w-12 h-12 rounded-full object-cover ${isSelected ? 'ring-2 ring-accent' : 'opacity-70'}`}
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isSelected ? 'bg-accent/20 ring-2 ring-accent' : 'bg-muted opacity-70'
                  }`}>
                    <span className={`text-sm font-bold ${isSelected ? 'text-accent' : 'text-muted-foreground'}`}>
                      {getInitials(player.name)}
                    </span>
                  </div>
                )}

                {/* Name */}
                <span className={`text-xs font-semibold text-center leading-tight line-clamp-2 ${
                  isSelected ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {player.name}
                </span>

                {/* Position + presence badge */}
                <div className="flex flex-col items-center gap-0.5">
                  {player.position && (
                    <span className="text-[10px] text-muted-foreground/70">{player.position}</span>
                  )}
                  {presenceStatus === 'present' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-[9px] font-bold">
                      <Check size={8} strokeWidth={3} /> A répondu présent
                    </span>
                  )}
                  {presenceStatus === 'absent' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-[9px] font-bold">
                      <UserX size={8} /> A répondu absent
                    </span>
                  )}
                  {!presenceStatus && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-500 text-[9px] font-bold">
                      En attente de réponse
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── STEP 2: Number Assignment ───

  const renderStep2 = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2 shrink-0">
        <p className="text-sm font-semibold text-foreground">
          Attribuez un numéro de maillot à chaque joueur
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Obligatoire pour la création de la feuille de match
        </p>
        {!allHaveNumbers && (
          <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <span className="text-orange-500 text-[10px] font-bold">⚠ {selectedPlayers.filter(p => !draftConvocations[p.id]?.number).length} joueur(s) sans numéro</span>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2.5 py-2">
        {selectedPlayers.map((player, idx) => {
          const photo = getPlayerPhoto(player.id);
          const conv = draftConvocations[player.id];
          const hasNumber = !!conv?.number;
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                hasNumber
                  ? 'bg-accent/5 border-accent/30'
                  : 'bg-secondary/40 border-border/50'
              }`}
            >
              {/* Rank */}
              <span className="text-[11px] font-bold text-muted-foreground/50 w-4 text-center shrink-0">
                {idx + 1}
              </span>

              {/* Avatar */}
              {photo ? (
                <img src={photo} alt={player.name} className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-border" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-accent/15 flex items-center justify-center shrink-0 ring-2 ring-border">
                  <span className="text-accent text-xs font-bold">{getInitials(player.name)}</span>
                </div>
              )}

              {/* Name + position */}
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-foreground block truncate">{player.name}</span>
                {player.position && (
                  <span className="text-[10px] text-muted-foreground/70">{player.position}</span>
                )}
              </div>

              {/* Number input — large, prominent */}
              <div className="shrink-0 flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">N°</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={conv?.number || ''}
                  onChange={e => {
                    const num = e.target.value ? parseInt(e.target.value) : undefined;
                    updateDraft(player.id, { number: num });
                  }}
                  className={`w-14 h-12 text-center text-xl font-black rounded-xl border-2 transition-all focus:outline-none ${
                    hasNumber
                      ? 'bg-accent/10 border-accent text-accent focus:border-accent'
                      : 'bg-card border-border text-foreground focus:border-accent'
                  }`}
                  style={{ fontSize: 20 }}
                  min={1}
                  max={99}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  // ─── STEP 3: Review & Confirm ───
  const renderStep3 = () => (
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-4 py-3">
        {/* Match info with logos */}
        <div className="bg-secondary/40 rounded-2xl p-4 border border-border/50 space-y-3">
          <div className="flex items-center justify-center gap-4">
            {event.homeLogo ? (
              <img src={event.homeLogo} alt="Domicile" className="w-10 h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Shield size={18} className="text-accent" />
              </div>
            )}
            <span className="text-xs font-bold text-muted-foreground">VS</span>
            {event.awayLogo ? (
              <img src={event.awayLogo} alt="Extérieur" className="w-10 h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Shield size={18} className="text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="text-center font-bold text-sm text-foreground">{event.title}</p>
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
            <Clock size={12} />
            <span>
              {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {event.time && ` • ${event.time}`}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
              <MapPin size={12} />
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {/* Convoked players */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <UserCheck size={14} className="text-accent" />
            <span className="text-sm font-bold text-foreground">
              {selectedPlayers.length} joueur{selectedPlayers.length > 1 ? 's' : ''} convoqué{selectedPlayers.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1.5">
            {selectedPlayers.map(player => {
              const conv = draftConvocations[player.id];
              const photo = getPlayerPhoto(player.id);
              return (
                <div key={player.id} className="flex items-center gap-3 p-2.5 bg-accent/5 rounded-xl border border-accent/20">
                  {photo ? (
                    <img src={photo} alt={player.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                      <span className="text-accent text-[10px] font-bold">{getInitials(player.name)}</span>
                    </div>
                  )}
                  <span className="font-medium text-sm text-foreground flex-1 truncate">{player.name}</span>
                  {conv?.number && (
                    <span className="text-sm font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-lg">
                      #{conv.number}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Non-convoked collapsible */}
        {nonSelectedPlayers.length > 0 && (
          <div>
            <button
              onClick={() => setShowNonConvoked(!showNonConvoked)}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserX size={13} />
              <span>{nonSelectedPlayers.length} joueur{nonSelectedPlayers.length > 1 ? 's' : ''} non convoqué{nonSelectedPlayers.length > 1 ? 's' : ''}</span>
              <ChevronRight size={12} className={`transition-transform ${showNonConvoked ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
              {showNonConvoked && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 mt-2">
                    {nonSelectedPlayers.map(player => (
                      <div key={player.id} className="flex items-center gap-2 px-2.5 py-1.5 text-muted-foreground/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive/50 shrink-0" />
                        <span className="text-xs">{player.name}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>
  );

  // ─── STEP 4: Notification ───
  const renderStep4 = () => (
    <div className="flex flex-col h-full px-4 py-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <MessageSquare size={18} className="text-accent" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Notification personnalisée</p>
          <p className="text-[11px] text-muted-foreground">
            Envoyée aux {selectedPlayers.length} joueur{selectedPlayers.length > 1 ? 's' : ''} convoqué{selectedPlayers.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Title input */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles size={11} className="text-accent" /> Titre
        </label>
        <input
          type="text"
          value={customNotifTitle}
          onChange={e => setCustomNotifTitle(e.target.value)}
          placeholder="Ex: Convocation importante"
          className="w-full h-9 bg-secondary/60 border border-border/60 rounded-lg px-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
          maxLength={100}
        />
      </div>

      {/* Body input */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
          <Send size={11} className="text-accent" /> Message
        </label>
        <textarea
          value={customNotifBody}
          onChange={e => setCustomNotifBody(e.target.value)}
          placeholder="Ex: Rendez-vous au stade à 13h30, ramenez vos protège-tibias !"
          className="w-full min-h-[70px] bg-secondary/60 border border-border/60 rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 resize-none transition-all"
          maxLength={500}
        />
        <p className="text-[9px] text-muted-foreground/50 text-right">{customNotifBody.length}/500</p>
      </div>

      {/* Live preview */}
      {(customNotifTitle || customNotifBody) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-3 border border-border/50 shadow-sm space-y-1"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Bell size={10} className="text-muted-foreground" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Aperçu notification</span>
          </div>
          <p className="text-xs font-bold text-foreground">{customNotifTitle || defaultNotifTitle}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{customNotifBody || 'Sans message'}</p>
        </motion.div>
      )}

      {/* What will happen */}
      <div className="bg-accent/5 rounded-xl p-3 border border-accent/15 space-y-2">
        <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
          <Bell size={12} className="text-accent" /> Ce qui va se passer
        </p>
        <div className="space-y-1.5 pl-0.5">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Send size={10} className="text-accent shrink-0" />
            <span>Notification push aux {selectedPlayers.length} joueur{selectedPlayers.length > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ClipboardList size={10} className="text-accent shrink-0" />
            <span>Création / mise à jour de la feuille de match</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <UserCheck size={10} className="text-accent shrink-0" />
            <span>Statut visible par les joueurs</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-foreground/60 backdrop-blur-md z-[70] flex items-end justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-card w-full max-h-[92vh] rounded-t-3xl border-t border-x border-border shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with stepper */}
        <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center">
                <Shield size={18} className="text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Convocations</h3>
                <p className="text-[11px] text-muted-foreground">
                  {step === 1 && `${selectedIds.length} sélectionné${selectedIds.length > 1 ? 's' : ''}`}
                  {step === 2 && 'Attribution des numéros'}
                  {step === 3 && 'Vérification finale'}
                  {step === 4 && 'Personnaliser la notification'}
                </p>
              </div>
            </div>
            <button onClick={onCancel} className="w-9 h-9 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center">
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-0.5">
            {STEPS.map((s, i) => {
              const StepIcon = s.icon;
              const isActive = step === s.num;
              const isDone = step > s.num;
              return (
                <React.Fragment key={s.num}>
                  <button
                    onClick={() => {
                      if (isDone) setStep(s.num as 1 | 2 | 3 | 4);
                    }}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : isDone
                          ? 'bg-accent/15 text-accent cursor-pointer'
                          : 'bg-secondary/60 text-muted-foreground/50'
                    }`}
                  >
                    {isDone ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      <StepIcon size={11} />
                    )}
                    <span>{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`w-2 h-0.5 rounded-full shrink-0 ${isDone ? 'bg-accent/40' : 'bg-border'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 border-t border-border shrink-0 space-y-2">
          {publishError && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
              ⚠️ {publishError}
            </p>
          )}
          <div className="flex gap-2">
            {step === 1 ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:bg-secondary/80 transition-all"
              >
                Annuler
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(s => (s - 1) as 1 | 2 | 3 | 4)}
                className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft size={15} /> Retour
              </button>
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(s => (s + 1) as 1 | 2 | 3 | 4)}
                disabled={!canGoNext}
                className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-40"
              >
                Suivant <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (customNotifTitle.trim() || customNotifBody.trim()) {
                    onPublish({ title: customNotifTitle.trim() || defaultNotifTitle, body: customNotifBody.trim() || defaultNotifBody });
                  } else {
                    onPublish();
                  }
                }}
                disabled={publishing || !customNotifBody.trim()}
                className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50"
              >
                {publishing ? (
                  <><span className="animate-spin inline-block w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full" /> Envoi…</>
                ) : (
                  <><Send size={15} /> Publier & Notifier</>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ConvocationWizard;
