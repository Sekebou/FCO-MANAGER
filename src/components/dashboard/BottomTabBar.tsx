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
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
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

      <div className="relative">
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
                  className="relative flex flex-col items-center justify-center min-w-[4.5rem] shrink-0 outline-none select-none py-1"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {/* Featured pill button */}
                  <motion.div
                    whileTap={{ scale: 0.88 }}
                    animate={featuredJustActivated
                      ? { scale: [1, 1.14, 0.96, 1], transition: { duration: 0.45, ease: [0.34, 1.56, 0.64, 1], repeat: 0 } }
                      : { scale: 1 }
                    }
                    className={cn(
                      'relative flex items-center justify-center rounded-2xl',
                      isActive ? 'bg-accent w-14 h-12' : 'bg-primary/90 w-12 h-10'
                    )}
                    style={{
                      boxShadow: isActive
                        ? '0 3px 16px -3px hsl(var(--accent) / 0.55)'
                        : '0 3px 12px -3px hsl(var(--primary) / 0.45)',
                      transition: 'width 0.25s ease, height 0.25s ease',
                    }}
                  >
                    {/* Subtle glow when active */}
                    {isActive && (
                      <motion.div
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 rounded-2xl bg-accent/30 blur-md -z-10"
                      />
                    )}
                    <motion.div
                      animate={featuredJustActivated
                        ? { rotate: [0, -7, 7, 0], transition: { duration: 0.4, ease: 'easeInOut', repeat: 0 } }
                        : { rotate: 0 }
                      }
                    >
                      <Icon
                        size={isActive ? 22 : 20}
                        strokeWidth={2.4}
                        className={cn('relative z-10 transition-colors duration-200', isActive ? 'text-accent-foreground' : 'text-primary-foreground')}
                      />
                    </motion.div>
                  </motion.div>
                  <span
                    className={cn(
                      'text-[10px] leading-none mt-1.5 tracking-tight whitespace-nowrap transition-colors duration-200',
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
                className={cn(
                  'relative flex flex-col items-center justify-center pt-1.5 pb-1 min-w-[4rem] shrink-0',
                  'outline-none select-none',
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Active pill indicator on top */}
                <motion.div
                  initial={false}
                  animate={{ width: isActive ? 28 : 0, opacity: isActive ? 1 : 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full bg-accent"
                />

                {/* Icon */}
                <motion.div
                  initial={false}
                  animate={{
                    width: isActive ? 56 : 32,
                    backgroundColor: isActive ? 'hsl(var(--accent) / 0.12)' : 'transparent',
                  }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="relative flex items-center justify-center rounded-2xl h-8"
                >
                  <Icon
                    size={isActive ? 20 : 21}
                    strokeWidth={isActive ? 2.4 : 1.6}
                    className={cn('transition-colors duration-200', isActive ? 'text-accent' : 'text-muted-foreground/55')}
                  />
                </motion.div>

                {/* Label */}
                <span
                  className={cn(
                    'text-[10px] leading-none mt-1 tracking-tight whitespace-nowrap transition-colors duration-200',
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
