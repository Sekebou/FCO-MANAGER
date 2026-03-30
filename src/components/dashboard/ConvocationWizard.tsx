import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Player, Member, Convocation } from '@/pages/Dashboard';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { getOisemontDisplayName } from '@/lib/fffApi';
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
    team?: string;
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
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Track visual viewport to adapt to virtual keyboard
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const nextViewportHeight = vv.height;
      setViewportHeight(nextViewportHeight);

      // iOS keyboard inset (layout viewport - visual viewport)
      const inset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      setKeyboardInset(inset);

      // Keyboard detection (more reliable on iOS + Android)
      const isKb = inset > 80 || vv.height < window.innerHeight * 0.82;
      setKeyboardOpen(isKb);
    };

    onResize();
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);

    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);
...
      {/* Player grid */}
      <div
        ref={gridScrollRef}
        className="flex-1 overflow-y-auto px-4 pb-2"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollPaddingBottom: keyboardOpen ? '9rem' : '0px',
          paddingBottom: keyboardOpen ? '9rem' : undefined,
        }}
      >
        <div className="grid grid-cols-2 gap-2 py-1 pb-4">
...
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-foreground/60 backdrop-blur-md z-[70] flex justify-center items-end"
      style={{ paddingBottom: keyboardInset ? `${keyboardInset}px` : undefined }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-card w-full border-x border-border shadow-2xl flex flex-col rounded-t-3xl border-t"
        style={{ maxHeight: viewportHeight ? `${Math.max(360, viewportHeight * 0.98)}px` : '92vh' }}
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
                  onPublish({ title: customNotifTitle.trim(), body: customNotifBody.trim() });
                }}
                disabled={publishing || !canPublish}
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
