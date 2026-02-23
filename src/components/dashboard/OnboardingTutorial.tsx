import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck, 
  ChevronRight, ChevronLeft, X, Smartphone, Hand, Rocket,
  ClipboardCheck, BarChart3, Newspaper, PenLine, CalendarPlus,
  Images, FolderPlus, UserCog, Zap, ArrowDown, Coins, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TutorialStep {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  tabId?: string;
  highlight?: string;
  roles?: string[];
  color: string;
  iconColor: string;
}

const allSteps: TutorialStep[] = [
  {
    icon: Zap,
    title: 'Bienvenue sur',
    subtitle: 'FCO Manager',
    description: 'Quelques étapes pour découvrir ton espace. Ce tutoriel s\'adapte à ton rôle dans le club.',
    color: 'bg-primary/15',
    iconColor: 'text-primary',
  },
  {
    icon: Smartphone,
    title: 'Navigue facilement',
    subtitle: 'La barre de navigation',
    description: 'En bas de l\'écran, plusieurs onglets sont disponibles. Tu peux glisser vers la gauche ou la droite pour tous les découvrir.',
    highlight: 'bottom-tab-bar',
    color: 'bg-violet-500/15',
    iconColor: 'text-violet-500',
  },
  {
    icon: ClipboardCheck,
    title: 'Sois présent',
    subtitle: 'Onglet Présences',
    description: 'Indique ta disponibilité pour les entraînements et matchs en un seul tap.',
    tabId: 'presences',
    roles: ['joueur', 'dirigeant'],
    color: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
  },
  {
    icon: ClipboardCheck,
    title: 'Organise ton équipe',
    subtitle: 'Présences & Convocations',
    description: 'Gère les présences, publie les convocations et définis les compositions match par match.',
    tabId: 'presences',
    roles: ['entraineur', 'admin', 'admin_plus'],
    color: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
  },
  {
    icon: BarChart3,
    title: 'Suis les performances',
    subtitle: 'Onglet Statistiques',
    description: 'Buts, passes décisives, cartons — toutes les stats de l\'équipe en un coup d\'œil.',
    tabId: 'stats',
    color: 'bg-amber-500/15',
    iconColor: 'text-amber-500',
  },
  {
    icon: Trophy,
    title: 'Reste dans la course',
    subtitle: 'Onglet Championnat',
    description: 'Classement en direct, résultats et calendrier complet des journées de championnat.',
    tabId: 'championnat',
    color: 'bg-yellow-500/15',
    iconColor: 'text-yellow-500',
  },
  {
    icon: Newspaper,
    title: 'Vis le club de l\'intérieur',
    subtitle: 'Au cœur du club',
    description: 'Actualités, publications et annonces — lis, like et commente la vie du club.',
    tabId: 'news',
    color: 'bg-sky-500/15',
    iconColor: 'text-sky-500',
  },
  {
    icon: PenLine,
    title: 'Anime la communauté',
    subtitle: 'Publier des actualités',
    description: 'Rédige et publie des articles pour informer les membres et rythmer la saison.',
    tabId: 'news',
    roles: ['entraineur', 'admin', 'admin_plus'],
    color: 'bg-sky-500/15',
    iconColor: 'text-sky-500',
  },
  {
    icon: Calendar,
    title: 'Anticipe la saison',
    subtitle: 'Onglet Calendrier',
    description: 'Tous les événements à venir — matchs, entraînements et moments importants du club.',
    tabId: 'calendar',
    color: 'bg-rose-500/15',
    iconColor: 'text-rose-500',
  },
  {
    icon: CalendarPlus,
    title: 'Programme et notifie',
    subtitle: 'Créer des événements',
    description: 'Planifie matchs et entraînements, les joueurs sont notifiés automatiquement.',
    tabId: 'calendar',
    roles: ['entraineur', 'admin', 'admin_plus', 'dirigeant'],
    color: 'bg-rose-500/15',
    iconColor: 'text-rose-500',
  },
  {
    icon: Images,
    title: 'Revivez les moments',
    subtitle: 'Onglet Galerie',
    description: 'Parcours les albums photos et retrouve les meilleurs souvenirs de la saison.',
    tabId: 'gallery',
    color: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-500',
  },
  {
    icon: FolderPlus,
    title: 'Immortalise le club',
    subtitle: 'Gérer la galerie',
    description: 'Crée des albums et uploade des photos pour alimenter la mémoire collective du club.',
    tabId: 'gallery',
    roles: ['photographe', 'admin', 'admin_plus'],
    color: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-500',
  },
  {
    icon: Users,
    title: 'Connais ton équipe',
    subtitle: 'Onglet Membres',
    description: 'La liste complète des membres du club avec leurs rôles et informations.',
    tabId: 'members',
    color: 'bg-teal-500/15',
    iconColor: 'text-teal-500',
  },
  {
    icon: UserCog,
    title: 'Administre le club',
    subtitle: 'Gérer les membres',
    description: 'Invite de nouveaux membres, modifie les rôles et gère les comptes en toute simplicité.',
    tabId: 'members',
    roles: ['admin', 'admin_plus'],
    color: 'bg-teal-500/15',
    iconColor: 'text-teal-500',
  },
  {
    icon: Coins,
    title: 'Accumule des points',
    subtitle: 'Système de récompenses',
    description: 'Pour gagner des points il suffit de : répondre présent/absent (+5 pts), commenter une actu (+5 pts), liker (+1 pt) et te connecter chaque jour (+1 pt).',
    color: 'bg-amber-500/15',
    iconColor: 'text-amber-500',
  },
  {
    icon: Target,
    title: 'Parie sur les matchs',
    subtitle: 'Paris sportifs virtuels',
    description: 'Utilise tes points pour parier sur le prochain match du championnat. Choisis le résultat, mise tes points et tente de grimper au classement !',
    color: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
  },
  {
    icon: Rocket,
    title: 'Tu es prêt.',
    subtitle: 'Bonne saison à toi !',
    description: 'Tu peux relancer ce tutoriel à tout moment depuis ton profil. À toi de jouer.',
    color: 'bg-primary/15',
    iconColor: 'text-primary',
  },
];

interface OnboardingTutorialProps {
  userRole: string;
  onComplete: () => void;
  onTabChange?: (tab: string) => void;
  mandatory?: boolean;
}

// Phase states:
// 'tutorial' → normal tutorial
// 'reveal'   → overlay fades out, site visible 1.5s
// 'celebrate'→ celebration with blur
type Phase = 'tutorial' | 'reveal' | 'celebrate';

const OnboardingTutorial = ({ userRole, onComplete, onTabChange, mandatory = false }: OnboardingTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [phase, setPhase] = useState<Phase>('tutorial');

  // Filter steps by role, deduplicate per tabId
  const steps = (() => {
    const roleFiltered = allSteps.filter(s => !s.roles || s.roles.includes(userRole));
    const seen = new Map<string, number>();
    const result: TutorialStep[] = [];
    for (const step of roleFiltered) {
      if (step.tabId) {
        const existing = seen.get(step.tabId);
        if (existing !== undefined) {
          if (step.roles && step.roles.includes(userRole)) {
            result[existing] = step;
          }
          continue;
        }
        seen.set(step.tabId, result.length);
      }
      result.push(step);
    }
    return result;
  })();

  const step = steps[currentStep];
  const total = steps.length;
  const isFirst = currentStep === 0;
  const isLast = currentStep === total - 1;
  const progress = ((currentStep + 1) / total) * 100;

  const handleComplete = useCallback(() => {
    // Phase 1: reveal site (overlay fades out)
    setPhase('reveal');
    setTimeout(() => {
      // Phase 2: celebrate with blur
      setPhase('celebrate');
      setTimeout(() => {
        onComplete();
      }, 2500);
    }, 1400);
  }, [onComplete]);

  const goNext = useCallback(() => {
    if (isLast) { handleComplete(); return; }
    setDirection(1);
    setCurrentStep(p => p + 1);
  }, [isLast, handleComplete]);

  const goPrev = useCallback(() => {
    if (isFirst) return;
    setDirection(-1);
    setCurrentStep(p => p - 1);
  }, [isFirst]);

  useEffect(() => {
    if (step?.tabId && onTabChange) onTabChange(step.tabId);
  }, [currentStep, step?.tabId, onTabChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'tutorial') return;
      if (e.key === 'ArrowRight' || e.key === ' ') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape' && !mandatory) handleComplete();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, handleComplete, mandatory, phase]);

  if (!step) return null;
  const Icon = step.icon;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0, scale: 0.95 }),
  };

  return (
    <div>
      {/* ── REVEAL PHASE: site visible, overlay disappears ── */}
      <AnimatePresence>
        {phase === 'reveal' && (
          <motion.div
            key="reveal-overlay"
            className="fixed inset-0 z-[200] pointer-events-none"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CELEBRATE PHASE ── */}
      <AnimatePresence>
        {phase === 'celebrate' && (
          <motion.div
            key="celebrate"
            className="fixed inset-0 z-[200] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Fond radial */}
            <motion.div
              className="absolute inset-0"
              initial={{ background: 'radial-gradient(circle, hsl(var(--accent)/0) 0%, transparent 100%)' }}
              animate={{ background: 'radial-gradient(circle, hsl(var(--accent)/0.18) 0%, transparent 70%)' }}
              transition={{ duration: 0.6 }}
            />

            {/* Voile de flou progressif */}
            <motion.div
              className="absolute inset-0 backdrop-blur-2xl bg-background/80"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 0.5, 0.85, 1] }}
              transition={{ duration: 2.5, times: [0, 0.4, 0.65, 0.85, 1], ease: 'easeInOut' }}
            />

            <div className="flex flex-col items-center gap-4 relative z-10">
              {/* Animated checkmark */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: [0, 1.3, 1], rotate: [0, 10, 0] }}
                transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                className="w-24 h-24 rounded-3xl bg-accent flex items-center justify-center shadow-2xl shadow-accent/50"
              >
                <motion.svg
                  width="44" height="44" viewBox="0 0 24 24" fill="none"
                  stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <motion.polyline
                    points="20 6 9 17 4 12"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.45, ease: 'easeOut' }}
                  />
                </motion.svg>
              </motion.div>

              {/* Radiating rings */}
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="absolute w-24 h-24 rounded-3xl border-2 border-accent/40"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.5 + i * 0.6, opacity: 0 }}
                  transition={{ delay: 0.3 + i * 0.15, duration: 0.7, ease: 'easeOut' }}
                />
              ))}

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="text-2xl font-extrabold text-foreground tracking-tight"
              >
                C'est parti ! 🎉
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-sm text-muted-foreground"
              >
                Tu es redirigé vers <span className="font-bold text-accent">Présences</span>
              </motion.p>

              {/* Arrow */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: [0, 12, 0] }}
                transition={{ delay: 0.9, duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                className="flex flex-col items-center gap-1 mt-2"
              >
                <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center">
                  <ArrowDown size={18} className="text-accent" />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TUTORIAL PHASE ── */}
      <AnimatePresence>
        {phase === 'tutorial' && (
          <motion.div
            key="tutorial"
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-lg"
              onClick={mandatory ? undefined : handleComplete}
            />

            {/* Swipe hint for bottom tab bar */}
            <AnimatePresence>
              {step.highlight === 'bottom-tab-bar' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="lg:hidden absolute bottom-[5rem] left-1/2 -translate-x-1/2 z-[201]"
                >
                  <motion.div
                    animate={{ x: [0, 12, -12, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-full text-xs font-bold shadow-xl shadow-accent/40"
                  >
                    <Hand size={14} />
                    <span>Glisse ici ←→</span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Card */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-[201] w-full sm:max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-card rounded-t-[2rem] sm:rounded-[2rem] border border-border/30 shadow-[0_-10px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden">
                {/* Progress bar */}
                <div className="h-1 bg-secondary/50">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-accent via-primary to-accent rounded-r-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                  />
                </div>

                {/* Close button */}
                {!mandatory && (
                  <button
                    onClick={handleComplete}
                    className="absolute top-5 right-5 p-2 rounded-full hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground z-10"
                  >
                    <X size={18} />
                  </button>
                )}

                {/* Animated content */}
                <div className="relative min-h-[300px] flex items-center justify-center px-8 pt-6 pb-2">
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={currentStep}
                      custom={direction}
                      variants={variants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                      className="text-center w-full"
                    >
                      {/* Step counter */}
                      <motion.p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 mb-5">
                        {currentStep + 1} sur {total}
                      </motion.p>

                      {/* Icon */}
                      <div className="relative inline-flex items-center justify-center mb-6">
                        <motion.div
                          animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.6, 0.4] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                          className={cn('absolute w-[5.5rem] h-[5.5rem] rounded-[1.75rem]', step.color)}
                        />
                        <motion.div
                          initial={{ scale: 0, rotate: -12 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.08 }}
                          className={cn('relative w-16 h-16 rounded-2xl flex items-center justify-center', step.color)}
                        >
                          <Icon size={30} strokeWidth={1.8} className={step.iconColor} />
                        </motion.div>
                      </div>

                      {/* Title — 2 lines: small label + big title */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.3 }}
                        className="mb-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-0.5">
                          {step.title}
                        </p>
                        <h3 className="text-2xl font-extrabold text-foreground tracking-tight leading-tight">
                          {step.subtitle}
                        </h3>
                      </motion.div>

                      {/* Description */}
                      <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.3 }}
                        className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto"
                      >
                        {step.description}
                      </motion.p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Navigation */}
                <div className="px-6 pb-4 flex items-center gap-3">
                  {!isFirst ? (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={goPrev}
                      className="flex items-center justify-center w-12 h-12 rounded-xl border border-border/50 hover:bg-secondary/60 transition-all text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={20} />
                    </motion.button>
                  ) : mandatory ? (
                    <div className="w-12" />
                  ) : (
                    <button
                      onClick={handleComplete}
                      className="px-4 h-12 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                    >
                      Passer
                    </button>
                  )}
                  
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={goNext}
                    className="flex-1 h-12 bg-gradient-to-r from-accent to-primary text-accent-foreground rounded-xl font-bold text-sm shadow-lg shadow-accent/25 flex items-center justify-center gap-2 transition-shadow hover:shadow-xl hover:shadow-accent/30"
                  >
                    {isLast ? 'Commencer maintenant 🚀' : 'Suivant'}
                    {!isLast && (
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <ChevronRight size={16} />
                      </motion.span>
                    )}
                  </motion.button>
                </div>

                {/* Dots */}
                <div className="flex items-center justify-center gap-1.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  {steps.map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        width: i === currentStep ? 24 : 6,
                        backgroundColor: i === currentStep 
                          ? 'hsl(var(--accent))' 
                          : i < currentStep 
                            ? 'hsl(var(--accent) / 0.3)' 
                            : 'hsl(var(--border))',
                      }}
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                      className="h-1.5 rounded-full"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnboardingTutorial;
