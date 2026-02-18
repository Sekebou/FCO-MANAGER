import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck, 
  ChevronRight, ChevronLeft, X, Sparkles, Hand, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TutorialStep {
  icon: React.ElementType;
  title: string;
  description: string;
  tabId?: string;
  highlight?: string; // CSS selector or description
  roles?: string[]; // roles that see this step, undefined = all
}

const allSteps: TutorialStep[] = [
  {
    icon: Sparkles,
    title: 'Bienvenue sur FCO Manager ! 👋',
    description: 'Découvre ton espace en quelques étapes. Ce tutoriel s\'adapte à ton rôle dans le club.',
  },
  {
    icon: Hand,
    title: 'La barre de navigation',
    description: 'En bas de ton écran, tu as une barre avec 7 onglets. Elle est défilable horizontalement — glisse ton doigt vers la gauche ou la droite pour voir tous les onglets !',
    highlight: 'bottom-tab-bar',
  },
  {
    icon: Users,
    title: 'Présences',
    description: 'Indique ta présence ou ton absence aux entraînements et matchs. Un simple tap suffit !',
    tabId: 'presences',
    roles: ['joueur', 'entraineur', 'admin', 'admin_plus', 'dirigeant'],
  },
  {
    icon: Users,
    title: 'Présences & Convocations',
    description: 'Gère les présences de l\'équipe et publie les convocations pour les matchs. Tu peux aussi définir les compositions.',
    tabId: 'presences',
    roles: ['entraineur', 'admin', 'admin_plus'],
  },
  {
    icon: TrendingUp,
    title: 'Statistiques',
    description: 'Consulte les stats de l\'équipe : buts, passes décisives, cartons et classement des joueurs.',
    tabId: 'stats',
  },
  {
    icon: Trophy,
    title: 'Championnat',
    description: 'Suis le classement du championnat, les résultats des matchs et le calendrier des journées.',
    tabId: 'championnat',
  },
  {
    icon: Bell,
    title: 'Au cœur du club',
    description: 'Retrouve les actualités du club, like et commente les publications.',
    tabId: 'news',
  },
  {
    icon: Bell,
    title: 'Publier des actus',
    description: 'En tant qu\'admin ou entraîneur, tu peux publier des actualités pour informer tout le club.',
    tabId: 'news',
    roles: ['entraineur', 'admin', 'admin_plus'],
  },
  {
    icon: Calendar,
    title: 'Calendrier',
    description: 'Visualise tous les événements à venir : matchs, entraînements et événements spéciaux.',
    tabId: 'calendar',
  },
  {
    icon: Calendar,
    title: 'Créer des événements',
    description: 'Crée des matchs, entraînements ou événements et notifie automatiquement les joueurs par email.',
    tabId: 'calendar',
    roles: ['entraineur', 'admin', 'admin_plus', 'dirigeant'],
  },
  {
    icon: Camera,
    title: 'Galerie photos',
    description: 'Parcours les albums photos du club et revois les meilleurs moments.',
    tabId: 'gallery',
  },
  {
    icon: Camera,
    title: 'Gérer la galerie',
    description: 'Crée des albums et uploade des photos pour alimenter la galerie du club.',
    tabId: 'gallery',
    roles: ['photographe', 'admin', 'admin_plus'],
  },
  {
    icon: UserCheck,
    title: 'Membres',
    description: 'Consulte la liste des membres du club avec leurs rôles et informations.',
    tabId: 'members',
  },
  {
    icon: UserCheck,
    title: 'Gérer les membres',
    description: 'Invite de nouveaux membres, modifie les rôles et gère les comptes du club.',
    tabId: 'members',
    roles: ['admin', 'admin_plus'],
  },
  {
    icon: ArrowRight,
    title: 'C\'est parti ! 🚀',
    description: 'Tu es prêt ! N\'hésite pas à explorer chaque section. Tu peux relancer ce tutoriel depuis le menu de ton profil.',
  },
];

interface OnboardingTutorialProps {
  userRole: string;
  onComplete: () => void;
  onTabChange?: (tab: string) => void;
}

const OnboardingTutorial = ({ userRole, onComplete, onTabChange }: OnboardingTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);

  // Filter steps by role
  const steps = allSteps.filter(step => {
    if (!step.roles) return true;
    return step.roles.includes(userRole);
  });

  // Remove duplicate tabs – keep only the most relevant step per tabId for non-admin roles
  const filteredSteps = steps.reduce<TutorialStep[]>((acc, step) => {
    // If step has roles and a tabId, and we already have a generic step for that tab, skip the generic
    if (step.tabId) {
      const existingIdx = acc.findIndex(s => s.tabId === step.tabId);
      if (existingIdx !== -1) {
        // If current step is role-specific (has roles array), replace
        if (step.roles && step.roles.includes(userRole)) {
          acc[existingIdx] = step;
          return acc;
        }
        // If existing is already role-specific, skip generic
        if (acc[existingIdx].roles) return acc;
      }
    }
    acc.push(step);
    return acc;
  }, []);

  const step = filteredSteps[currentStep];
  const total = filteredSteps.length;
  const isFirst = currentStep === 0;
  const isLast = currentStep === total - 1;

  const goTo = useCallback((dir: 'next' | 'prev') => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => dir === 'next' ? prev + 1 : prev - 1);
      setAnimating(false);
    }, 250);
  }, [animating]);

  // Navigate to the tab when step changes
  useEffect(() => {
    if (step?.tabId && onTabChange) {
      onTabChange(step.tabId);
    }
  }, [currentStep, step?.tabId, onTabChange]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && !isLast) goTo('next');
      if (e.key === 'ArrowLeft' && !isFirst) goTo('prev');
      if (e.key === 'Escape') onComplete();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFirst, isLast, goTo, onComplete]);

  if (!step) return null;

  const Icon = step.icon;
  const progress = ((currentStep + 1) / total) * 100;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-foreground/60 backdrop-blur-md animate-fade-in"
        onClick={onComplete}
      />

      {/* Bottom tab highlight indicator */}
      {step.highlight === 'bottom-tab-bar' && (
        <div className="lg:hidden absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 z-[201] animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-full text-xs font-bold shadow-lg shadow-accent/30">
            <Hand size={14} className="animate-[slide-in-right_1s_ease-in-out_infinite_alternate]" />
            <span>Glisse ici ←→</span>
          </div>
        </div>
      )}

      {/* Card */}
      <div 
        className={cn(
          'relative z-[201] w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl border border-border/50 shadow-2xl overflow-hidden',
          'transition-all duration-250',
          animating && direction === 'next' && 'opacity-0 translate-x-8',
          animating && direction === 'prev' && 'opacity-0 -translate-x-8',
          !animating && 'opacity-100 translate-x-0 animate-[fadeSlideUp_0.4s_ease-out_both]',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div 
            className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground z-10"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="px-8 pt-8 pb-6 text-center">
          {/* Step counter */}
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-5">
            {currentStep + 1} / {total}
          </p>

          {/* Icon */}
          <div className="relative inline-flex items-center justify-center mb-5">
            <div className="absolute w-20 h-20 rounded-full bg-accent/10 animate-[pulse_2.5s_ease-in-out_infinite]" />
            <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/20 flex items-center justify-center backdrop-blur-sm">
              <Icon size={28} className="text-accent" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-extrabold text-foreground tracking-tight mb-3">
            {step.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            {step.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="px-6 pb-6 flex items-center gap-3">
          {!isFirst ? (
            <button
              onClick={() => goTo('prev')}
              className="flex items-center justify-center w-12 h-12 rounded-xl border border-border hover:bg-secondary transition-all text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-4 h-12 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              Passer
            </button>
          )}
          
          <button
            onClick={() => isLast ? onComplete() : goTo('next')}
            className="flex-1 h-12 bg-accent text-accent-foreground rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
          >
            {isLast ? 'Commencer' : 'Suivant'}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>

        {/* Dots indicator */}
        <div className="flex items-center justify-center gap-1.5 pb-5">
          {filteredSteps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === currentStep ? 'w-6 bg-accent' : 'w-1.5 bg-border',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
