import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck, ClipboardCheck } from 'lucide-react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

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

// Design constants — tweak these to adjust the look
const BAR_HEIGHT   = 58;   // solid bar height
const BUBBLE_R     = 28;   // circle radius (diameter = 56px)
const NOTCH_W      = 88;   // total notch width at bar top
const NOTCH_DEPTH  = 32;   // how deep the notch dips into the bar

// Derived
const BUBBLE_D = BUBBLE_R * 2;
const BUBBLE_RISE = NOTCH_DEPTH + BUBBLE_R - 4; // total rise above bar top

/**
 * Builds an SVG path for the full-width bar with a smooth curved notch
 * (upward bump) centered at `cx`.
 *
 *  ─────╮         ╭─────
 *       ╰────╯
 *   The notch is drawn *above* the bar baseline (negative y).
 */
function buildPath(totalW: number, barH: number, cx: number): string {
  const hw   = NOTCH_W / 2;          // half notch width
  const d    = NOTCH_DEPTH;          // notch depth
  const ctrl = hw * 0.55;            // bezier handle scale

  // Start at top-left, go right until the notch shoulder
  return [
    `M 0 0`,
    `L ${cx - hw} 0`,
    // Left shoulder → bottom of notch
    `C ${cx - hw + ctrl} 0, ${cx - BUBBLE_R} ${-d}, ${cx} ${-d}`,
    // Bottom of notch → right shoulder
    `C ${cx + BUBBLE_R} ${-d}, ${cx + hw - ctrl} 0, ${cx + hw} 0`,
    `L ${totalW} 0`,
    `L ${totalW} ${barH}`,
    `L 0 ${barH}`,
    `Z`,
  ].join(' ');
}

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [barW,    setBarW]    = useState(390);
  const [tabW,    setTabW]    = useState(70);
  const [scrollL, setScrollL] = useState(0);
  const [mounted, setMounted] = useState(false);

  const activeIdx = allTabs.findIndex(t => t.id === activeTab);

  // Notch center = middle of active tab minus scroll offset
  const targetNotchX = activeIdx * tabW + tabW / 2 - scrollL;

  // Spring-animated notch position for smooth SVG morph
  const notchMV = useMotionValue(targetNotchX);
  const notchSpring = useSpring(notchMV, { stiffness: 320, damping: 26 });
  const [notchX, setNotchX] = useState(targetNotchX);

  useEffect(() => {
    notchMV.set(targetNotchX);
  }, [targetNotchX]);

  useEffect(() => {
    return notchSpring.on('change', v => setNotchX(v));
  }, [notchSpring]);

  // Measure container
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      setBarW(w);
      setTabW(Math.max(w / Math.min(allTabs.length, 5.5), 56));
    });
    ro.observe(el);
    setBarW(el.offsetWidth);
    setTabW(Math.max(el.offsetWidth / Math.min(allTabs.length, 5.5), 56));
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  // Auto-scroll active tab into centre
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !tabW) return;
    const center = activeIdx * tabW + tabW / 2;
    el.scrollTo({ left: center - el.offsetWidth / 2, behavior: mounted ? 'smooth' : 'auto' });
  }, [activeIdx, tabW, mounted]);

  const handleScroll = useCallback(() => {
    setScrollL(scrollRef.current?.scrollLeft ?? 0);
  }, []);

  const handleTap = useCallback((id: string) => {
    if (id === activeTab) return;
    if ('vibrate' in navigator) navigator.vibrate(8);
    onTabChange(id);
  }, [activeTab, onTabChange]);

  // Heights
  const aboveBar  = BUBBLE_RISE + 6;           // space above bar for circle
  const totalH    = aboveBar + BAR_HEIGHT;      // wrapper height
  const svgPath   = buildPath(barW, BAR_HEIGHT, notchX);

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <motion.div
        ref={wrapRef}
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260, delay: 0.1 }}
        style={{ position: 'relative', height: totalH }}
      >

        {/* ── SVG bar with animated notch ── */}
        <svg
          width={barW}
          height={totalH}
          viewBox={`0 0 ${barW} ${totalH}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <defs>
            <filter id="nav-shadow" x="-2%" y="-40%" width="104%" height="180%">
              <feDropShadow dx="0" dy="-2" stdDeviation="6"
                floodColor="hsl(var(--foreground))" floodOpacity="0.09" />
            </filter>
          </defs>
          {/* bar translated downward so the notch has room above */}
          <path
            d={svgPath}
            fill="hsl(var(--card))"
            filter="url(#nav-shadow)"
            transform={`translate(0, ${aboveBar})`}
          />
        </svg>

        {/* ── Scrollable tab row ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'visible',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            zIndex: 2,
          } as React.CSSProperties}
        >
          {allTabs.map((tab) => {
            const Icon    = tab.icon;
            const isActive = activeTab === tab.id;
            const color    = tab.featured ? 'hsl(var(--accent))' : 'hsl(var(--primary))';

            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => handleTap(tab.id)}
                style={{
                  width: tabW,
                  minWidth: 56,
                  flexShrink: 0,
                  height: totalH,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingBottom: 10,
                  gap: 0,
                  WebkitTapHighlightColor: 'transparent',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  userSelect: 'none',
                }}
              >
                {/* ── Floating circle ── */}
                <motion.div
                  animate={{
                    y: isActive ? -(BUBBLE_RISE - 2) : 0,
                    scale: isActive ? 1 : 0.75,
                  }}
                  transition={{ type: 'spring', damping: 20, stiffness: 340 }}
                  style={{
                    position: 'absolute',
                    bottom: BAR_HEIGHT - BUBBLE_R + 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: BUBBLE_D,
                    height: BUBBLE_D,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? color : 'transparent',
                    zIndex: 10,
                    boxShadow: isActive
                      ? `0 4px 16px ${color.replace(')', ' / 0.4)').replace('hsl(', 'hsl(')}`
                      : 'none',
                    transition: 'background 0.2s, box-shadow 0.2s',
                  }}
                >
                  {/* Pulse ring for featured */}
                  {isActive && tab.featured && (
                    <motion.div
                      animate={{ opacity: [0.2, 0.55, 0.2], scale: [1, 1.55, 1] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        background: color,
                        opacity: 0.3,
                        filter: 'blur(10px)',
                        zIndex: -1,
                      }}
                    />
                  )}

                  <motion.span
                    animate={{ rotate: isActive ? [0, -14, 14, 0] : 0 }}
                    transition={isActive ? { duration: 0.3, ease: 'easeInOut' } : {}}
                    style={{ display: 'flex' }}
                  >
                    <Icon
                      size={isActive ? 22 : 20}
                      strokeWidth={isActive ? 2.2 : 1.6}
                      style={{
                        color: isActive ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                        transition: 'color 0.18s',
                      }}
                    />
                  </motion.span>
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
                      : 'hsl(var(--muted-foreground) / 0.55)',
                    transition: 'color 0.15s',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    marginTop: 2,
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
