import React, { useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Convocation } from '@/pages/Dashboard';

interface Player {
  id: string;
  name: string;
}

interface Props {
  convocations: Record<string, Convocation>;
  players: Player[];
}

type SafeBounds = {
  left: number;
  right: number;
};

const FIELD_LEFT_PCT = (4 / 68) * 100;
const FIELD_RIGHT_PCT = (64 / 68) * 100;
const PLAYER_SLOT_WIDTH = 48;
const PLAYER_SLOT_HALF = PLAYER_SLOT_WIDTH / 2;
const SAFE_BUFFER_PX = 10;
// Global X offset to visually center players on the pitch (negative = shift left)
const GLOBAL_X_OFFSET = -7;
const DEFAULT_SAFE_BOUNDS: SafeBounds = {
  left: 16 + GLOBAL_X_OFFSET,
  right: 84 + GLOBAL_X_OFFSET,
};

function getSafeBounds(containerWidth: number): SafeBounds {
  if (!containerWidth) return DEFAULT_SAFE_BOUNDS;

  const fieldLeftPx = (containerWidth * FIELD_LEFT_PCT) / 100;
  const fieldRightPx = (containerWidth * FIELD_RIGHT_PCT) / 100;
  const safeLeft = ((fieldLeftPx + PLAYER_SLOT_HALF + SAFE_BUFFER_PX) / containerWidth) * 100;
  const safeRight = ((fieldRightPx - PLAYER_SLOT_HALF - SAFE_BUFFER_PX) / containerWidth) * 100;

  return {
    left: Math.max(FIELD_LEFT_PCT + 3, safeLeft),
    right: Math.min(FIELD_RIGHT_PCT - 3, safeRight),
  };
}

function getPositionCoords(bounds: SafeBounds): Record<string, { x: number; y: number }> {
  const cx = 48.5; // visual center correction (field renders slightly right)
  return {
    'Attaquant': { x: cx, y: 9 },
    'Ailier gauche': { x: bounds.left, y: 15 },
    'Ailier droit': { x: bounds.right, y: 15 },
    'Milieu offensif': { x: cx, y: 31 },
    'Milieu central': { x: cx, y: 43 },
    'Milieu gauche': { x: bounds.left, y: 43 },
    'Milieu droit': { x: bounds.right, y: 43 },
    'Milieu défensif': { x: cx, y: 54 },
    'Latéral gauche': { x: bounds.left, y: 68 },
    'Latéral droit': { x: bounds.right, y: 68 },
    'Défenseur central': { x: cx, y: 68 },
    'Défenseur gauche': { x: cx - 13, y: 68 },
    'Défenseur droit': { x: cx + 13, y: 68 },
    'Gardien': { x: cx, y: 86 },
  };
}

const DEFENSE_POSITIONS = new Set(['Latéral gauche', 'Latéral droit', 'Défenseur central', 'Défenseur gauche', 'Défenseur droit']);
const ATTACK_POSITIONS = new Set(['Attaquant', 'Ailier gauche', 'Ailier droit']);
const MIDFIELD_POSITIONS = new Set(['Milieu offensif', 'Milieu central', 'Milieu gauche', 'Milieu droit', 'Milieu défensif']);

const DEF_ORDER: Record<string, number> = {
  'Latéral gauche': 0,
  'Défenseur gauche': 1,
  'Défenseur central': 2,
  'Défenseur droit': 3,
  'Latéral droit': 4,
};

const ATK_ORDER: Record<string, number> = {
  'Ailier gauche': 0,
  'Attaquant': 1,
  'Ailier droit': 2,
};

function distributeEvenly(count: number, left: number, right: number, compact?: boolean): number[] {
  const mid = (left + right) / 2;
  if (count === 1) return [mid];
  // For lines with 4+ players, use tighter bounds
  const margin = compact ? (right - left) * 0.08 : 0;
  const l = left + margin;
  const r = right - margin;
  return Array.from({ length: count }, (_, i) => l + ((r - l) / (count - 1)) * i);
}

function getSpreadCoords(basePlayers: { id: string; name: string; conv: Convocation }[], bounds: SafeBounds) {
  const coords = getPositionCoords(bounds);
  const result: { id: string; name: string; conv: Convocation; x: number; y: number }[] = [];
  const handledIds = new Set<string>();

  const defenseLine = basePlayers
    .filter((p) => DEFENSE_POSITIONS.has(p.conv.position || ''))
    .sort((a, b) => (DEF_ORDER[a.conv.position || ''] ?? 2) - (DEF_ORDER[b.conv.position || ''] ?? 2));

  if (defenseLine.length >= 1) {
    const xs = distributeEvenly(defenseLine.length, bounds.left, bounds.right, defenseLine.length >= 4);
    defenseLine.forEach((p, i) => {
      result.push({ ...p, x: xs[i], y: 68 });
      handledIds.add(p.id);
    });
  }

  const attackLine = basePlayers
    .filter((p) => ATTACK_POSITIONS.has(p.conv.position || ''))
    .sort((a, b) => (ATK_ORDER[a.conv.position || ''] ?? 1) - (ATK_ORDER[b.conv.position || ''] ?? 1));

  if (attackLine.length >= 1) {
    const xs = distributeEvenly(attackLine.length, bounds.left, bounds.right, attackLine.length >= 3);
    attackLine.forEach((p, i) => {
      result.push({ ...p, x: xs[i], y: 15 });
      handledIds.add(p.id);
    });
  }

  const midGroups: Record<string, typeof basePlayers> = {};
  basePlayers
    .filter((p) => MIDFIELD_POSITIONS.has(p.conv.position || '') && !handledIds.has(p.id))
    .forEach((p) => {
      const pos = p.conv.position || '';
      if (!midGroups[pos]) midGroups[pos] = [];
      midGroups[pos].push(p);
    });

  Object.entries(midGroups).forEach(([pos, group]) => {
    const base = coords[pos] || { x: 50, y: 45 };
    if (group.length === 1) {
      result.push({ ...group[0], x: base.x, y: base.y });
    } else {
      const xs = distributeEvenly(group.length, bounds.left, bounds.right);
      group.forEach((p, i) => {
        result.push({ ...p, x: xs[i], y: base.y });
      });
    }
    group.forEach((p) => handledIds.add(p.id));
  });

  basePlayers
    .filter((p) => !handledIds.has(p.id))
    .forEach((p) => {
      const base = coords[p.conv.position || ''] || { x: 50, y: 50 };
      result.push({ ...p, x: base.x, y: base.y });
    });

  return result;
}

/** Modern jersey SVG with gradient & shine */
const JerseyIcon: React.FC<{ number: string | number; isGk?: boolean; isSelected?: boolean; index: number }> = ({ number, isGk, isSelected, index }) => {
  const id = `jersey-grad-${index}`;
  return (
    <motion.svg
      viewBox="0 0 40 44"
      width="34"
      height="38"
      className="filter drop-shadow-lg"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: isSelected ? 1.15 : 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: index * 0.03 }}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          {isGk ? (
            <>
              <stop offset="0%" stopColor="hsl(75 70% 50%)" />
              <stop offset="100%" stopColor="hsl(90 55% 35%)" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="hsl(230 75% 30%)" />
              <stop offset="100%" stopColor="hsl(235 65% 18%)" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="20" cy="43" rx="12" ry="2" fill="rgba(0,0,0,0.2)" />
      {/* Jersey body */}
      <path
        d="M 9 0 L 0 9 L 0 17 L 7 14.5 L 7 41 Q 7 43 9 43 L 31 43 Q 33 43 33 41 L 33 14.5 L 40 17 L 40 9 L 31 0 L 26 5.5 Q 23 9 20 9 Q 17 9 14 5.5 Z"
        fill={`url(#${id})`}
        stroke={isSelected ? 'hsl(45 100% 65%)' : 'rgba(255,255,255,0.15)'}
        strokeWidth={isSelected ? 1.8 : 0.6}
      />
      {/* Shine overlay */}
      <path
        d="M 9 0 L 0 9 L 0 17 L 7 14.5 L 7 41 Q 7 43 9 43 L 31 43 Q 33 43 33 41 L 33 14.5 L 40 17 L 40 9 L 31 0 L 26 5.5 Q 23 9 20 9 Q 17 9 14 5.5 Z"
        fill={`url(#${id}-shine)`}
      />
      {/* Collar detail */}
      <path
        d="M 14 5.5 Q 17 9 20 9 Q 23 9 26 5.5"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.8"
      />
      {/* Number */}
      <text
        x="20"
        y="31"
        textAnchor="middle"
        fill="white"
        fontSize="15"
        fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="0.5"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
      >
        {number}
      </text>
    </motion.svg>
  );
};

const PitchView = forwardRef<HTMLDivElement, Props>(({ convocations, players }, ref) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [pitchWidth, setPitchWidth] = useState(0);
  const pitchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = pitchContainerRef.current;
    if (!element) return;

    const updateWidth = () => setPitchWidth(element.clientWidth);
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const convokedPlayers = Object.entries(convocations)
    .filter(([, conv]) => conv.status === 'convoque' && conv.position)
    .map(([playerId, conv]) => {
      const player = players.find((p) => p.id === playerId);
      return player ? { id: playerId, name: player.name, conv } : null;
    })
    .filter(Boolean) as { id: string; name: string; conv: Convocation }[];

  const bounds = useMemo(() => getSafeBounds(pitchWidth), [pitchWidth]);
  const positioned = useMemo(() => getSpreadCoords(convokedPlayers, bounds), [convokedPlayers, bounds]);
  const selected = selectedPlayer ? positioned.find((p) => p.id === selectedPlayer) : null;

  if (convokedPlayers.length === 0) return null;

  return (
    <div ref={ref}>
      <div
        ref={pitchContainerRef}
        className="relative mx-auto w-full max-w-sm rounded-2xl overflow-visible shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
        style={{ aspectRatio: '9 / 13' }}
        onClick={() => setSelectedPlayer(null)}
      >
        {/* Horizontal grass stripes with subtle gradient */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          {[...Array(18)].map((_, i) => (
            <div
              key={i}
              className="w-full"
              style={{
                height: `${100 / 18}%`,
                backgroundColor: i % 2 === 0 ? 'hsl(130 38% 40%)' : 'hsl(130 38% 35%)',
              }}
            />
          ))}
          {/* Vignette overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.2) 100%)',
            }}
          />
        </div>

        {/* Pitch markings */}
        <svg viewBox="0 0 68 98" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {/* Field outline */}
          <rect x="4" y="2" width="60" height="94" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" rx="0.3" />
          {/* Midfield line */}
          <line x1="4" y1="2.5" x2="64" y2="2.5" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
          {/* Center circle arc */}
          <path d="M 25 2.5 A 9 9 0 0 1 43 2.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
          <circle cx="34" cy="2.5" r="0.5" fill="rgba(255,255,255,0.5)" />
          {/* Penalty area */}
          <rect x="14" y="70" width="40" height="26" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
          {/* Goal area */}
          <rect x="22" y="84" width="24" height="12" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
          {/* Penalty spot */}
          <circle cx="34" cy="76" r="0.4" fill="rgba(255,255,255,0.35)" />
          {/* Penalty arc */}
          <path d="M 25.5 70 A 9 9 0 0 0 42.5 70" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
          {/* Goal net effect */}
          <rect x="26" y="96" width="16" height="2" rx="0.5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.3" />
          {/* Corner arcs */}
          <path d="M 4 4 A 2 2 0 0 1 6 2" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
          <path d="M 62 2 A 2 2 0 0 1 64 4" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
        </svg>

        {/* Corner flags with wind animation */}
        {[
          { x: '5%', y: '1%' },
          { x: '93%', y: '1%' },
          { x: '5%', y: '95%' },
          { x: '93%', y: '95%' },
        ].map((pos, i) => (
          <div key={`flag-${i}`} className="absolute" style={{ left: pos.x, top: pos.y, zIndex: 5 }}>
            {/* Pole */}
            <div className="mx-auto h-[18px] w-[2px] rounded-full bg-white/60" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
            {/* Flag with wind keyframes */}
            <motion.div
              className="absolute -top-[1px] left-[2px] origin-left"
              animate={{
                rotateZ: [0, 8, -4, 6, -2, 0],
                scaleX: [1, 1.08, 0.95, 1.05, 0.98, 1],
                skewY: [0, 3, -2, 2, -1, 0],
              }}
              transition={{
                duration: 2.5 + i * 0.3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <svg width="14" height="10" viewBox="0 0 14 10">
                <defs>
                  <linearGradient id={`flag-g-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(0 80% 50%)" />
                    <stop offset="100%" stopColor="hsl(0 70% 40%)" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M 0 0 Q 5 1.5 7 0 Q 11 -0.5 14 1 L 13 5 Q 10 6.5 7 5 Q 4 3.5 0 5 Z"
                  fill={`url(#flag-g-${i})`}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="0.3"
                  animate={{
                    d: [
                      'M 0 0 Q 5 1.5 7 0 Q 11 -0.5 14 1 L 13 5 Q 10 6.5 7 5 Q 4 3.5 0 5 Z',
                      'M 0 0 Q 4 -1 8 1 Q 11 2 14 0.5 L 13.5 5.5 Q 10 4 7 5.5 Q 3 7 0 5 Z',
                      'M 0 0 Q 5 2 7 0.5 Q 10 -1 14 1.5 L 12.5 5 Q 9 6 7 4.5 Q 4 3 0 5 Z',
                      'M 0 0 Q 5 1.5 7 0 Q 11 -0.5 14 1 L 13 5 Q 10 6.5 7 5 Q 4 3.5 0 5 Z',
                    ],
                  }}
                  transition={{
                    duration: 2.5 + i * 0.3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </svg>
            </motion.div>
          </div>
        ))}

        {/* Players */}
        {positioned.map((p, idx) => {
          const isSelected = selectedPlayer === p.id;
          const isGk = p.conv.position === 'Gardien';
          const lastName = p.name.split(' ').pop() || p.name;
          return (
            <motion.div
              key={p.id}
              className="absolute z-10 flex w-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlayer(isSelected ? null : p.id);
              }}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
            >
              <JerseyIcon number={p.conv.number || '?'} isGk={isGk} isSelected={isSelected} index={idx} />
              <span
                className="w-full truncate rounded px-1 py-0.5 text-center text-[8px] font-bold leading-none text-white"
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(4px)',
                  marginTop: '1px',
                  letterSpacing: '0.02em',
                }}
              >
                {lastName}
              </span>
            </motion.div>
          );
        })}

        {/* Player detail popup */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute z-30 rounded-2xl shadow-2xl p-3.5 w-[160px]"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(15,15,25,0.92)',
                backdropFilter: 'blur(16px) saturate(1.5)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-bold text-sm text-white">{selected.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: selected.conv.position === 'Gardien'
                      ? 'rgba(132,204,22,0.2)'
                      : 'rgba(59,130,246,0.2)',
                    color: selected.conv.position === 'Gardien'
                      ? 'hsl(85 70% 60%)'
                      : 'hsl(215 90% 70%)',
                  }}
                >
                  {selected.conv.position}
                </span>
                {selected.conv.number && (
                  <span className="text-[10px] font-bold text-white/60">
                    N°{selected.conv.number}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

PitchView.displayName = 'PitchView';

export default PitchView;
