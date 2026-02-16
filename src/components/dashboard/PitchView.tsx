import React from 'react';
import type { Convocation } from '@/pages/Dashboard';

interface Player {
  id: string;
  name: string;
}

interface Props {
  convocations: Record<string, Convocation>;
  players: Player[];
}

// Map positions to (x%, y%) on a vertical pitch (top = attack, bottom = goal)
const POSITION_COORDS: Record<string, { x: number; y: number }> = {
  'Gardien':            { x: 50, y: 90 },
  'Défenseur central':  { x: 50, y: 72 },
  'Latéral droit':      { x: 82, y: 70 },
  'Latéral gauche':     { x: 18, y: 70 },
  'Milieu défensif':    { x: 50, y: 54 },
  'Milieu central':     { x: 50, y: 42 },
  'Milieu offensif':    { x: 50, y: 30 },
  'Ailier droit':       { x: 80, y: 24 },
  'Ailier gauche':      { x: 20, y: 24 },
  'Attaquant':          { x: 50, y: 12 },
};

// When multiple players share the same position, spread them horizontally
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
      const spread = Math.min(20, 14 * (group.length - 1));
      group.forEach((p, i) => {
        const offset = -spread / 2 + (spread / (group.length - 1)) * i;
        result.push({ ...p, x: Math.max(8, Math.min(92, base.x + offset)), y: base.y });
      });
    }
  });
  return result;
}

const PitchView: React.FC<Props> = ({ convocations, players }) => {
  const convokedPlayers = Object.entries(convocations)
    .filter(([, conv]) => conv.status === 'convoque' && conv.position)
    .map(([playerId, conv]) => {
      const player = players.find(p => p.id === playerId);
      return player ? { id: playerId, name: player.name, conv } : null;
    })
    .filter(Boolean) as { id: string; name: string; conv: Convocation }[];

  if (convokedPlayers.length === 0) return null;

  const positioned = getSpreadCoords(convokedPlayers);

  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Composition</h4>
      <div className="relative w-full aspect-[68/105] max-w-sm mx-auto rounded-xl overflow-hidden border-2 border-accent/30">
        {/* Pitch background */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-700 to-green-600" />
        
        {/* Pitch markings */}
        <svg viewBox="0 0 68 105" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Outline */}
          <rect x="1" y="1" width="66" height="103" rx="0" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          {/* Center line */}
          <line x1="1" y1="52.5" x2="67" y2="52.5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
          {/* Center circle */}
          <circle cx="34" cy="52.5" r="9.15" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
          <circle cx="34" cy="52.5" r="0.6" fill="rgba(255,255,255,0.4)" />
          {/* Top penalty area */}
          <rect x="13.84" y="1" width="40.32" height="16.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
          <rect x="22.14" y="1" width="23.72" height="5.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
          <circle cx="34" cy="11" r="0.5" fill="rgba(255,255,255,0.4)" />
          {/* Bottom penalty area */}
          <rect x="13.84" y="87.5" width="40.32" height="16.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
          <rect x="22.14" y="98.5" width="23.72" height="5.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" />
          <circle cx="34" cy="94" r="0.5" fill="rgba(255,255,255,0.4)" />
        </svg>

        {/* Players */}
        {positioned.map(p => (
          <div
            key={p.id}
            className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-xs sm:text-sm shadow-lg border-2 border-white/80">
              {p.conv.number || '?'}
            </div>
            <span className="mt-0.5 text-[9px] sm:text-[10px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-center leading-tight max-w-[60px] truncate">
              {p.name.split(' ').pop()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PitchView;
