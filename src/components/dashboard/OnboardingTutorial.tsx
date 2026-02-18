import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck, 
  ChevronRight, ChevronLeft, X, Sparkles, Hand, ArrowRight, GripHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TutorialStep {
  icon: React.ElementType;
  title: string;
  description: string;
  tabId?: string;
  highlight?: string;
  roles?: string[];
  emoji?: string;
}

const allSteps: TutorialStep[] = [
  {
    icon: Sparkles,
    title: 'Bienvenue sur FCO Manager !',
    description: 'Découvre ton espace en quelques étapes. Ce tutoriel s\'adapte à ton rôle dans le club.',
    emoji: '👋',
  },
  {
    icon: GripHorizontal,
    title: 'La barre de navigation',
    description: 'En bas de l\'écran, 7 onglets sont disponibles. Glisse horizontalement pour tous les découvrir !',
    highlight: 'bottom-tab-bar',
    emoji: '👆',
  },
  {
    icon: Users,
    title: 'Présences',
    description: 'Indique ta présence ou absence aux entraînements et matchs d\'un simple tap.',
    tabId: 'presences',
    roles: ['joueur', 'dirigeant'],
    emoji: '✅',
  },
  {
    icon: Users,
    title: 'Présences & Convocations',
    description: 'Gère les présences de l\'équipe, publie les convocations et définis les compositions.',
    tabId: 'presences',
    roles: ['entraineur', 'admin', 'admin_plus'],
    emoji: '📋',
  },
  {
    icon: TrendingUp,
    title: 'Statistiques',
    description: 'Buts, passes décisives, cartons… Suis les performances de toute l\'équipe.',
    tabId: 'stats',
    emoji: '📊',
  },
  {
    icon: Trophy,
    title: 'Championnat',
    description: 'Classement en direct, résultats et calendrier des journées de championnat.',
    tabId: 'championnat',
    emoji: '🏆',
  },
  {
    icon: Bell,
    title: 'Au cœur du club',
    description: 'Actualités du club : lis, like et commente les publications.',
    tabId: 'news',
    emoji: '📰',
  },
  {
    icon: Bell,
    title: 'Publier des actus',
    description: 'Publie des actualités pour informer et animer la vie du club.',
    tabId: 'news',
    roles: ['entraineur', 'admin', 'admin_plus'],
    emoji: '✏️',
  },
  {
    icon: Calendar,
    title: 'Calendrier',
    description: 'Tous les événements à venir : matchs, entraînements et moments forts.',
    tabId: 'calendar',
    emoji: '📅',
  },
  {
    icon: Calendar,
    title: 'Créer des événements',
    description: 'Programme matchs et entraînements, notifie automatiquement les joueurs.',
    tabId: 'calendar',
    roles: ['entraineur', 'admin', 'admin_plus', 'dirigeant'],
    emoji: '➕',
  },
  {
    icon: Camera,
    title: 'Galerie photos',
    description: 'Parcours les albums et revois les meilleurs moments du club.',
    tabId: 'gallery',
    emoji: '📸',
  },
  {
    icon: Camera,
    title: 'Gérer la galerie',
    description: 'Crée des albums et uploade des photos pour alimenter la mémoire du club.',
    tabId: 'gallery',
    roles: ['photographe', 'admin', 'admin_plus'],
    emoji: '🖼️',
  },
  {
    icon: UserCheck,
    title: 'Membres',
    description: 'La liste complète des membres du club avec leurs rôles.',
    tabId: 'members',
    emoji: '👥',
  },
  {
    icon: UserCheck,
    title: 'Gérer les membres',
    description: 'Invite de nouveaux membres, modifie les rôles et gère les comptes.',
    tabId: 'members',
    roles: ['admin', 'admin_plus'],
    emoji: '⚙️',
  },
  {
    icon: ArrowRight,
    title: 'C\'est parti !',
    description: 'Tu es prêt à utiliser FCO Manager. Tu peux relancer ce tutoriel depuis ton profil.',
    emoji: '🚀',
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

  const goNext = useCallback(() => {
    if (isLast) { onComplete(); return; }
    setDirection(1);
    setCurrentStep(p => p + 1);
  }, [isLast, onComplete]);

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
      if (e.key === 'Escape' && !mandatory) onComplete();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onComplete, mandatory]);

  if (!step) return null;
  const Icon = step.icon;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0, scale: 0.95 }),
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-lg"
        onClick={mandatory ? undefined : onComplete}
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
              onClick={onComplete}
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
                <motion.p 
                  className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 mb-5"
                >
                  {currentStep + 1} sur {total}
                </motion.p>

                {/* Emoji + Icon combo */}
                <div className="relative inline-flex items-center justify-center mb-5">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-24 h-24 rounded-full bg-accent/8"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                    className="absolute w-20 h-20 rounded-full bg-accent/12"
                  />
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20 border border-accent/20 flex items-center justify-center backdrop-blur-sm"
                  >
                    {step.emoji ? (
                      <span className="text-3xl">{step.emoji}</span>
                    ) : (
                      <Icon size={28} className="text-accent" />
                    )}
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
                onClick={onComplete}
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
              {isLast ? 'Commencer' : 'Suivant'}
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
    </div>
  );
};

export default OnboardingTutorial;
