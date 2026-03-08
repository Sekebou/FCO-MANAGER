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
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Composition</h4>
      <div
        className="relative w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-border"
        style={{ aspectRatio: '68 / 52.5' }}
        onClick={() => setSelectedPlayer(null)}
      >
        {/* Vertical grass stripes */}
        <div className="absolute inset-0 flex">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="h-full"
              style={{
                flex: 1,
                backgroundColor: i % 2 === 0 ? 'hsl(142 40% 38%)' : 'hsl(142 40% 33%)',
              }}
            />
          ))}
        </div>

        {/* Half-pitch markings */}
        <svg viewBox="0 0 68 52.5" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Outline */}
          <rect x="1" y="0" width="66" height="51.5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.5" />
          {/* Midfield line (top) */}
          <line x1="1" y1="0.5" x2="67" y2="0.5" stroke="rgba(255,255,255,0.55)" strokeWidth="0.5" />
          {/* Center circle (half) - visible arc going downward */}
          <path d="M 24.85 0.5 A 9.15 9.15 0 0 1 43.15 0.5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.5" />
          {/* Center spot on the line */}
          <circle cx="34" cy="0.5" r="0.6" fill="rgba(255,255,255,0.7)" />
          {/* Penalty area */}
          <rect x="13.84" y="35" width="40.32" height="16.5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
          {/* Goal area */}
          <rect x="22.14" y="46" width="23.72" height="5.5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
          {/* Penalty spot */}
          <circle cx="34" cy="40" r="0.5" fill="rgba(255,255,255,0.5)" />
          {/* Penalty arc */}
          <path d="M 25 35 A 9.15 9.15 0 0 0 43 35" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
          {/* Goal */}
          <rect x="27" y="51.5" width="14" height="2" rx="0.3" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
        </svg>

        {/* Players */}
        {positioned.map(p => {
          const isSelected = selectedPlayer === p.id;
          return (
            <div
              key={p.id}
              className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onClick={(e) => { e.stopPropagation(); setSelectedPlayer(isSelected ? null : p.id); }}
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all border-2 ${
                isSelected 
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-110' 
                  : 'bg-accent text-accent-foreground border-accent/50 shadow-md hover:scale-105'
              }`}>
                {p.conv.number || '?'}
              </div>
              <span className="mt-0.5 text-[9px] sm:text-[10px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] text-center leading-tight max-w-[60px] truncate">
                {p.name.split(' ').pop()}
              </span>
            </div>
          );
        })}

        {/* Player detail popup */}
        {selected && (
          <div
            className="absolute z-20 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl p-3 min-w-[140px] -translate-x-1/2 animate-fade-in"
            style={{
              left: `${Math.max(20, Math.min(80, selected.x))}%`,
              top: `${Math.max(0, selected.y - 22)}%`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-sm">{selected.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{selected.conv.position}</p>
            {selected.conv.number && (
              <p className="text-xs font-semibold text-accent mt-0.5">N° {selected.conv.number}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

PitchView.displayName = 'PitchView';

export default PitchView;
