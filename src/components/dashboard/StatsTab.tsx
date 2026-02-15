import React from 'react';
import type { Player, Event, Card, AttendanceRecord, Member, TEAMS } from '@/pages/Dashboard';
import { TEAMS as TEAM_LIST } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import { Plus, Minus, Trash2, Activity, Target, Trophy, Check, Crown, Medal, Award, Shield, AlertTriangle, Calendar, TrendingUp, Zap } from 'lucide-react';

interface Props {
  players: Player[];
  events: Event[];
  cards: Card[];
  attendanceRecords: AttendanceRecord[];
  members: Member[];
  currentUser: AppUser | null;
  canManage: () => boolean | null;
  updatePlayerStats: (playerId: string, field: string, value: string) => void;
  deletePlayer: (playerId: string) => void;
  getPlayerCards: (playerId: string) => Card[];
  deleteCard: (cardId: string) => void;
  onAddCard: (playerId: string) => void;
}

const PlayerAvatar: React.FC<{ player: Player; members: Member[]; size?: number; className?: string }> = ({ player, members, size = 44, className = '' }) => {
  const member = members.find(m => m.playerId === player.id);
  const photoURL = member?.photoURL;
  const initials = player.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={player.name}
        className={`rounded-xl object-cover ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={`rounded-xl bg-primary flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <span className="text-primary-foreground font-bold" style={{ fontSize: size * 0.3 }}>{initials}</span>
    </div>
  );
};

const StatsTab = ({ players, events, cards, attendanceRecords, members, currentUser, canManage, updatePlayerStats, deletePlayer, getPlayerCards, deleteCard, onAddCard }: Props) => {
  const calculateAttendanceRate = (playerId: string) => {
    // Combine: active events + saved attendance_records (from deleted events)
    let present = 0, total = 0;

    // From active events
    events.filter(e => e.type === 'training').forEach(t => {
      const p = t.presences || {};
      if (p[playerId]) { total++; if (p[playerId] === 'present') present++; }
    });

    // From saved records (deleted events)
    const savedForPlayer = attendanceRecords.filter(r => r.playerId === playerId && r.eventType === 'training');
    // Deduplicate by eventId (avoid counting same event twice if still active)
    const activeEventIds = new Set(events.map(e => e.id));
    savedForPlayer.forEach(r => {
      if (!activeEventIds.has(r.eventId)) {
        total++;
        if (r.status === 'present') present++;
      }
    });

    if (total === 0) return null;
    return { rate: (present / total) * 100, present, total };
  };

  const attendanceStats = players
    .map(p => ({ player: p, attendance: calculateAttendanceRate(p.id) }))
    .filter(i => i.attendance !== null)
    .sort((a, b) => (b.attendance?.rate || 0) - (a.attendance?.rate || 0));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Statistiques</h2>
      </div>

      {/* Attendance section - admin only */}
      {currentUser?.role === 'admin' && attendanceStats.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-accent/10 to-accent/5 p-5 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center shadow-sm">
                  <Trophy size={20} className="text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Classement présences aux entraînements</h3>
                  <p className="text-xs text-muted-foreground">Du plus assidu au moins assidu</p>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-2xl font-bold text-accent">
                  {attendanceStats.length > 0 ? attendanceStats[0].attendance!.rate.toFixed(0) : 0}%
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Meilleur taux</div>
              </div>
            </div>
          </div>

          {/* Podium top 3 */}
          {attendanceStats.length >= 3 && (
            <div className="flex items-end justify-center gap-4 p-6 pb-2 bg-gradient-to-b from-accent/5 to-transparent">
              {[1, 0, 2].map((podiumIdx) => {
                const item = attendanceStats[podiumIdx];
                if (!item) return null;
                const rate = item.attendance!.rate;
                const isFirst = podiumIdx === 0;
                const podiumHeights = ['h-36', 'h-44', 'h-32'];
                const podiumIcons = [Crown, Medal, Award];
                const podiumGradients = [
                  'from-gray-300 to-gray-400 border-gray-300/50',
                  'from-yellow-400 to-amber-500 border-yellow-400/50',
                  'from-amber-600 to-amber-700 border-amber-600/50',
                ];
                const podiumGlows = [
                  'shadow-gray-300/20',
                  'shadow-yellow-400/30',
                  'shadow-amber-600/20',
                ];
                const podiumTextColors = ['text-gray-500', 'text-yellow-500', 'text-amber-700'];
                const podiumRanks = [2, 1, 3];
                const PodiumIcon = podiumIcons[podiumIdx];

                return (
                  <div key={item.player.id} className="flex flex-col items-center flex-1 max-w-[140px]">
                    {/* Avatar + Icon */}
                    <div className={`relative mb-3 ${isFirst ? 'scale-110' : ''} transition-transform`}>
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${podiumGradients[podiumIdx]} p-[2px] shadow-lg ${podiumGlows[podiumIdx]}`}>
                        {(() => {
                          const member = members.find(m => m.playerId === item.player.id);
                          const photoURL = member?.photoURL;
                          if (photoURL) {
                            return <img src={photoURL} alt={item.player.name} className="w-full h-full rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
                          }
                          return (
                            <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                              <span className="text-sm font-bold text-foreground">
                                {item.player.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br ${podiumGradients[podiumIdx]} flex items-center justify-center shadow-md`}>
                        <PodiumIcon size={12} className="text-white" />
                      </div>
                    </div>

                    {/* Name */}
                    <div className="text-xs font-bold text-foreground text-center truncate w-full mb-1">
                      {item.player.name}
                    </div>

                    {/* Rate */}
                    <div className={`text-lg font-black ${podiumTextColors[podiumIdx]} mb-2`}>
                      {rate.toFixed(0)}%
                    </div>

                    {/* Podium bar */}
                    <div className={`w-full ${podiumHeights[podiumIdx]} rounded-t-2xl bg-gradient-to-t ${podiumGradients[podiumIdx]} border border-b-0 flex flex-col items-center justify-start pt-3 relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                      <span className="text-2xl font-black text-white/90 relative z-10">{podiumRanks[podiumIdx]}</span>
                      <span className="text-[9px] text-white/70 font-medium relative z-10 mt-1">
                        {item.attendance!.present}/{item.attendance!.total}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full ranking list */}
          <div className="p-5 space-y-2">
            {attendanceStats.map((item, index) => {
              const rate = item.attendance!.rate;
              const colorClass = rate >= 80 ? 'bg-accent' : rate >= 60 ? 'bg-accent/70' : rate >= 40 ? 'bg-warning' : 'bg-destructive';
              const textColor = rate >= 80 ? 'text-accent' : rate >= 60 ? 'text-accent' : rate >= 40 ? 'text-warning' : 'text-destructive';
              return (
                <div key={item.player.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-all">
                  <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{item.player.name}</div>
                    <div className="text-[10px] text-muted-foreground">{item.attendance!.present} présences sur {item.attendance!.total}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-28 h-2.5 bg-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${Math.round(rate)}%` }} />
                    </div>
                    <span className={`text-sm font-bold w-12 text-right ${textColor}`}>{rate.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {players.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <p className="text-muted-foreground font-medium">Aucun joueur enregistré</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {players.map(player => {
            const playerCards = getPlayerCards(player.id);
            const matches = player.matches || 0;
            const goals = player.goals || 0;
            const assists = player.assists || 0;
            const avgGoals = matches > 0 ? (goals / matches).toFixed(2) : '—';

            return (
              <div key={player.id} className="bg-card border border-border rounded-2xl overflow-hidden animate-fade-in">
                {/* Player header */}
                <div className="flex items-center justify-between p-5 pb-4">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar player={player} members={members} size={44} className="rounded-xl" />
                     <div>
                      <h3 className="font-bold text-foreground">{player.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 bg-secondary rounded-md">{player.position}</span>
                        {player.team && (
                          <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                            {TEAM_LIST.find(t => t.id === player.team)?.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-px bg-border mx-5 rounded-xl overflow-hidden mb-4">
                  {[
                    { icon: Activity, label: 'Matchs', value: matches, field: 'matches', color: 'text-accent' },
                    { icon: Target, label: 'Buts', value: goals, field: 'goals', color: 'text-success' },
                    { icon: Zap, label: 'Passes D.', value: assists, field: 'assists', color: 'text-purple-500' },
                    { icon: TrendingUp, label: 'Moy/Match', value: avgGoals, field: null, color: 'text-muted-foreground' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-card p-3 flex flex-col items-center text-center">
                      <stat.icon size={15} className={`${stat.color} mb-1.5`} />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</span>
                      {canManage() && stat.field ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <button
                            onClick={() => updatePlayerStats(player.id, stat.field!, String(Math.max(0, Number(stat.value) - 1)))}
                            className="w-6 h-6 rounded-md bg-secondary hover:bg-destructive/15 hover:text-destructive flex items-center justify-center transition-all"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            value={stat.value}
                            onChange={(e) => updatePlayerStats(player.id, stat.field!, e.target.value)}
                            className="text-xl font-bold w-10 bg-transparent text-foreground outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="0"
                          />
                          <button
                            onClick={() => updatePlayerStats(player.id, stat.field!, String(Number(stat.value) + 1))}
                            className="w-6 h-6 rounded-md bg-secondary hover:bg-accent/20 hover:text-accent flex items-center justify-center transition-all"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-xl font-bold text-foreground mt-0.5">{stat.value}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Cards section */}
                <div className="px-5 pb-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Shield size={14} className="text-muted-foreground" />
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cartons</h4>
                    </div>
                    {currentUser?.role === 'admin' && (
                      <button onClick={() => onAddCard(player.id)} className="text-xs text-destructive font-semibold hover:bg-destructive/10 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1">
                        <Plus size={12} /> Ajouter un carton
                      </button>
                    )}
                  </div>
                  {playerCards.length === 0 ? (
                    <div className="flex items-center gap-2 py-2.5 px-3 bg-secondary/50 rounded-xl">
                      <Check size={14} className="text-success" />
                      <p className="text-xs text-muted-foreground font-medium">Aucun carton</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {playerCards.map(card => (
                        <div key={card.id} className={`flex items-center gap-3 p-3 rounded-xl border ${card.type === 'yellow' ? 'bg-warning/5 border-warning/20' : 'bg-destructive/5 border-destructive/20'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.type === 'yellow' ? 'bg-warning/20' : 'bg-destructive/20'}`}>
                            <AlertTriangle size={14} className={card.type === 'yellow' ? 'text-warning' : 'text-destructive'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${card.type === 'yellow' ? 'text-warning' : 'text-destructive'}`}>
                                {card.type === 'yellow' ? 'JAUNE' : 'ROUGE'}
                              </span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar size={10} /> {new Date(card.date).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            <p className="text-xs text-foreground truncate mt-0.5">{card.reason}</p>
                            {card.suspendedUntil && (
                              <p className="text-[10px] text-destructive font-medium mt-0.5">Suspendu → {new Date(card.suspendedUntil).toLocaleDateString('fr-FR')}</p>
                            )}
                          </div>
                          {currentUser?.role === 'admin' && (
                            <button onClick={() => deleteCard(card.id)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all shrink-0">
                              <Trash2 size={13} className="text-destructive/60" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StatsTab;
