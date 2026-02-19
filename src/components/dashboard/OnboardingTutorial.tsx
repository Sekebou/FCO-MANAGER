import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck, 
  ChevronRight, ChevronLeft, X, Smartphone, Hand, Rocket,
  ClipboardCheck, BarChart3, Newspaper, PenLine, CalendarPlus,
  Images, FolderPlus, UserCog, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TutorialStep {
  icon: React.ElementType;
  title: string;
  description: string;
  tabId?: string;
  highlight?: string;
  roles?: string[];
  color: string; // tailwind bg color for the icon container
  iconColor: string; // tailwind text color for the icon
}

const allSteps: TutorialStep[] = [
  {
    icon: Zap,
    title: 'Bienvenue sur FCO Manager',
    description: 'Découvre ton espace en quelques étapes. Ce tutoriel s\'adapte à ton rôle dans le club.',
    color: 'bg-primary/15',
    iconColor: 'text-primary',
  },
  {
    icon: Smartphone,
    title: 'La barre de navigation',
    description: 'En bas de l\'écran, 7 onglets sont disponibles. Glisse horizontalement pour tous les découvrir !',
    highlight: 'bottom-tab-bar',
    color: 'bg-violet-500/15',
    iconColor: 'text-violet-500',
  },
  {
    icon: ClipboardCheck,
    title: 'Présences',
    description: 'Indique ta présence ou absence aux entraînements et matchs d\'un simple tap.',
    tabId: 'presences',
    roles: ['joueur', 'dirigeant'],
    color: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
  },
  {
    icon: ClipboardCheck,
    title: 'Présences & Convocations',
    description: 'Gère les présences de l\'équipe, publie les convocations et définis les compositions.',
    tabId: 'presences',
    roles: ['entraineur', 'admin', 'admin_plus'],
    color: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
  },
  {
    icon: BarChart3,
    title: 'Statistiques',
    description: 'Buts, passes décisives, cartons… Suis les performances de toute l\'équipe.',
    tabId: 'stats',
    color: 'bg-amber-500/15',
    iconColor: 'text-amber-500',
  },
  {
    icon: Trophy,
    title: 'Championnat',
    description: 'Classement en direct, résultats et calendrier des journées de championnat.',
    tabId: 'championnat',
    color: 'bg-yellow-500/15',
    iconColor: 'text-yellow-500',
  },
  {
    icon: Newspaper,
    title: 'Au cœur du club',
    description: 'Actualités du club : lis, like et commente les publications.',
    tabId: 'news',
    color: 'bg-sky-500/15',
    iconColor: 'text-sky-500',
  },
  {
    icon: PenLine,
    title: 'Publier des actus',
    description: 'Publie des actualités pour informer et animer la vie du club.',
    tabId: 'news',
    roles: ['entraineur', 'admin', 'admin_plus'],
    color: 'bg-sky-500/15',
    iconColor: 'text-sky-500',
  },
  {
    icon: Calendar,
    title: 'Calendrier',
    description: 'Tous les événements à venir : matchs, entraînements et moments forts.',
    tabId: 'calendar',
    color: 'bg-rose-500/15',
    iconColor: 'text-rose-500',
  },
  {
    icon: CalendarPlus,
    title: 'Créer des événements',
    description: 'Programme matchs et entraînements, notifie automatiquement les joueurs.',
    tabId: 'calendar',
    roles: ['entraineur', 'admin', 'admin_plus', 'dirigeant'],
    color: 'bg-rose-500/15',
    iconColor: 'text-rose-500',
  },
  {
    icon: Images,
    title: 'Galerie photos',
    description: 'Parcours les albums et revois les meilleurs moments du club.',
    tabId: 'gallery',
    color: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-500',
  },
  {
    icon: FolderPlus,
    title: 'Gérer la galerie',
    description: 'Crée des albums et uploade des photos pour alimenter la mémoire du club.',
    tabId: 'gallery',
    roles: ['photographe', 'admin', 'admin_plus'],
    color: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-500',
  },
  {
    icon: Users,
    title: 'Membres',
    description: 'La liste complète des membres du club avec leurs rôles.',
    tabId: 'members',
    color: 'bg-teal-500/15',
    iconColor: 'text-teal-500',
  },
  {
    icon: UserCog,
    title: 'Gérer les membres',
    description: 'Invite de nouveaux membres, modifie les rôles et gère les comptes.',
    tabId: 'members',
    roles: ['admin', 'admin_plus'],
    color: 'bg-teal-500/15',
    iconColor: 'text-teal-500',
  },
  {
    icon: Rocket,
    title: 'C\'est parti !',
    description: 'Tu es prêt à utiliser FCO Manager. Tu peux relancer ce tutoriel depuis ton profil.',
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

const OnboardingTutorial = ({ userRole, onComplete, onTabChange, mandatory = false }: OnboardingTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [completing, setCompleting] = useState(false);

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
    setCompleting(true);
    setTimeout(() => onComplete(), 900);
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
      if (e.key === 'ArrowRight' || e.key === ' ') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape' && !mandatory) handleComplete();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, handleComplete, mandatory]);

  if (!step) return null;
  const Icon = step.icon;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0, scale: 0.95 }),
  };

  return (
    <AnimatePresence>
      {!completing ? (
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

              {/* Close button — only if not mandatory */}
              {!mandatory && (
                <button
                  onClick={handleComplete}
                  className="absolute top-5 right-5 p-2 rounded-full hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground z-10"
                >
                  <X size={18} />
                </button>
              )}

              {/* Animated content */}
              <div className="relative min-h-[280px] flex items-center justify-center px-8 pt-6 pb-2">
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

                    {/* Title */}
                    <motion.h3
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.3 }}
                      className="text-xl font-extrabold text-foreground tracking-tight mb-3"
                    >
                      {step.title}
                    </motion.h3>

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
                  {isLast ? 'Commencer 🚀' : 'Suivant'}
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
      ) : (
        /* Celebration outro screen */
        <motion.div
          key="outro"
          className="fixed inset-0 z-[200] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ background: 'radial-gradient(circle, hsl(var(--accent)/0) 0%, transparent 100%)' }}
            animate={{ background: 'radial-gradient(circle, hsl(var(--accent)/0.18) 0%, transparent 70%)' }}
            transition={{ duration: 0.6 }}
          />
          <div className="flex flex-col items-center gap-4">
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
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.35, duration: 0.5, ease: 'easeOut' }}
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
              className="text-xl font-extrabold text-foreground tracking-tight"
            >
              C'est parti ! 🎉
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="text-sm text-muted-foreground"
            >
              Redirection vers Présences…
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OnboardingTutorial;
