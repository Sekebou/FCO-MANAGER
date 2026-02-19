import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck, ClipboardCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  featured?: boolean;
}

const allTabs: Tab[] = [
  { id: 'stats',       label: 'Stats',      icon: TrendingUp },
  { id: 'championnat', label: 'Classement', icon: Trophy },
  { id: 'news',        label: 'Actus',      icon: Bell },
  { id: 'presences',   label: 'Présences',  icon: ClipboardCheck, featured: true },
  { id: 'calendar',    label: 'Calendrier', icon: Calendar },
  { id: 'gallery',     label: 'Galerie',    icon: Camera },
  { id: 'members',     label: 'Membres',    icon: UserCheck },
];

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [featuredJustActivated, setFeaturedJustActivated] = useState(false);
  const prevActiveTab = useRef(activeTab);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  // Auto-scroll to active tab
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const btn = el.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (!btn) return;
    const elRect = el.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const center = btnRect.left - elRect.left + el.scrollLeft + btnRect.width / 2;
    el.scrollTo({ left: center - elRect.width / 2, behavior: mounted ? 'smooth' : 'auto' });
  }, [activeTab, mounted]);

  // One-shot bounce when presences becomes active
  useEffect(() => {
    if (prevActiveTab.current !== activeTab && activeTab === 'presences') {
      setFeaturedJustActivated(true);
      const t = setTimeout(() => setFeaturedJustActivated(false), 700);
      prevActiveTab.current = activeTab;
      return () => clearTimeout(t);
    }
    prevActiveTab.current = activeTab;
  }, [activeTab]);

  const handleTap = useCallback((id: string) => {
    if (id === activeTab) return;
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(id);
  }, [activeTab, onTabChange]);

  return (
    <motion.div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260, delay: 0.2 }}
    >
      {/* Fond flouté */}
      <div
        className="absolute inset-0 border-t border-white/[0.07]"
        style={{
          background: 'linear-gradient(to top, hsl(var(--card) / 0.97), hsl(var(--card) / 0.91))',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          backdropFilter: 'saturate(180%) blur(20px)',
        }}
      />

      <div className="relative">
        {/* ── Scroll container — 4 onglets fixes visibles ── */}
        <div
          ref={scrollRef}
          className="flex items-stretch overflow-x-auto scrollbar-hide"
          style={{
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'env(safe-area-inset-bottom)',
            scrollSnapType: 'none',
          }}
        >
          {allTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            if (tab.featured) {
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => handleTap(tab.id)}
                  className="relative flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 shrink-0 outline-none select-none"
                  style={{
                    width: 'calc(100vw / 5.5)',
                    minWidth: '3.75rem',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {/* Indicateur top */}
                  <motion.div
                    initial={false}
                    animate={{ width: isActive ? 28 : 0, opacity: isActive ? 1 : 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full bg-accent"
                  />

                  {/* Pill colorée — TAILLE FIXE */}
                  <motion.div
                    whileTap={{ scale: 0.87 }}
                    animate={
                      featuredJustActivated
                        ? { scale: [1, 1.14, 0.93, 1.04, 1], transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] } }
                        : { scale: 1 }
                    }
                    className="relative flex items-center justify-center rounded-[14px]"
                    style={{
                      width: 44,
                      height: 32,
                      flexShrink: 0,
                      background: isActive
                        ? 'hsl(var(--accent))'
                        : 'hsl(var(--primary) / 0.85)',
                      boxShadow: isActive
                        ? '0 0 18px 4px hsl(var(--accent) / 0.55), 0 0 6px 1px hsl(var(--accent) / 0.8)'
                        : '0 2px 8px -2px hsl(var(--primary) / 0.35)',
                    }}
                  >
                    {/* Halo pulsant quand actif */}
                    {isActive && (
                      <>
                        <motion.div
                          animate={{ opacity: [0.4, 0.9, 0.4], scale: [1, 1.25, 1] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                          className="absolute inset-0 rounded-[14px] blur-md -z-10"
                          style={{ background: 'hsl(var(--accent) / 0.7)' }}
                        />
                        <motion.div
                          animate={{ opacity: [0.15, 0.45, 0.15] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                          className="absolute -inset-2 rounded-[18px] blur-xl -z-20"
                          style={{ background: 'hsl(var(--accent) / 0.5)' }}
                        />
                      </>
                    )}
                    <motion.div
                      animate={
                        featuredJustActivated
                          ? { rotate: [0, -10, 10, -5, 0], transition: { duration: 0.45, ease: 'easeInOut' } }
                          : { rotate: 0 }
                      }
                    >
                      <Icon
                        size={18}
                        strokeWidth={2.5}
                        className={isActive ? 'text-accent-foreground' : 'text-primary-foreground'}
                      />
                    </motion.div>
                  </motion.div>

                  <span
                    className={cn(
                      'text-[10px] leading-none tracking-tight whitespace-nowrap',
                      isActive ? 'font-bold text-accent' : 'font-medium text-muted-foreground/60'
                    )}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            }

            // ── Onglet standard ──
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => handleTap(tab.id)}
                className="relative flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 shrink-0 outline-none select-none"
                style={{
                  width: 'calc(100vw / 5.5)',
                  minWidth: '3.5rem',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Barre active en haut */}
                <motion.div
                  initial={false}
                  animate={{ width: isActive ? 28 : 0, opacity: isActive ? 1 : 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full bg-accent"
                />

                {/* Icône avec fond pill quand actif */}
                <motion.div
                  initial={false}
                  animate={{
                    width: isActive ? 48 : 32,
                    backgroundColor: isActive ? 'hsl(var(--accent) / 0.13)' : 'rgba(0,0,0,0)',
                  }}
                  transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                  className="flex items-center justify-center rounded-[12px] h-8"
                  style={{ flexShrink: 0 }}
                >
                  <Icon
                    size={isActive ? 20 : 21}
                    strokeWidth={isActive ? 2.4 : 1.6}
                    className={cn(
                      'transition-colors duration-200',
                      isActive ? 'text-accent' : 'text-muted-foreground/50'
                    )}
                  />
                </motion.div>

                <span
                  className={cn(
                    'text-[10px] leading-none tracking-tight whitespace-nowrap transition-colors duration-200',
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
