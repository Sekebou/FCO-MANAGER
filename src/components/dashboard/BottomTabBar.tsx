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
  { id: 'stats', label: 'Stats', icon: TrendingUp },
  { id: 'championnat', label: 'Classement', icon: Trophy },
  { id: 'news', label: 'Actus', icon: Bell },
  { id: 'presences', label: 'Présences', icon: ClipboardCheck, featured: true },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'gallery', label: 'Galerie', icon: Camera },
  { id: 'members', label: 'Membres', icon: UserCheck },
];

const nonFeaturedTabs = allTabs.filter(t => !t.featured);
const leftTabs = nonFeaturedTabs.slice(0, 3);
const rightTabs = nonFeaturedTabs.slice(3);
const featuredTab = allTabs.find(t => t.featured)!;
const FeaturedIcon = featuredTab.icon;

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const [mounted, setMounted] = useState(false);
  // Track previous active to trigger one-shot animation
  const [featuredJustActivated, setFeaturedJustActivated] = useState(false);
  const prevActiveTab = useRef(activeTab);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  useEffect(() => {
    if (prevActiveTab.current !== activeTab && activeTab === featuredTab.id) {
      setFeaturedJustActivated(true);
      const t = setTimeout(() => setFeaturedJustActivated(false), 700);
      return () => clearTimeout(t);
    }
    prevActiveTab.current = activeTab;
  }, [activeTab]);

  const handleTap = useCallback((tabId: string) => {
    if (tabId === activeTab) return;
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(tabId);
  }, [activeTab, onTabChange]);

  const isFeaturedActive = activeTab === featuredTab.id;

  return (
    <motion.div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260, delay: 0.2 }}
    >
      {/* Outer wrapper — reserves space above for the floating button */}
      <div className="relative" style={{ paddingTop: '2.25rem' }}>

        {/* Bar background — only covers the actual bar area (starts below the floating button) */}
        <div
          className="absolute inset-x-0 bottom-0 border-t border-white/[0.08]"
          style={{
            top: '1.1rem',
            background: 'linear-gradient(to top, hsl(var(--card) / 0.97), hsl(var(--card) / 0.90))',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            backdropFilter: 'saturate(180%) blur(20px)',
          }}
        />

        {/* Floating featured button — sits above the bar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <button
            data-tab={featuredTab.id}
            onClick={() => handleTap(featuredTab.id)}
            className="flex flex-col items-center gap-1 outline-none select-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <motion.div
              whileTap={{ scale: 0.86 }}
              animate={featuredJustActivated
                ? { scale: [1, 1.15, 0.95, 1], transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1], repeat: 0 } }
                : { scale: 1 }
              }
              className={cn(
                'relative w-[3.75rem] h-[3.75rem] rounded-2xl flex items-center justify-center',
                isFeaturedActive ? 'bg-accent' : 'bg-primary'
              )}
              style={{
                boxShadow: isFeaturedActive
                  ? '0 4px 24px -4px hsl(var(--accent) / 0.6), 0 0 0 4px hsl(var(--background))'
                  : '0 4px 20px -4px hsl(var(--primary) / 0.5), 0 0 0 4px hsl(var(--background))',
              }}
            >
              {/* Pulsing ring — only when active, truly looping */}
              {isFeaturedActive && (
                <motion.div
                  className="absolute -inset-2 rounded-[20px] border-2 border-accent/30"
                  animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.95, 1.05, 0.95] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {/* Glow blob — only when active */}
              {isFeaturedActive && (
                <motion.div
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-2xl bg-accent/40 blur-xl -z-10"
                />
              )}
              <motion.div
                animate={featuredJustActivated
                  ? { rotate: [0, -8, 8, 0], transition: { duration: 0.45, ease: 'easeInOut', repeat: 0 } }
                  : { rotate: 0 }
                }
              >
                <FeaturedIcon
                  size={26}
                  strokeWidth={2.4}
                  className={cn('relative z-10', isFeaturedActive ? 'text-accent-foreground' : 'text-primary-foreground')}
                />
              </motion.div>
            </motion.div>
            <span
              className={cn(
                'text-[10px] leading-none tracking-tight whitespace-nowrap font-bold',
                isFeaturedActive ? 'text-accent' : 'text-muted-foreground/70'
              )}
            >
              {featuredTab.label}
            </span>
          </button>
        </div>

        {/* Tab row — left tabs | center gap | right tabs */}
        <div className="relative flex items-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {/* Left tabs */}
          <div className="flex flex-1 justify-around">
            {leftTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => handleTap(tab.id)}
                  className={cn(
                    'relative flex flex-col items-center justify-center pt-2 pb-1 min-w-[3.5rem] shrink-0',
                    'outline-none select-none',
                  )}
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
                    animate={{
                      width: isActive ? 48 : 32,
                      backgroundColor: isActive ? 'hsl(var(--accent) / 0.12)' : 'transparent',
                    }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="relative flex items-center justify-center rounded-2xl h-8"
                  >
                    <Icon
                      size={isActive ? 19 : 20}
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

          {/* Center gap for the floating button */}
          <div style={{ minWidth: '4.25rem', flexShrink: 0 }} />

          {/* Right tabs */}
          <div className="flex flex-1 justify-around">
            {rightTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => handleTap(tab.id)}
                  className={cn(
                    'relative flex flex-col items-center justify-center pt-2 pb-1 min-w-[3.5rem] shrink-0',
                    'outline-none select-none',
                  )}
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
                    animate={{
                      width: isActive ? 48 : 32,
                      backgroundColor: isActive ? 'hsl(var(--accent) / 0.12)' : 'transparent',
                    }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="relative flex items-center justify-center rounded-2xl h-8"
                  >
                    <Icon
                      size={isActive ? 19 : 20}
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
      </div>
    </motion.div>
  );
};

export default React.memo(BottomTabBar);
