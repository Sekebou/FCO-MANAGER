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

const BAR_HEIGHT = 62;
const BUBBLE = 54;
const NOTCH_SPREAD = 40;   // half-width of the notch curve
const NOTCH_DEPTH = 26;    // how deep the curve goes (below bar top)
const RISE = NOTCH_DEPTH + BUBBLE / 2 - 6; // bubble rise above bar top

/** Build a smooth SVG path for the bar with an upward notch at cx */
function buildBarPath(w: number, h: number, cx: number): string {
  const s = NOTCH_SPREAD;
  const d = NOTCH_DEPTH;
  // Smooth bezier notch
  return [
    `M0,0`,
    `L${cx - s - 12},0`,
    `C${cx - s},0 ${cx - s * 0.5},${-d} ${cx},${-d}`,
    `C${cx + s * 0.5},${-d} ${cx + s},0 ${cx + s + 12},0`,
    `L${w},0`,
    `L${w},${h}`,
    `L0,${h}`,
    `Z`,
  ].join(' ');
}

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [barWidth, setBarWidth] = useState(390);
  const [scrollLeft, setScrollLeft] = useState(0);
  const tabWidth = Math.max(barWidth / Math.min(allTabs.length, 5.5), 56);

  const activeIndex = allTabs.findIndex(t => t.id === activeTab);

  // Notch X = center of active tab minus scroll offset
  const notchX = activeIndex * tabWidth + tabWidth / 2 - scrollLeft;

  // Container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarWidth(el.offsetWidth));
    ro.observe(el);
    setBarWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  // Auto-scroll active tab to center
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const center = activeIndex * tabWidth + tabWidth / 2;
    el.scrollTo({ left: center - el.offsetWidth / 2, behavior: mounted ? 'smooth' : 'auto' });
  }, [activeIndex, tabWidth, mounted]);

  const handleScroll = useCallback(() => {
    setScrollLeft(scrollRef.current?.scrollLeft ?? 0);
  }, []);

  const handleTap = useCallback((id: string) => {
    if (id === activeTab) return;
    if ('vibrate' in navigator) navigator.vibrate(8);
    onTabChange(id);
  }, [activeTab, onTabChange]);

  // Total SVG height = bar + space above for bubble
  const svgOverflow = RISE + BUBBLE / 2 + 4;
  const svgH = BAR_HEIGHT + svgOverflow;

  const path = buildBarPath(barWidth, BAR_HEIGHT, notchX);

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <motion.div
        ref={containerRef}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260, delay: 0.1 }}
        style={{ position: 'relative', height: svgH }}
      >
        {/* ── SVG background bar with animated notch ── */}
        <svg
          width={barWidth}
          height={svgH}
          viewBox={`0 0 ${barWidth} ${svgH}`}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            pointerEvents: 'none',
            overflow: 'visible',
            filter: 'drop-shadow(0 -3px 12px hsl(var(--foreground) / 0.10))',
          }}
        >
          <motion.path
            d={path}
            fill="hsl(var(--card))"
            transform={`translate(0, ${svgOverflow})`}
            animate={{ d: path }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          />
        </svg>

        {/* ── Scrollable tabs ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'visible',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: svgH,
            zIndex: 2,
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
                style={{
                  width: tabWidth,
                  minWidth: 56,
                  flexShrink: 0,
                  height: svgH,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingBottom: 10,
                  gap: 4,
                  WebkitTapHighlightColor: 'transparent',
                  outline: 'none',
                  background: 'transparent',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {/* ── Floating bubble ── */}
                <motion.div
                  animate={{
                    y: isActive ? -(RISE) : 0,
                    scale: isActive ? 1 : 0.78,
                  }}
                  transition={{ type: 'spring', damping: 18, stiffness: 330 }}
                  style={{
                    position: 'absolute',
                    // Start at bar top + half bubble
                    bottom: BAR_HEIGHT - BUBBLE / 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: BUBBLE,
                    height: BUBBLE,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive
                      ? tab.featured
                        ? 'hsl(var(--accent))'
                        : 'hsl(var(--primary))'
                      : 'hsl(var(--muted))',
                    zIndex: 10,
                    boxShadow: isActive
                      ? tab.featured
                        ? `0 6px 20px hsl(var(--accent) / 0.45)`
                        : `0 6px 18px hsl(var(--primary) / 0.38)`
                      : 'none',
                    transition: 'background 0.2s, box-shadow 0.2s',
                  }}
                >
                  {/* Glow ring for featured */}
                  {isActive && tab.featured && (
                    <motion.div
                      animate={{ opacity: [0.25, 0.6, 0.25], scale: [1, 1.45, 1] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        background: 'hsl(var(--accent) / 0.45)',
                        filter: 'blur(12px)',
                        zIndex: -1,
                      }}
                    />
                  )}

                  <motion.div
                    animate={{ rotate: isActive ? [0, -12, 12, 0] : 0 }}
                    transition={isActive ? { duration: 0.28, ease: 'easeInOut' } : {}}
                  >
                    <Icon
                      size={isActive ? 22 : 20}
                      strokeWidth={isActive ? 2.2 : 1.6}
                      style={{
                        color: isActive
                          ? 'hsl(var(--primary-foreground))'
                          : 'hsl(var(--muted-foreground))',
                        transition: 'color 0.18s',
                      }}
                    />
                  </motion.div>
                </motion.div>

                {/* ── Label ── */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.01em',
                    lineHeight: 1,
                    color: isActive
                      ? 'hsl(var(--foreground))'
                      : 'hsl(var(--muted-foreground) / 0.6)',
                    transition: 'color 0.15s',
                    whiteSpace: 'nowrap',
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
      </motion.div>
    </div>
  );
};

export default React.memo(BottomTabBar);
