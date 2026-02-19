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

  const handleTap = useCallback((id: string) => {
    if (id === activeTab) return;
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(id);
  }, [activeTab, onTabChange]);

  return (
    <motion.div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260, delay: 0.2 }}
    >
      {/* Extra space above for bubbles that float up */}
      <div className="px-3 pb-3">
        {/* Floating pill */}
        <div
          className="relative rounded-[28px] overflow-hidden"
          style={{
            background: 'hsl(var(--card) / 0.96)',
            boxShadow: '0 -2px 0 0 hsl(var(--foreground) / 0.04), 0 8px 32px -4px hsl(var(--foreground) / 0.18), 0 2px 8px -2px hsl(var(--foreground) / 0.10), inset 0 1px 0 hsl(var(--foreground) / 0.06)',
            WebkitBackdropFilter: 'saturate(180%) blur(24px)',
            backdropFilter: 'saturate(180%) blur(24px)',
          }}
        >
          {/* Scroll container */}
          <div
            ref={scrollRef}
            className="flex overflow-x-auto scrollbar-hide"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'none',
              /* Extra top padding so the floating bubble has space inside the pill */
              paddingTop: '14px',
            }}
          >
            {allTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => handleTap(tab.id)}
                  className="relative flex flex-col items-center shrink-0 outline-none select-none pb-3"
                  style={{
                    width: 'calc(100vw / 5.5)',
                    minWidth: '3.5rem',
                    WebkitTapHighlightColor: 'transparent',
                    gap: '5px',
                    alignItems: 'center',
                  }}
                >
                  {/* Icon bubble — translates up when active */}
                  <motion.div
                    animate={{ y: isActive ? -10 : 0 }}
                    transition={{ type: 'spring', damping: 18, stiffness: 320 }}
                    className="relative flex items-center justify-center rounded-full"
                    style={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      background: isActive
                        ? tab.featured
                          ? 'hsl(var(--accent))'
                          : 'hsl(var(--foreground))'
                        : 'transparent',
                      boxShadow: isActive
                        ? tab.featured
                          ? '0 4px 20px hsl(var(--accent) / 0.55), 0 0 0 1px hsl(var(--accent) / 0.25)'
                          : '0 4px 12px hsl(var(--foreground) / 0.25)'
                        : 'none',
                    }}
                  >
                    {/* Glow pulse for featured */}
                    {isActive && tab.featured && (
                      <>
                        <motion.div
                          animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.3, 1] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          className="absolute inset-0 rounded-full blur-md -z-10"
                          style={{ background: 'hsl(var(--accent) / 0.6)' }}
                        />
                        <motion.div
                          animate={{ opacity: [0.1, 0.35, 0.1] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                          className="absolute -inset-3 rounded-full blur-xl -z-20"
                          style={{ background: 'hsl(var(--accent) / 0.4)' }}
                        />
                      </>
                    )}

                    <Icon
                      size={isActive ? 20 : 19}
                      strokeWidth={isActive ? 2.3 : 1.6}
                      className={cn(
                        'transition-colors duration-150',
                        isActive ? 'text-background' : 'text-muted-foreground/55'
                      )}
                    />
                  </motion.div>

                  {/* Label */}
                  <span
                    className={cn(
                      'text-[10px] leading-none tracking-tight whitespace-nowrap',
                      isActive ? 'font-bold text-foreground' : 'font-medium text-muted-foreground/60'
                    )}
                  >
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
