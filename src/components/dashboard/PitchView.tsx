import React, { useEffect, useMemo, useRef, useState, useCallback, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Move, Check, RotateCcw, ArrowLeftRight, ChevronDown, UserRoundX, UserPlus, Trash2, Settings2, ChevronRight, Hash, AlertTriangle } from 'lucide-react';
import type { Convocation } from '@/pages/Dashboard';
import { POSITIONS } from '@/pages/Dashboard';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface Player {
  id: string;
  name: string;
}

interface Props {
  convocations: Record<string, Convocation>;
  players: Player[];
  isManager?: boolean;
  onUpdateConvocations?: (updated: Record<string, Convocation>) => void;
  onSwapPlayer?: (playerId: string, playerName: string, conv: Convocation) => void;
  onRemovePlayer?: (playerId: string, playerName: string) => void;
  onAddPlayer?: () => void;
}

// Single unified coordinate system — all positions are percentages within the pitch container
// Based on SVG viewBox 68x98: field lines at x=4..64, y=2..96
const BOUNDS = {
  left: (4 / 68) * 100 + 4,    // ~9.9%  — left field line + margin for player width
  right: (64 / 68) * 100 - 4,  // ~90.1% — right field line - margin
  top: (2 / 98) * 100 + 1,     // ~3%    — top line + margin
  bottom: (96 / 98) * 100 - 1, // ~97%   — bottom line - margin
};

const CX = (BOUNDS.left + BOUNDS.right) / 2; // true center of the field

function getPositionCoords(): Record<string, { x: number; y: number }> {
  return {
    'Attaquant': { x: CX, y: 9 },
    'Ailier gauche': { x: BOUNDS.left, y: 15 },
    'Ailier droit': { x: BOUNDS.right, y: 15 },
    'Milieu offensif': { x: CX, y: 31 },
    'Milieu central': { x: CX, y: 43 },
    'Milieu gauche': { x: BOUNDS.left, y: 43 },
    'Milieu droit': { x: BOUNDS.right, y: 43 },
    'Milieu défensif': { x: CX, y: 54 },
    'Latéral gauche': { x: BOUNDS.left, y: 68 },
    'Latéral droit': { x: BOUNDS.right, y: 68 },
    'Défenseur central': { x: CX, y: 68 },
    'Défenseur gauche': { x: CX - 13, y: 68 },
    'Défenseur droit': { x: CX + 13, y: 68 },
    'Gardien': { x: CX, y: 86 },
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

// Default position based on jersey number (standard football conventions)
function getDefaultPositionFromNumber(num?: number): string {
  if (!num) return '';
  switch (num) {
    case 1: return 'Gardien';
    case 2: return 'Latéral droit';
    case 3: return 'Latéral gauche';
    case 4: return 'Défenseur central';
    case 5: return 'Défenseur central';
    case 6: return 'Milieu défensif';
    case 7: return 'Ailier droit';
    case 8: return 'Milieu central';
    case 9: return 'Attaquant';
    case 10: return 'Milieu offensif';
    case 11: return 'Ailier gauche';
    default: return '';
  }
}

function distributeEvenly(count: number, left: number, right: number, compact?: boolean): number[] {
  const mid = (left + right) / 2;
  if (count === 1) return [mid];
  const margin = compact ? (right - left) * 0.08 : 0;
  const l = left + margin;
  const r = right - margin;
  return Array.from({ length: count }, (_, i) => l + ((r - l) / (count - 1)) * i);
}

function getSpreadCoords(basePlayers: { id: string; name: string; conv: Convocation }[]) {
  const coords = getPositionCoords();
  const result: { id: string; name: string; conv: Convocation; x: number; y: number }[] = [];
  const handledIds = new Set<string>();

  // Resolve effective position: use explicit position, or infer from jersey number
  const withPosition = basePlayers.map(p => {
    const pos = p.conv.position || getDefaultPositionFromNumber(p.conv.number);
    return { ...p, conv: { ...p.conv, position: pos } };
  });

  const defenseLine = withPosition
    .filter((p) => DEFENSE_POSITIONS.has(p.conv.position || ''))
    .sort((a, b) => (DEF_ORDER[a.conv.position || ''] ?? 2) - (DEF_ORDER[b.conv.position || ''] ?? 2));

  if (defenseLine.length >= 1) {
    const xs = distributeEvenly(defenseLine.length, BOUNDS.left, BOUNDS.right, defenseLine.length >= 4);
    defenseLine.forEach((p, i) => {
      result.push({ ...p, x: xs[i], y: 68 });
      handledIds.add(p.id);
    });
  }

  const attackLine = withPosition
    .filter((p) => ATTACK_POSITIONS.has(p.conv.position || ''))
    .sort((a, b) => (ATK_ORDER[a.conv.position || ''] ?? 1) - (ATK_ORDER[b.conv.position || ''] ?? 1));

  if (attackLine.length >= 1) {
    const xs = distributeEvenly(attackLine.length, BOUNDS.left, BOUNDS.right, attackLine.length >= 3);
    attackLine.forEach((p, i) => {
      result.push({ ...p, x: xs[i], y: 15 });
      handledIds.add(p.id);
    });
  }

  const midGroups: Record<string, typeof withPosition> = {};
  withPosition
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
      const xs = distributeEvenly(group.length, BOUNDS.left, BOUNDS.right);
      group.forEach((p, i) => {
        result.push({ ...p, x: xs[i], y: base.y });
      });
    }
    group.forEach((p) => handledIds.add(p.id));
  });

  withPosition
    .filter((p) => !handledIds.has(p.id))
    .forEach((p) => {
      const base = coords[p.conv.position || ''] || { x: 50, y: 50 };
      result.push({ ...p, x: base.x, y: base.y });
    });

  return result;
}

/** Modern jersey SVG with gradient & shine */
const JerseyIcon: React.FC<{ number: string | number; isGk?: boolean; isSelected?: boolean; index: number; isDragging?: boolean }> = ({ number, isGk, isSelected, index, isDragging }) => {
  const id = `jersey-grad-${index}`;
  return (
    <motion.svg
      viewBox="0 0 40 44"
      width="34"
      height="38"
      className="filter drop-shadow-lg pointer-events-none"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: isDragging ? 1.2 : isSelected ? 1.15 : 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: isDragging ? 0 : index * 0.03 }}
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
      <ellipse cx="20" cy="43" rx="12" ry="2" fill="rgba(0,0,0,0.2)" />
      <path
        d="M 9 0 L 0 9 L 0 17 L 7 14.5 L 7 41 Q 7 43 9 43 L 31 43 Q 33 43 33 41 L 33 14.5 L 40 17 L 40 9 L 31 0 L 26 5.5 Q 23 9 20 9 Q 17 9 14 5.5 Z"
        fill={`url(#${id})`}
        stroke={isDragging ? 'hsl(200 100% 65%)' : isSelected ? 'hsl(45 100% 65%)' : 'rgba(255,255,255,0.15)'}
        strokeWidth={isDragging ? 2 : isSelected ? 1.8 : 0.6}
      />
      <path
        d="M 9 0 L 0 9 L 0 17 L 7 14.5 L 7 41 Q 7 43 9 43 L 31 43 Q 33 43 33 41 L 33 14.5 L 40 17 L 40 9 L 31 0 L 26 5.5 Q 23 9 20 9 Q 17 9 14 5.5 Z"
        fill={`url(#${id}-shine)`}
      />
      <path
        d="M 14 5.5 Q 17 9 20 9 Q 23 9 26 5.5"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.8"
      />
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

/** Draggable player wrapper — uses pointer events for reliable touch/mouse drag */
const DraggablePlayer: React.FC<{
  playerId: string;
  startX: number;
  startY: number;
  containerRef: React.RefObject<HTMLDivElement>;
  onDragEnd: (id: string, newX: number, newY: number) => void;
  children: (isDragging: boolean) => React.ReactNode;
}> = ({ playerId, startX, startY, containerRef, onDragEnd, children }) => {
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: startX, y: startY });
  const posRef = useRef({ x: startX, y: startY });
  const dragStart = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);

  // Sync position when props change (after save or cancel)
  useEffect(() => {
    setPos({ x: startX, y: startY });
    posRef.current = { x: startX, y: startY };
  }, [startX, startY]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: posRef.current.x,
      startY: posRef.current.y,
    };
    setDragging(true);
  }, [containerRef]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dx = e.clientX - dragStart.current.pointerX;
    const dy = e.clientY - dragStart.current.pointerY;
    const dxPct = (dx / rect.width) * 100;
    const dyPct = (dy / rect.height) * 100;

    let newX = dragStart.current.startX + dxPct;
    let newY = dragStart.current.startY + dyPct;

    // Clamp to field lines — prevent dragging into bench area
    newX = Math.max(BOUNDS.left, Math.min(BOUNDS.right, newX));
    const maxY = BOUNDS.bottom * 0.8125; // limit to field area
    newY = Math.max(BOUNDS.top, Math.min(maxY, newY));

    const newPos = { x: newX, y: newY };
    posRef.current = newPos;
    setPos(newPos);
  }, [containerRef]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    e.preventDefault();
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    dragStart.current = null;
    setDragging(false);
    const finalPos = posRef.current;
    onDragEnd(playerId, Math.round(finalPos.x * 10) / 10, Math.round(finalPos.y * 10) / 10);
  }, [playerId, onDragEnd]);

  return (
    <div
      className={`absolute z-10 flex w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center touch-none ${dragging ? 'z-20 cursor-grabbing' : 'cursor-grab'}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {children(dragging)}
    </div>
  );
};

const PitchView = forwardRef<HTMLDivElement, Props>(({ convocations, players, isManager = false, onUpdateConvocations, onSwapPlayer, onRemovePlayer, onAddPlayer }, ref) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [compoMenuOpen, setCompoMenuOpen] = useState(false);
  const [compoAction, setCompoAction] = useState<null | 'swap' | 'remove'>(null);
  const swapPickMode = compoAction === 'swap';
  const removePickMode = compoAction === 'remove';
  useBodyScrollLock(compoMenuOpen || swapPickMode || removePickMode || renumberOpen);
  const [localConvocations, setLocalConvocations] = useState(convocations);
  const [hasChanges, setHasChanges] = useState(false);
  const saveTimestampRef = useRef(0);
  const pitchContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [renumberOpen, setRenumberOpen] = useState(false);

  // Track container width for accurate popup positioning
  useEffect(() => {
    const el = pitchContainerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync local convocations when prop changes (and not in edit mode)
  // After a save, ignore prop updates for 3s to avoid overwriting with stale data
  useEffect(() => {
    if (!editMode && Date.now() - saveTimestampRef.current > 3000) {
      setLocalConvocations(convocations);
    }
  }, [convocations, editMode]);

  const allConvokedPlayers = Object.entries(localConvocations)
    .filter(([, conv]) => conv.status === 'convoque')
    .map(([playerId, conv]) => {
      const player = players.find((p) => p.id === playerId);
      const name = conv.virtualName || player?.name || 'Joueur supprimé';
      return { id: playerId, name, conv };
    })
    .filter(Boolean) as { id: string; name: string; conv: Convocation }[];

  const convokedPlayers = allConvokedPlayers.filter((p) => !p.conv.number || p.conv.number <= 11);
  const substitutePlayers = allConvokedPlayers
    .filter((p) => p.conv.number != null && p.conv.number >= 12)
    .sort((a, b) => (a.conv.number ?? 99) - (b.conv.number ?? 99));

  // For players with customX/customY, use those; otherwise use computed positions
  const positioned = useMemo(() => {
    const computed = getSpreadCoords(convokedPlayers);
    return computed.map((p) => {
      const conv = localConvocations[p.id];
      if (conv?.customX != null && conv?.customY != null) {
        return { ...p, x: conv.customX, y: conv.customY };
      }
      return p;
    });
  }, [convokedPlayers, localConvocations]);

  const selected = selectedPlayer
    ? positioned.find((p) => p.id === selectedPlayer) || substitutePlayers.find((p) => p.id === selectedPlayer)
    : null;

  const handlePlayerDragEnd = useCallback((playerId: string, newX: number, newY: number) => {
    setLocalConvocations((prev) => {
      const updated = { ...prev };
      updated[playerId] = { ...updated[playerId], customX: newX, customY: newY };
      return updated;
    });
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (onUpdateConvocations && hasChanges) {
      onUpdateConvocations(localConvocations);
    }
    saveTimestampRef.current = Date.now();
    setEditMode(false);
    setHasChanges(false);
  }, [localConvocations, onUpdateConvocations, hasChanges]);

  const handleCancelEdit = useCallback(() => {
    setLocalConvocations(convocations);
    setEditMode(false);
    setHasChanges(false);
  }, [convocations]);

  const handleResetPositions = useCallback(() => {
    // Remove all customX/customY to reset to auto layout
    setLocalConvocations((prev) => {
      const updated: Record<string, Convocation> = {};
      for (const [id, conv] of Object.entries(prev)) {
        const { customX, customY, ...rest } = conv;
        updated[id] = rest;
      }
      return updated;
    });
    setHasChanges(true);
  }, []);

  if (allConvokedPlayers.length === 0) return null;

  return (
    <div ref={ref}>
      {/* Edit mode toggle for coaches */}
      {isManager && onUpdateConvocations && (
        <div className="flex items-center justify-end gap-2 mb-2">
          {editMode ? (
            <>
              <button
                onClick={handleResetPositions}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <RotateCcw size={11} />
                Réinitialiser
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Check size={12} />
                Valider
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Move size={12} />
                Modifier la disposition
              </button>
              {(onSwapPlayer || onRemovePlayer || onAddPlayer) && (
                <button
                  onClick={() => setCompoMenuOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                >
                  <Settings2 size={12} />
                  Modifier compo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div
        ref={pitchContainerRef}
        className={`relative mx-auto w-full max-w-sm rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.25)] ${editMode ? 'ring-2 ring-primary/40' : ''}`}
        style={{ aspectRatio: substitutePlayers.length > 0 ? '9 / 15' : '9 / 13' }}
        onClick={() => !editMode && setSelectedPlayer(null)}
      >
        {/* Horizontal grass stripes — field area */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          {/* Grass area takes top portion */}
          <div className="absolute top-0 left-0 right-0 overflow-hidden" style={{ height: substitutePlayers.length > 0 ? '85%' : '100%' }}>
            {[...Array(18)].map((_, i) => (
              <div
                key={i}
                className="w-full"
                style={{
                  height: `${100 / 18}%`,
                  background: i % 2 === 0
                    ? 'linear-gradient(180deg, hsl(135 42% 44%) 0%, hsl(132 40% 40%) 100%)'
                    : 'linear-gradient(180deg, hsl(135 42% 38%) 0%, hsl(132 40% 34%) 100%)',
                }}
              />
            ))}
            {/* Subtle vignette + sun highlight */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.08) 0%, transparent 55%), radial-gradient(ellipse at 50% 60%, transparent 45%, rgba(0,0,0,0.28) 100%)',
              }}
            />
            {/* Texture noise overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
              style={{
                backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/></filter><rect width=\'120\' height=\'120\' filter=\'url(%23n)\'/></svg>")',
              }}
            />
          </div>
          {/* Bench area at the bottom */}
          {substitutePlayers.length > 0 && (
            <div
              className="absolute left-0 right-0 bottom-0"
              style={{
                height: '15%',
                background: 'white',
                borderTop: '2px solid hsl(var(--border))',
              }}
            />
          )}
        </div>

        {/* Pitch markings — positioned in the field area only */}
        <svg
          viewBox="0 0 68 98"
          className="absolute h-full w-full"
          style={{
            top: 0,
            left: 0,
            height: substitutePlayers.length > 0 ? '85%' : '100%',
          }}
          preserveAspectRatio="none"
        >
          <rect x="4" y="2" width="60" height="94" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.3" rx="0.3" />
          <line x1="4" y1="2.5" x2="64" y2="2.5" stroke="rgba(255,255,255,0.25)" strokeWidth="0.28" />
          <path d="M 25 2.5 A 9 9 0 0 1 43 2.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
          <circle cx="34" cy="2.5" r="0.45" fill="rgba(255,255,255,0.4)" />
          <rect x="14" y="70" width="40" height="26" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
          <rect x="22" y="84" width="24" height="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
          <circle cx="34" cy="76" r="0.4" fill="rgba(255,255,255,0.35)" />
          <path d="M 25.5 70 A 9 9 0 0 0 42.5 70" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
          <rect x="26" y="96" width="16" height="2" rx="0.5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.25" />
          <path d="M 4 4 A 2 2 0 0 1 6 2" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.25" />
          <path d="M 62 2 A 2 2 0 0 1 64 4" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.25" />
        </svg>

        {/* Corner flags — in field area */}
        {[
          { x: '5%', y: '1%' },
          { x: '93%', y: '1%' },
          { x: '5%', y: substitutePlayers.length > 0 ? '81%' : '95%' },
          { x: '93%', y: substitutePlayers.length > 0 ? '81%' : '95%' },
        ].map((pos, i) => (
          <div key={`flag-${i}`} className="absolute" style={{ left: pos.x, top: pos.y, zIndex: 5 }}>
            <div className="mx-auto h-[18px] w-[2px] rounded-full bg-white/60" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
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

        {/* Edit mode indicator */}
        {editMode && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-bold tracking-wide shadow-lg whitespace-nowrap">
            Glissez les joueurs
          </div>
        )}

        {/* Players on field — scale positions to field area */}
        {positioned.map((p, idx) => {
          const isSelected = selectedPlayer === p.id;
          const isGk = (p.conv.position || getDefaultPositionFromNumber(p.conv.number)) === 'Gardien';
          const lastName = p.name.split(' ').pop() || p.name;
          // Scale Y coordinates to the field portion only
          const scaledY = substitutePlayers.length > 0 ? p.y * 0.85 : p.y;

          if (editMode) {
            return (
              <DraggablePlayer
                key={p.id}
                playerId={p.id}
                startX={p.x}
                startY={scaledY}
                containerRef={pitchContainerRef as React.RefObject<HTMLDivElement>}
                onDragEnd={(id, newX, newY) => {
                  // Convert back to field coordinates
                  const fieldY = substitutePlayers.length > 0 ? newY / 0.85 : newY;
                  handlePlayerDragEnd(id, newX, fieldY);
                }}
              >
                {(isDragging) => (
                  <>
                    <JerseyIcon number={p.conv.number || '?'} isGk={isGk} isSelected={false} index={idx} isDragging={isDragging} />
                    <span
                      className="w-full truncate rounded px-1 py-0.5 text-center text-[8px] font-bold leading-none text-white"
                      style={{
                        background: isDragging ? 'rgba(59,130,246,0.7)' : 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(4px)',
                        marginTop: '1px',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {lastName}
                    </span>
                  </>
                )}
              </DraggablePlayer>
            );
          }

          return (
            <div
              key={p.id}
              className="absolute z-10 flex w-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center"
              style={{ left: `${p.x}%`, top: `${scaledY}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlayer(isSelected ? null : p.id);
              }}
            >
              <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
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
            </div>
          );
        })}

        {/* Bench label & substitutes inside pitch container */}
        {substitutePlayers.length > 0 && (
          <div className="absolute left-0 right-0 bottom-0 z-10" style={{ height: '15%' }}>
            <div className="flex items-center justify-center gap-2 pt-1 pb-0.5">
              <ArrowLeftRight size={10} className="text-muted-foreground" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Remplaçants</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">{substitutePlayers.length}</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2 px-2">
              {substitutePlayers.map((p, idx) => {
                const isGk = (p.conv.position || getDefaultPositionFromNumber(p.conv.number)) === 'Gardien';
                const lastName = p.name.split(' ').pop() || p.name;
                return (
                  <motion.div
                    key={p.id}
                    className="flex flex-col items-center w-11 cursor-pointer"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlayer(selectedPlayer === p.id ? null : p.id);
                    }}
                  >
                    <motion.svg
                      viewBox="0 0 40 44"
                      width="32"
                      height="36"
                      className="filter drop-shadow-md pointer-events-none"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: selectedPlayer === p.id ? 1.1 : 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: idx * 0.03 }}
                    >
                      <defs>
                        <linearGradient id={`sub-grad-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
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
                      </defs>
                      <path
                        d="M 9 0 L 0 9 L 0 17 L 7 14.5 L 7 41 Q 7 43 9 43 L 31 43 Q 33 43 33 41 L 33 14.5 L 40 17 L 40 9 L 31 0 L 26 5.5 Q 23 9 20 9 Q 17 9 14 5.5 Z"
                        fill={`url(#sub-grad-${idx})`}
                        stroke={selectedPlayer === p.id ? 'hsl(45 100% 65%)' : 'rgba(0,0,0,0.15)'}
                        strokeWidth={selectedPlayer === p.id ? 1.5 : 0.5}
                      />
                      <text x="20" y="31" textAnchor="middle" fill="white" fontSize="15" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
                        {p.conv.number || '?'}
                      </text>
                    </motion.svg>
                    <span
                      className="w-full truncate rounded px-0.5 text-center text-[7px] font-bold leading-none text-foreground"
                      style={{ marginTop: '1px', letterSpacing: '0.02em' }}
                    >
                      {lastName}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Player detail popup with position + number editor */}
        <AnimatePresence>
          {selected && !editMode && (() => {
            // Determine if this is a substitute (no x/y from positioned)
            const onField = positioned.find((p) => p.id === selected.id);
            const POPUP_W = 180; // px, matches w-[180px]
            const containerW = containerWidth || pitchContainerRef.current?.offsetWidth || 360;
            const popupWPct = (POPUP_W / containerW) * 100;
            const halfW = popupWPct / 2;
            const PAD = 2; // % padding from container edges

            let leftPct = 50;
            let topPct = 50;
            let translateY = '-50%';
            // We'll compute exact left so popup fits, no horizontal translate needed
            let translateX = '0%';

            if (onField) {
              const fieldHeightRatio = substitutePlayers.length > 0 ? 0.85 : 1;
              const playerScaledY = onField.y * fieldHeightRatio;
              // Place above if player is in upper half, below if in upper area
              const placeBelow = playerScaledY < 35;
              topPct = placeBelow ? playerScaledY + 10 : playerScaledY - 10;
              translateY = placeBelow ? '0%' : '-100%';
              // Center horizontally on player, then clamp so popup stays inside container
              let desiredLeft = onField.x - halfW; // top-left of popup, in %
              const minLeft = PAD;
              const maxLeft = 100 - popupWPct - PAD;
              if (desiredLeft < minLeft) desiredLeft = minLeft;
              if (desiredLeft > maxLeft) desiredLeft = maxLeft;
              leftPct = desiredLeft;
            } else {
              // Substitute — center, anchor above the bench
              leftPct = Math.max(PAD, 50 - halfW);
              topPct = 82;
              translateY = '-100%';
            }

            const currentNumber = localConvocations[selected.id]?.number ?? selected.conv.number;
            const currentPosition = localConvocations[selected.id]?.position ?? selected.conv.position ?? getDefaultPositionFromNumber(selected.conv.number) ?? '';

            // Compute used numbers (excluding current player) for duplicate detection
            const usedNumbers = new Set<number>();
            Object.entries(localConvocations).forEach(([pid, c]) => {
              if (pid !== selected.id && c.status === 'convoque' && typeof c.number === 'number') {
                usedNumbers.add(c.number);
              }
            });

            const updateConv = (patch: Partial<Convocation>) => {
              const updatedConvs = { ...localConvocations };
              updatedConvs[selected.id] = { ...updatedConvs[selected.id], ...patch };
              setLocalConvocations(updatedConvs);
              onUpdateConvocations?.(updatedConvs);
              saveTimestampRef.current = Date.now();
            };

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute z-30 rounded-2xl shadow-2xl p-3 w-[180px]"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: `translate(${translateX}, ${translateY})`,
                  background: 'rgba(15,15,25,0.95)',
                  backdropFilter: 'blur(16px) saturate(1.5)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[13px] text-white truncate">{selected.name}</p>
                    {currentNumber != null && (
                      <span className="text-[10px] font-bold text-white/60 mt-0.5 block">
                        N°{currentNumber}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="text-white/50 hover:text-white text-base leading-none px-1"
                    aria-label="Fermer"
                  >×</button>
                </div>

                {isManager && onUpdateConvocations ? (
                  <div className="mt-2.5 space-y-2">
                    {/* Number editor */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-white/50 mb-1">Numéro</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={currentNumber ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = v === '' ? undefined : Math.max(1, Math.min(99, parseInt(v, 10) || 0));
                            updateConv({ number: n });
                          }}
                          className={`w-full text-[13px] font-bold text-center rounded-lg px-2 py-1.5 bg-white/10 text-white border outline-none ${
                            currentNumber != null && usedNumbers.has(currentNumber)
                              ? 'border-amber-400/70 ring-1 ring-amber-400/40'
                              : 'border-white/20 focus:border-primary/60'
                          }`}
                          style={{ fontSize: 16 }}
                          placeholder="—"
                        />
                      </div>
                      {currentNumber != null && usedNumbers.has(currentNumber) && (
                        <p className="text-[9px] text-amber-300 mt-1 leading-tight">⚠ Numéro déjà utilisé</p>
                      )}
                    </div>
                    {/* Position editor */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-white/50 mb-1">Poste</label>
                      <select
                        value={currentPosition}
                        onChange={(e) => updateConv({ position: e.target.value })}
                        className="w-full text-[11px] font-semibold rounded-lg px-2 py-1.5 bg-white/10 text-white border border-white/20 outline-none appearance-none cursor-pointer"
                        style={{ fontSize: 16 }}
                      >
                        <option value="" className="bg-gray-900 text-white">— Poste —</option>
                        {POSITIONS.map(pos => (
                          <option key={pos} value={pos} className="bg-gray-900 text-white">{pos}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: currentPosition === 'Gardien'
                          ? 'rgba(132,204,22,0.2)'
                          : 'rgba(59,130,246,0.2)',
                        color: currentPosition === 'Gardien'
                          ? 'hsl(85 70% 60%)'
                          : 'hsl(215 90% 70%)',
                      }}
                    >
                      {currentPosition || 'Non défini'}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* Compo menu — choix de l'action */}
      {compoMenuOpen && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:px-6"
            onClick={() => setCompoMenuOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[340px] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Modifier la composition</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Choisissez une action</p>
                </div>
                <button onClick={() => setCompoMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                  <span className="text-muted-foreground text-lg leading-none">×</span>
                </button>
              </div>
              <div className="p-2 space-y-1">
                {onSwapPlayer && (
                  <button
                    onClick={() => { setCompoMenuOpen(false); setCompoAction('swap'); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary active:bg-secondary transition-colors text-left"
                  >
                    <span className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <ArrowLeftRight size={16} className="text-amber-600" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold text-foreground">Remplacer un joueur</span>
                      <span className="block text-[10px] text-muted-foreground">Échange un joueur convoqué</span>
                    </span>
                    <ChevronRight size={14} className="text-muted-foreground/50" />
                  </button>
                )}
                {onRemovePlayer && (
                  <button
                    onClick={() => { setCompoMenuOpen(false); setCompoAction('remove'); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary active:bg-secondary transition-colors text-left"
                  >
                    <span className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                      <Trash2 size={16} className="text-destructive" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold text-foreground">Supprimer un joueur</span>
                      <span className="block text-[10px] text-muted-foreground">Retire un joueur de la feuille</span>
                    </span>
                    <ChevronRight size={14} className="text-muted-foreground/50" />
                  </button>
                )}
                {onAddPlayer && (
                  <button
                    onClick={() => { setCompoMenuOpen(false); onAddPlayer(); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary active:bg-secondary transition-colors text-left"
                  >
                    <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <UserPlus size={16} className="text-primary" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold text-foreground">Ajouter un joueur</span>
                      <span className="block text-[10px] text-muted-foreground">Convoque un joueur supplémentaire</span>
                    </span>
                    <ChevronRight size={14} className="text-muted-foreground/50" />
                  </button>
                )}
              </div>
              <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Swap pick modal — sélectionne le joueur à remplacer */}
      {swapPickMode && onSwapPlayer && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
            onClick={() => setCompoAction(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl w-full max-w-[340px] max-h-[65vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Remplacer un joueur</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sélectionnez le joueur à remplacer</p>
                </div>
                <button onClick={() => setCompoAction(null)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                  <span className="text-muted-foreground text-lg leading-none">×</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {Object.entries(convocations)
                  .filter(([, c]) => c.status === 'convoque')
                  .sort((a, b) => (a[1].number || 99) - (b[1].number || 99))
                  .map(([pid, conv]) => {
                    const pl = players.find(p => p.id === pid);
                    const name = conv.virtualName || pl?.name || 'Joueur supprimé';
                    return (
                      <button
                        key={pid}
                        onClick={() => {
                          setCompoAction(null);
                          onSwapPlayer(pid, name, conv);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary active:bg-secondary transition-colors text-left"
                      >
                        <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                          {conv.number || '?'}
                        </span>
                        <span className="text-xs font-semibold text-foreground truncate flex-1">{name}</span>
                        <ArrowLeftRight size={14} className="text-muted-foreground/50 shrink-0" />
                      </button>
                    );
                  })}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Remove pick modal — sélectionne le joueur à retirer */}
      {removePickMode && onRemovePlayer && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
            onClick={() => setCompoAction(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl w-full max-w-[340px] max-h-[65vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Supprimer un joueur</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sélectionnez le joueur à retirer</p>
                </div>
                <button onClick={() => setCompoAction(null)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                  <span className="text-muted-foreground text-lg leading-none">×</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {Object.entries(convocations)
                  .filter(([, c]) => c.status === 'convoque')
                  .sort((a, b) => (a[1].number || 99) - (b[1].number || 99))
                  .map(([pid, conv]) => {
                    const pl = players.find(p => p.id === pid);
                    const name = conv.virtualName || pl?.name || 'Joueur supprimé';
                    return (
                      <button
                        key={pid}
                        onClick={() => {
                          setCompoAction(null);
                          onRemovePlayer(pid, name);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 active:bg-destructive/10 transition-colors text-left"
                      >
                        <span className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center text-[10px] font-black text-destructive shrink-0">
                          {conv.number || '?'}
                        </span>
                        <span className="text-xs font-semibold text-foreground truncate flex-1">{name}</span>
                        <Trash2 size={14} className="text-destructive/60 shrink-0" />
                      </button>
                    );
                  })}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
});

PitchView.displayName = 'PitchView';

export default PitchView;
