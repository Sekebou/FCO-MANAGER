import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck, ClipboardCheck } from 'lucide-react';
import { motion } from 'framer-motion';

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

const BUBBLE = 52;   // circle size px
const LIFT   = 28;   // how many px the circle rises above the bar top

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const barRef    = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tabW, setTabW]   = useState(0);
  const [mounted, setMounted] = useState(false);

  const activeIdx = allTabs.findIndex(t => t.id === activeTab);

  /* measure tab width once bar mounts */
  useEffect(() => {
    const measure = () => {
      if (!barRef.current) return;
      const w = barRef.current.offsetWidth;
      setTabW(Math.max(w / Math.min(allTabs.length, 5.5), 56));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  /* auto-scroll active tab to centre */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !tabW) return;
    const centre = activeIdx * tabW + tabW / 2;
    el.scrollTo({ left: centre - el.offsetWidth / 2, behavior: mounted ? 'smooth' : 'auto' });
  }, [activeIdx, tabW, mounted]);

  const handleTap = useCallback((id: string) => {
    if (id === activeTab) return;
    if ('vibrate' in navigator) navigator.vibrate(8);
    onTabChange(id);
  }, [activeTab, onTabChange]);

  /* x position of bubble centre (relative to scroll container) */
  const bubbleX = tabW ? activeIdx * tabW + tabW / 2 : 0;

  return (
    <motion.div
      ref={barRef}
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260, delay: 0.1 }}
    >
      {/* Wrapper that gives space above the bar for the bubble to rise into */}
      <div style={{ position: 'relative', paddingTop: LIFT + BUBBLE / 2 }}>

        {/* ── Solid bar ── */}
        <div
          style={{
            position: 'relative',
            background: 'hsl(var(--card))',
            boxShadow: '0 -2px 16px hsl(var(--foreground) / 0.08)',
            overflow: 'visible',
          }}
        >
          {/* ── Sliding bubble (lives above bar, absolutely positioned) ── */}
          {tabW > 0 && (
            <motion.div
              animate={{ x: bubbleX - BUBBLE / 2 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              style={{
                position: 'absolute',
                top: -(LIFT + BUBBLE / 2),
                left: 0,
                width: BUBBLE,
                height: BUBBLE,
                borderRadius: '50%',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: allTabs[activeIdx]?.featured
                  ? 'hsl(var(--accent))'
                  : 'hsl(var(--primary))',
                /* box-shadow trick: ring matching the page background creates the notch illusion */
                boxShadow: allTabs[activeIdx]?.featured
                  ? `0 0 0 6px hsl(var(--background)), 0 6px 20px hsl(var(--accent) / 0.45)`
                  : `0 0 0 6px hsl(var(--background)), 0 6px 16px hsl(var(--primary) / 0.38)`,
              }}
            >
              {/* Pulse glow for featured tab */}
              {allTabs[activeIdx]?.featured && (
                <motion.div
                  animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.5, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: 'hsl(var(--accent) / 0.4)',
                    filter: 'blur(10px)',
                    zIndex: -1,
                  }}
                />
              )}
              {/* Icon of active tab */}
              {(() => {
                const ActiveIcon = allTabs[activeIdx]?.icon;
                return ActiveIcon ? (
                  <ActiveIcon
                    size={22}
                    strokeWidth={2.2}
                    style={{ color: 'hsl(var(--primary-foreground))' }}
                  />
                ) : null;
              })()}
            </motion.div>
          )}

          {/* ── Scrollable tab strip ── */}
          <div
            ref={scrollRef}
            style={{
              display: 'flex',
              overflowX: 'auto',
              overflowY: 'visible',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            } as React.CSSProperties}
          >
            {allTabs.map((tab) => {
              const Icon     = tab.icon;
              const isActive = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTap(tab.id)}
                  style={{
                    width: tabW || 'auto',
                    minWidth: 56,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: LIFT / 2 + 6,
                    paddingBottom: 12,
                    gap: 4,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {/* Invisible spacer where the bubble sits — keeps label aligned */}
                  <div style={{ width: BUBBLE, height: isActive ? BUBBLE : 20, opacity: 0, flexShrink: 0 }} />

                  {/* Show icon only when NOT active (active icon is in the floating bubble) */}
                  {!isActive && (
                    <Icon
                      size={20}
                      strokeWidth={1.6}
                      style={{ color: 'hsl(var(--muted-foreground))' }}
                    />
                  )}

                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: '0.01em',
                      lineHeight: 1,
                      color: isActive
                        ? 'hsl(var(--foreground))'
                        : 'hsl(var(--muted-foreground) / 0.6)',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.15s',
                      userSelect: 'none',
                      pointerEvents: 'none',
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
