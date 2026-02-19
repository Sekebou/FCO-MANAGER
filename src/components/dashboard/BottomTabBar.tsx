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

// Tab width constant
const TAB_W = `calc(100vw / 5.5)`;
const TAB_MIN = 56; // px
const BUBBLE_SIZE = 52; // px — circle diameter
const LIFT = 26; // px — how much the bubble rises above the pill top

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  // Auto-scroll active tab to center
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
    if ('vibrate' in navigator) navigator.vibrate(8);
    onTabChange(id);
  }, [activeTab, onTabChange]);

  return (
    <motion.div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260, delay: 0.15 }}
    >
      {/* Outer padding — top space reserved for bubbles that pop above */}
      <div className="px-3 pb-3" style={{ paddingTop: LIFT + 8 }}>

        {/* ── Floating pill ── */}
        <div
          className="relative rounded-[28px]"
          style={{
            background: 'hsl(var(--card))',
            boxShadow:
              '0 4px 24px -4px hsl(var(--foreground) / 0.14), 0 1px 4px hsl(var(--foreground) / 0.08), inset 0 1px 0 hsl(var(--foreground) / 0.05)',
            // y-axis overflow must be visible so bubbles can exceed the top edge
            overflowY: 'visible',
            overflowX: 'clip',
          }}
        >
          {/* ── Scroll row ── */}
          <div
            ref={scrollRef}
            style={{
              display: 'flex',
              overflowX: 'auto',
              overflowY: 'visible',
              WebkitOverflowScrolling: 'touch' as any,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            } as React.CSSProperties}
          >
            {allTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => handleTap(tab.id)}
                  className="relative flex flex-col items-center outline-none select-none shrink-0"
                  style={{
                    width: TAB_W,
                    minWidth: TAB_MIN,
                    // Top space = LIFT px (room for the bubble) + padding
                    paddingTop: LIFT + 6,
                    paddingBottom: 10,
                    gap: 4,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {/* ── Floating bubble ── */}
                  <motion.div
                    // Pops above the pill by LIFT px when active
                    animate={{ y: isActive ? -(LIFT + BUBBLE_SIZE / 2 - 4) : 0, scale: isActive ? 1 : 0.8 }}
                    transition={{ type: 'spring', damping: 16, stiffness: 340 }}
                    className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full"
                    style={{
                      top: LIFT / 2,
                      width: BUBBLE_SIZE,
                      height: BUBBLE_SIZE,
                      zIndex: 10,
                      // Filled bubble when active: primary color for featured, accent for others
                      background: isActive
                        ? tab.featured
                          ? 'hsl(var(--accent))'
                          : 'hsl(var(--primary))'
                        : 'hsl(var(--muted))',
                      // box-shadow in card color "cuts" a notch into the pill behind
                      boxShadow: isActive
                        ? tab.featured
                          ? `0 0 0 6px hsl(var(--card)), 0 6px 20px hsl(var(--accent) / 0.5)`
                          : `0 0 0 6px hsl(var(--card)), 0 6px 16px hsl(var(--primary) / 0.35)`
                        : `0 0 0 0px hsl(var(--card))`,
                    }}
                  >
                    {/* Animated glow for featured tab */}
                    {isActive && tab.featured && (
                      <motion.div
                        animate={{ opacity: [0.3, 0.65, 0.3], scale: [1, 1.35, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 rounded-full blur-lg -z-10"
                        style={{ background: 'hsl(var(--accent) / 0.55)' }}
                      />
                    )}

                    <motion.div
                      animate={{ rotate: isActive ? [0, -10, 10, 0] : 0 }}
                      transition={isActive ? { duration: 0.35, ease: 'easeInOut' } : {}}
                    >
                      <Icon
                        size={isActive ? 22 : 18}
                        strokeWidth={isActive ? 2.2 : 1.7}
                        style={{
                          color: isActive ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                          transition: 'color 0.15s',
                        }}
                      />
                    </motion.div>
                  </motion.div>

                  {/* ── Label ── */}
                  <span
                    className="whitespace-nowrap"
                    style={{
                      fontSize: 10,
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: '0.01em',
                      lineHeight: 1,
                      color: isActive
                        ? 'hsl(var(--foreground))'
                        : 'hsl(var(--muted-foreground) / 0.65)',
                      transition: 'color 0.15s, font-weight 0.15s',
                    }}
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
