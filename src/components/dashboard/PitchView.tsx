import React, { useState, forwardRef } from 'react';
import type { Convocation } from '@/pages/Dashboard';

interface Player {
  id: string;
  name: string;
}

interface Props {
  convocations: Record<string, Convocation>;
  players: Player[];
}

// Half-pitch: goal at bottom (y=100%), midfield at top (y=0%)
const POSITION_COORDS: Record<string, { x: number; y: number }> = {
  'Attaquant':          { x: 50, y: 8 },
  'Ailier gauche':      { x: 15, y: 14 },
  'Ailier droit':       { x: 85, y: 14 },
  'Milieu offensif':    { x: 50, y: 28 },
  'Milieu central':     { x: 50, y: 42 },
  'Milieu défensif':    { x: 50, y: 52 },
  'Latéral gauche':     { x: 14, y: 65 },
  'Latéral droit':      { x: 86, y: 65 },
  'Défenseur central':  { x: 50, y: 68 },
  'Gardien':            { x: 50, y: 90 },
};

function getSpreadCoords(basePlayers: { id: string; name: string; conv: Convocation }[]) {
  const groups: Record<string, typeof basePlayers> = {};
  basePlayers.forEach(p => {
    const pos = p.conv.position || 'Sans poste';
    if (!groups[pos]) groups[pos] = [];
    groups[pos].push(p);
  });

  const result: { id: string; name: string; conv: Convocation; x: number; y: number }[] = [];
  Object.entries(groups).forEach(([pos, group]) => {
    const base = POSITION_COORDS[pos] || { x: 50, y: 50 };
    if (group.length === 1) {
      result.push({ ...group[0], x: base.x, y: base.y });
    } else {
      const spread = Math.min(28, 16 * (group.length - 1));
      group.forEach((p, i) => {
        const offset = -spread / 2 + (spread / (group.length - 1)) * i;
        result.push({ ...p, x: Math.max(8, Math.min(92, base.x + offset)), y: base.y });
      });
    }
  });
  return result;
}

/** Inline SVG jersey icon */
const JerseyIcon: React.FC<{ number: string | number; isGk?: boolean; isSelected?: boolean }> = ({ number, isGk, isSelected }) => (
  <svg viewBox="0 0 40 44" width="36" height="40" className={`drop-shadow-lg transition-transform ${isSelected ? 'scale-110' : ''}`}>
    {/* Jersey shape */}
    <path
      d={`
        M 8 0
        L 0 8
        L 0 16
        L 6 14
        L 6 42
        Q 6 44 8 44
        L 32 44
        Q 34 44 34 42
        L 34 14
        L 40 16
        L 40 8
        L 32 0
        L 26 6
        Q 23 9 20 9
        Q 17 9 14 6
        Z
      `}
      fill={isGk ? 'hsl(85 60% 45%)' : 'hsl(230 50% 22%)'}
      stroke={isSelected ? 'hsl(45 100% 60%)' : 'rgba(255,255,255,0.3)'}
      strokeWidth={isSelected ? 2 : 0.8}
    />
    {/* Number */}
    <text
      x="20"
      y="30"
      textAnchor="middle"
      fill="white"
      fontSize="16"
      fontWeight="800"
      fontFamily="system-ui, sans-serif"
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
    >
      {number}
    </text>
  </svg>
);

const PitchView = forwardRef<HTMLDivElement, Props>(({ convocations, players }, ref) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const convokedPlayers = Object.entries(convocations)
    .filter(([, conv]) => conv.status === 'convoque' && conv.position)
    .map(([playerId, conv]) => {
      const player = players.find(p => p.id === playerId);
      return player ? { id: playerId, name: player.name, conv } : null;
    })
    .filter(Boolean) as { id: string; name: string; conv: Convocation }[];

  if (convokedPlayers.length === 0) return null;

  const positioned = getSpreadCoords(convokedPlayers);
  const selected = selectedPlayer ? positioned.find(p => p.id === selectedPlayer) : null;

  return (
    <div ref={ref}>
      <div
        className="relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-border/50 shadow-lg"
        style={{ aspectRatio: '9 / 13' }}
        onClick={() => setSelectedPlayer(null)}
      >
        {/* Horizontal grass stripes */}
        <div className="absolute inset-0 flex flex-col">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className="w-full"
              style={{
                flex: 1,
                backgroundColor: i % 2 === 0 ? 'hsl(120 35% 42%)' : 'hsl(120 35% 37%)',
              }}
            />
          ))}
        </div>

        {/* Half-pitch markings */}
        <svg viewBox="0 0 68 95" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
          {/* Outline */}
          <rect x="3" y="2" width="62" height="91" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" rx="0.5" />
          {/* Midfield line (top) */}
          <line x1="3" y1="2.5" x2="65" y2="2.5" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" />
          {/* Center circle (half) */}
          <path d="M 24.85 2.5 A 9.15 9.15 0 0 1 43.15 2.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" />
          {/* Center spot */}
          <circle cx="34" cy="2.5" r="0.6" fill="rgba(255,255,255,0.6)" />
          {/* Penalty area */}
          <rect x="13.84" y="68" width="40.32" height="25" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
          {/* Goal area */}
          <rect x="22.14" y="82" width="23.72" height="11" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
          {/* Penalty spot */}
          <circle cx="34" cy="74" r="0.5" fill="rgba(255,255,255,0.4)" />
          {/* Penalty arc */}
          <path d="M 25 68 A 9.15 9.15 0 0 0 43 68" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
          {/* Goal */}
          <rect x="27" y="93" width="14" height="2.5" rx="0.3" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
        </svg>

        {/* Players */}
        {positioned.map(p => {
          const isSelected = selectedPlayer === p.id;
          const isGk = p.conv.position === 'Gardien';
          const lastName = p.name.split(' ').pop() || p.name;
          return (
            <div
              key={p.id}
              className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onClick={(e) => { e.stopPropagation(); setSelectedPlayer(isSelected ? null : p.id); }}
            >
              <JerseyIcon
                number={p.conv.number || '?'}
                isGk={isGk}
                isSelected={isSelected}
              />
              <span className="mt-0.5 text-[9px] sm:text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] text-center leading-tight max-w-[65px] truncate">
                {lastName}
              </span>
            </div>
          );
        })}

        {/* Player detail popup */}
        {selected && (
          <div
            className="absolute z-20 bg-popover/95 text-popover-foreground border border-border rounded-xl shadow-2xl p-3 min-w-[150px] -translate-x-1/2 animate-fade-in backdrop-blur-sm"
            style={{
              left: `${Math.max(22, Math.min(78, selected.x))}%`,
              top: `${Math.max(2, selected.y - 18)}%`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-sm">{selected.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{selected.conv.position}</p>
            {selected.conv.number && (
              <p className="text-xs font-semibold text-primary mt-0.5">N° {selected.conv.number}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

PitchView.displayName = 'PitchView';

export default PitchView;
