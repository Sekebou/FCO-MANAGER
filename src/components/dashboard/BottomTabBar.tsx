import React, { useRef, useEffect, useState } from 'react';
import { Users, TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck, ClipboardCheck } from 'lucide-react';
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

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

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

  const handleTap = (tabId: string) => {
    if (tabId === activeTab) return;
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(tabId);
  };

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
          className="flex items-end justify-center overflow-x-auto scrollbar-hide px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] gap-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {allTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isFeatured = tab.featured;

            if (isFeatured) {
              return (
                <div
                  key={tab.id}
                  data-tab={tab.id}
                  className="relative flex flex-col items-center min-w-[4.5rem] shrink-0"
                  style={{ marginTop: '-2rem' }}
                >
                  <button
                    onClick={() => handleTap(tab.id)}
                    className="flex flex-col items-center outline-none select-none"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {/* Raised featured button */}
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      animate={isActive ? {
                        scale: [1, 1.08, 1],
                        transition: { duration: 0.5, ease: 'easeOut' }
                      } : { scale: 1 }}
                      className={cn(
                        'relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl',
                        isActive
                          ? 'bg-accent shadow-accent/40'
                          : 'bg-primary shadow-primary/30'
                      )}
                    >
                      {/* Glow */}
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.15, 1] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          className="absolute inset-0 rounded-2xl bg-accent/30 blur-md -z-10"
                        />
                      )}
                      <motion.div
                        animate={isActive ? { rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                      >
                        <Icon
                          size={24}
                          strokeWidth={2.2}
                          className={cn(
                            'relative z-10',
                            isActive ? 'text-accent-foreground' : 'text-primary-foreground'
                          )}
                        />
                      </motion.div>
                    </motion.div>
                    <span
                      className={cn(
                        'text-[10px] leading-none mt-1.5 tracking-tight whitespace-nowrap font-bold',
                        isActive ? 'text-accent' : 'text-muted-foreground/70'
                      )}
                    >
                      {tab.label}
                    </span>
                  </button>
                </div>
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
                  animate={{
                    width: isActive ? 28 : 0,
                    opacity: isActive ? 1 : 0,
                  }}
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
                    className={cn(
                      'transition-colors duration-200',
                      isActive ? 'text-accent' : 'text-muted-foreground/55'
                    )}
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
