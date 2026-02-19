import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck, ClipboardCheck, ChevronLeft, ChevronRight } from 'lucide-react';
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
  { id: 'championnat', label: 'Classement', icon: Trophy },
  { id: 'news', label: 'Actus', icon: Bell },
  { id: 'presences', label: 'Présences', icon: ClipboardCheck, featured: true },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'gallery', label: 'Galerie', icon: Camera },
  { id: 'members', label: 'Membres', icon: UserCheck },
];

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BAR_HEIGHT = 64; // px — hauteur fixe de la barre, jamais modifiée

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [featuredJustActivated, setFeaturedJustActivated] = useState(false);
  const prevActiveTab = useRef(activeTab);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll]);

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
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ height: `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom))` }}
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

      <div className="relative h-full flex items-center">

        {/* Indicateur gauche — pulsation lumineuse si contenu hors écran */}
        <AnimatePresence>
          {canScrollLeft && (
            <motion.div
              key="left-indicator"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-0 top-0 bottom-[env(safe-area-inset-bottom)] w-10 z-20 pointer-events-none flex items-center justify-start pl-1"
              style={{
                background: 'linear-gradient(to right, hsl(var(--card) / 0.95) 40%, transparent)',
              }}
            >
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ChevronLeft size={14} className="text-accent" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Indicateur droite */}
        <AnimatePresence>
          {canScrollRight && (
            <motion.div
              key="right-indicator"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute right-0 top-0 bottom-[env(safe-area-inset-bottom)] w-10 z-20 pointer-events-none flex items-center justify-end pr-1"
              style={{
                background: 'linear-gradient(to left, hsl(var(--card) / 0.95) 40%, transparent)',
              }}
            >
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ChevronRight size={14} className="text-accent" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll container — 4 onglets visibles = 25vw chacun */}
        <div
          ref={scrollRef}
          className="flex items-center overflow-x-auto scrollbar-hide w-full px-2"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollPaddingInline: '2rem',
            height: `${BAR_HEIGHT}px`,
          }}
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
                  className="relative flex flex-col items-center justify-center shrink-0 outline-none select-none"
                  style={{
                    width: 'calc(100vw / 4)',
                    minWidth: '4.5rem',
                    WebkitTapHighlightColor: 'transparent',
                    height: `${BAR_HEIGHT}px`,
                  }}
                >
                  {/* Featured pill — taille FIXE pour ne pas changer la hauteur de la barre */}
                  <motion.div
                    whileTap={{ scale: 0.88 }}
                    animate={featuredJustActivated
                      ? { scale: [1, 1.12, 0.96, 1], transition: { duration: 0.45, ease: [0.34, 1.56, 0.64, 1] } }
                      : { scale: 1 }
                    }
                    className="relative flex items-center justify-center rounded-2xl w-12 h-10"
                    style={{
                      background: isActive
                        ? 'hsl(var(--accent))'
                        : 'hsl(var(--primary) / 0.9)',
                      boxShadow: isActive
                        ? '0 0 14px 2px hsl(var(--accent) / 0.45)'
                        : '0 2px 10px -2px hsl(var(--primary) / 0.4)',
                    }}
                  >
                    {/* Glow pulsé quand actif */}
                    {isActive && (
                      <motion.div
                        animate={{ opacity: [0.25, 0.55, 0.25] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 rounded-2xl bg-accent/40 blur-md -z-10"
                      />
                    )}
                    <motion.div
                      animate={featuredJustActivated
                        ? { rotate: [0, -8, 8, 0], transition: { duration: 0.4, ease: 'easeInOut' } }
                        : { rotate: 0 }
                      }
                    >
                      <Icon
                        size={20}
                        strokeWidth={2.4}
                        className={cn('relative z-10', isActive ? 'text-accent-foreground' : 'text-primary-foreground')}
                      />
                    </motion.div>
                  </motion.div>
                  <span
                    className={cn(
                      'text-[10px] leading-none mt-1.5 tracking-tight whitespace-nowrap',
                      isActive ? 'font-bold text-accent' : 'font-semibold text-muted-foreground/70'
                    )}
                  >
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
                className="relative flex flex-col items-center justify-center shrink-0 outline-none select-none"
                style={{
                  width: 'calc(100vw / 4)',
                  minWidth: '4rem',
                  WebkitTapHighlightColor: 'transparent',
                  height: `${BAR_HEIGHT}px`,
                }}
              >
                {/* Indicateur actif en haut */}
                <motion.div
                  initial={false}
                  animate={{ width: isActive ? 28 : 0, opacity: isActive ? 1 : 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full bg-accent"
                />

                {/* Icon pill */}
                <motion.div
                  initial={false}
                  animate={{
                    width: isActive ? 52 : 32,
                    backgroundColor: isActive ? 'hsl(var(--accent) / 0.12)' : 'transparent',
                  }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="relative flex items-center justify-center rounded-2xl h-8"
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.4 : 1.6}
                    className={cn('transition-colors duration-200', isActive ? 'text-accent' : 'text-muted-foreground/55')}
                  />
                </motion.div>

                <span
                  className={cn(
                    'text-[10px] leading-none mt-1 tracking-tight whitespace-nowrap',
                    isActive ? 'font-bold text-accent' : 'font-medium text-muted-foreground/45'
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(BottomTabBar);
