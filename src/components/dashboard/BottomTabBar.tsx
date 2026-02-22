import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck, ClipboardCheck, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  featured?: boolean;
}

const allTabs: Tab[] = [
  { id: 'stats', label: 'Stats', icon: TrendingUp },
  { id: 'championnat', label: 'Championnat', icon: Trophy },
  { id: 'news', label: 'Actus', icon: Bell },
  { id: 'presences', label: 'Présences', icon: ClipboardCheck, featured: true },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'gallery', label: 'Galerie', icon: Camera },
  { id: 'members', label: 'Membres', icon: UserCheck },
  { id: 'chat', label: 'Discussions', icon: MessageCircle },
];

/** Icône animée : bounce prononcé + rotation à l'activation */
const AnimatedIcon = ({ icon: Icon, isActive, size, strokeWidth, className }: {
  icon: React.ElementType;
  isActive: boolean;
  size: number;
  strokeWidth: number;
  className?: string;
}) => (
  <div className="relative flex items-center justify-center">
    {/* Halo flash à l'activation */}
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="halo"
          initial={{ scale: 0.6, opacity: 0.8 }}
          animate={{ scale: 2.2, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full bg-accent pointer-events-none"
        />
      )}
    </AnimatePresence>

    {/* Icône avec bounce */}
    <AnimatePresence initial={false}>
      <motion.div
        key={isActive ? 'active' : 'idle'}
        initial={isActive
          ? { scale: 0, rotate: -30, opacity: 0 }
          : { scale: 1.2, rotate: 15, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0, position: 'absolute' } as any}
        transition={{ type: 'spring', damping: 12, stiffness: 320 }}
      >
        <Icon size={size} strokeWidth={strokeWidth} className={className} />
      </motion.div>
    </AnimatePresence>
  </div>
);

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [featuredJustActivated, setFeaturedJustActivated] = useState(false);
  const prevActiveTab = useRef(activeTab);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  // Auto-scroll to active tab
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeBtn) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const btnCenter = btnRect.left - containerRect.left + scrollLeft + btnRect.width / 2;
      const targetScroll = btnCenter - containerRect.width / 2;
      container.scrollTo({ left: targetScroll, behavior: mounted ? 'smooth' : 'auto' });
    }
  }, [activeTab, mounted]);

  // One-shot animation when featured tab is activated
  useEffect(() => {
    if (prevActiveTab.current !== activeTab && activeTab === 'presences') {
      setFeaturedJustActivated(true);
      const t = setTimeout(() => setFeaturedJustActivated(false), 700);
      prevActiveTab.current = activeTab;
      return () => clearTimeout(t);
    }
    prevActiveTab.current = activeTab;
  }, [activeTab]);

  const handleTap = useCallback((tabId: string) => {
    if (tabId === activeTab) return;
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(tabId);
  }, [activeTab, onTabChange]);

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-50"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260, delay: 0.2 }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 border-t border-white/[0.08]"
        style={{
          background: 'linear-gradient(to top, hsl(var(--card) / 0.97), hsl(var(--card) / 0.90))',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          backdropFilter: 'saturate(180%) blur(20px)',
        }}
      />

      {/* Mobile : scroll horizontal libre */}
      <div className="relative md:hidden">
        <div
          ref={scrollRef}
          className="flex items-center overflow-x-auto scrollbar-hide px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] gap-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {allTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isFeatured = tab.featured;

            if (isFeatured) {
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => handleTap(tab.id)}
                  className="relative flex flex-col items-center justify-center min-w-[5rem] shrink-0 outline-none select-none py-1"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <motion.div
                    animate={isActive
                      ? { opacity: [0.4, 0.9, 0.4], scale: [1, 1.18, 1] }
                      : { opacity: [0.1, 0.25, 0.1], scale: [1, 1.08, 1] }
                    }
                    transition={{ duration: isActive ? 1.8 : 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute rounded-2xl pointer-events-none"
                    style={{
                      inset: '-6px',
                      background: isActive
                        ? 'radial-gradient(ellipse at center, hsl(var(--accent) / 0.55) 0%, transparent 70%)'
                        : 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.3) 0%, transparent 70%)',
                      filter: 'blur(6px)',
                    }}
                  />
                  <motion.div
                    whileTap={{ scale: 0.84 }}
                    animate={featuredJustActivated
                      ? { scale: [1, 1.22, 0.94, 1.06, 1], transition: { duration: 0.55, ease: [0.34, 1.56, 0.64, 1] } }
                      : { scale: 1 }
                    }
                    className="relative flex items-center justify-center rounded-2xl"
                    style={{
                      width: isActive ? '3.75rem' : '3.25rem',
                      height: isActive ? '3.25rem' : '2.75rem',
                      background: isActive
                        ? 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent) / 0.8))'
                        : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
                      boxShadow: isActive
                        ? '0 4px 20px -2px hsl(var(--accent) / 0.7), 0 0 0 1px hsl(var(--accent) / 0.3)'
                        : '0 3px 14px -3px hsl(var(--primary) / 0.5)',
                      transition: 'width 0.3s cubic-bezier(0.34,1.56,0.64,1), height 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                  >
                    {isActive && (
                      <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
                        className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
                        style={{ background: 'linear-gradient(90deg, transparent 0%, hsl(var(--accent-foreground) / 0.2) 50%, transparent 100%)', width: '60%' }}
                      />
                    )}
                    <motion.div animate={featuredJustActivated ? { rotate: [0, -12, 12, -5, 0], transition: { duration: 0.5, ease: 'easeInOut' } } : { rotate: 0 }}>
                      <AnimatedIcon icon={Icon} isActive={isActive} size={isActive ? 25 : 22} strokeWidth={2.5} className={cn('relative z-10', isActive ? 'text-accent-foreground' : 'text-primary-foreground')} />
                    </motion.div>
                  </motion.div>
                  <span className={cn('text-[10px] leading-none mt-1.5 tracking-tight whitespace-nowrap transition-colors duration-200', isActive ? 'font-extrabold text-accent' : 'font-semibold text-muted-foreground/70')}>
                    {tab.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => handleTap(tab.id)}
                className={cn('relative flex flex-col items-center justify-center pt-1.5 pb-1 min-w-[4rem] shrink-0 outline-none select-none')}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <motion.div
                  initial={false}
                  animate={{ width: isActive ? 28 : 0, opacity: isActive ? 1 : 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full bg-accent"
                />
                <motion.div
                  initial={false}
                  animate={{ width: isActive ? 56 : 32, backgroundColor: isActive ? 'hsl(var(--accent) / 0.12)' : 'transparent' }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="relative flex items-center justify-center rounded-2xl h-8"
                >
                  <AnimatedIcon
                    icon={Icon}
                    isActive={isActive}
                    size={isActive ? 20 : 21}
                    strokeWidth={isActive ? 2.4 : 1.6}
                    className={cn('transition-colors duration-200', isActive ? 'text-accent' : 'text-muted-foreground/55')}
                  />
                </motion.div>
                <span className={cn('text-[10px] leading-none mt-1 tracking-tight whitespace-nowrap transition-colors duration-200', isActive ? 'font-bold text-accent' : 'font-medium text-muted-foreground/45')}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tablette (md → lg) : tous les onglets visibles, centrés, taille fixe */}
      <div className="relative hidden md:flex items-center justify-center gap-1 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {allTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isFeatured = tab.featured;

          if (isFeatured) {
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => handleTap(tab.id)}
                className="relative flex flex-col items-center justify-center w-20 outline-none select-none py-1"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <motion.div
                  animate={isActive ? { opacity: [0.4, 0.9, 0.4], scale: [1, 1.18, 1] } : { opacity: [0.1, 0.25, 0.1], scale: [1, 1.08, 1] }}
                  transition={{ duration: isActive ? 1.8 : 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute rounded-2xl pointer-events-none"
                  style={{
                    inset: '-6px',
                    background: isActive
                      ? 'radial-gradient(ellipse at center, hsl(var(--accent) / 0.55) 0%, transparent 70%)'
                      : 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.3) 0%, transparent 70%)',
                    filter: 'blur(6px)',
                  }}
                />
                <motion.div
                  whileTap={{ scale: 0.84 }}
                  animate={featuredJustActivated ? { scale: [1, 1.22, 0.94, 1.06, 1], transition: { duration: 0.55 } } : { scale: 1 }}
                  className="relative flex items-center justify-center rounded-2xl"
                  style={{
                    width: isActive ? '3.75rem' : '3.25rem',
                    height: isActive ? '3.25rem' : '2.75rem',
                    background: isActive
                      ? 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent) / 0.8))'
                      : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
                    boxShadow: isActive
                      ? '0 4px 20px -2px hsl(var(--accent) / 0.7), 0 0 0 1px hsl(var(--accent) / 0.3)'
                      : '0 3px 14px -3px hsl(var(--primary) / 0.5)',
                    transition: 'width 0.3s ease, height 0.3s ease',
                  }}
                >
                  <AnimatedIcon icon={Icon} isActive={isActive} size={isActive ? 24 : 21} strokeWidth={2.5} className={cn('relative z-10', isActive ? 'text-accent-foreground' : 'text-primary-foreground')} />
                </motion.div>
                <span className={cn('text-[10px] leading-none mt-1.5 tracking-tight whitespace-nowrap', isActive ? 'font-extrabold text-accent' : 'font-semibold text-muted-foreground/70')}>
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => handleTap(tab.id)}
              className="relative flex flex-col items-center justify-center w-20 pt-1.5 pb-1 outline-none select-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <motion.div
                initial={false}
                animate={{ width: isActive ? 28 : 0, opacity: isActive ? 1 : 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full bg-accent"
              />
              <motion.div
                initial={false}
                animate={{ width: isActive ? 56 : 36, backgroundColor: isActive ? 'hsl(var(--accent) / 0.12)' : 'transparent' }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="relative flex items-center justify-center rounded-2xl h-9"
              >
                <AnimatedIcon
                  icon={Icon}
                  isActive={isActive}
                  size={isActive ? 21 : 22}
                  strokeWidth={isActive ? 2.4 : 1.6}
                  className={cn('transition-colors duration-200', isActive ? 'text-accent' : 'text-muted-foreground/55')}
                />
              </motion.div>
              <span className={cn('text-[10px] leading-none mt-1 tracking-tight whitespace-nowrap', isActive ? 'font-bold text-accent' : 'font-medium text-muted-foreground/45')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default React.memo(BottomTabBar);
