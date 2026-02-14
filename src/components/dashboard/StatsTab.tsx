import React from 'react';
import type { Player, Event, Card, AttendanceRecord } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import { Plus, Trash2, Activity, Target, Trophy, Check, Crown, Medal, Award } from 'lucide-react';

interface Props {
  players: Player[];
  events: Event[];
  cards: Card[];
  attendanceRecords: AttendanceRecord[];
  currentUser: AppUser | null;
  canManage: () => boolean | null;
  updatePlayerStats: (playerId: string, field: string, value: string) => void;
  deletePlayer: (playerId: string) => void;
  getPlayerCards: (playerId: string) => Card[];
  deleteCard: (cardId: string) => void;
  onAddPlayer: () => void;
  onAddCard: (playerId: string) => void;
}

const StatsTab = ({ players, events, cards, attendanceRecords, currentUser, canManage, updatePlayerStats, deletePlayer, getPlayerCards, deleteCard, onAddPlayer, onAddCard }: Props) => {
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
        {canManage() && (
          <button onClick={onAddPlayer} className="bg-accent text-accent-foreground px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-accent/90 transition-all text-sm font-medium">
            <Plus size={18} /> Ajouter un joueur
          </button>
        )}
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
                  <h3 className="text-lg font-bold text-foreground">Classement présences</h3>
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
            <div className="grid grid-cols-3 gap-3 p-5 bg-gradient-to-b from-accent/5 to-transparent">
              {[1, 0, 2].map((podiumIdx) => {
                const item = attendanceStats[podiumIdx];
                if (!item) return null;
                const rate = item.attendance!.rate;
                const isFirst = podiumIdx === 0;
                const podiumIcons = [Crown, Medal, Award];
                const podiumColors = ['text-warning', 'text-accent', 'text-orange-400'];
                const podiumBgs = ['bg-warning/10 border-warning/20', 'bg-accent/10 border-accent/20', 'bg-orange-400/10 border-orange-400/20'];
                const PodiumIcon = podiumIcons[podiumIdx];
                return (
                  <div key={item.player.id} className={`flex flex-col items-center p-4 rounded-2xl border ${podiumBgs[podiumIdx]} ${isFirst ? 'scale-105 shadow-md' : ''} transition-all`}>
                    <PodiumIcon size={isFirst ? 28 : 22} className={podiumColors[podiumIdx]} />
                    <div className={`text-xs font-bold mt-1 ${podiumColors[podiumIdx]}`}>#{podiumIdx + 1}</div>
                    <div className="text-sm font-bold text-foreground mt-2 text-center truncate w-full">{item.player.name}</div>
                    <div className={`text-xl font-black mt-1 ${podiumColors[podiumIdx]}`}>{rate.toFixed(0)}%</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{item.attendance!.present}/{item.attendance!.total}</div>
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
            return (
              <div key={player.id} className="bg-card border border-border rounded-2xl p-5 animate-fade-in">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{player.name}</h3>
                    <p className="text-sm text-muted-foreground">{player.position}</p>
                  </div>
                  {canManage() && (
                    <button onClick={() => deletePlayer(player.id)} className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-all text-sm flex items-center gap-1">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-accent/5 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity size={14} className="text-accent" />
                      <span className="text-xs text-muted-foreground">Matchs</span>
                    </div>
                    {canManage() ? (
                      <input type="number" value={player.matches || 0} onChange={(e) => updatePlayerStats(player.id, 'matches', e.target.value)} className="text-xl font-bold w-full bg-transparent text-foreground outline-none" min="0" />
                    ) : (
                      <div className="text-xl font-bold text-foreground">{player.matches || 0}</div>
                    )}
                  </div>
                  <div className="bg-success/5 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target size={14} className="text-success" />
                      <span className="text-xs text-muted-foreground">Buts</span>
                    </div>
                    {canManage() ? (
                      <input type="number" value={player.goals || 0} onChange={(e) => updatePlayerStats(player.id, 'goals', e.target.value)} className="text-xl font-bold w-full bg-transparent text-foreground outline-none" min="0" />
                    ) : (
                      <div className="text-xl font-bold text-foreground">{player.goals || 0}</div>
                    )}
                  </div>
                  <div className="bg-purple-50 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Trophy size={14} className="text-purple-600" />
                      <span className="text-xs text-muted-foreground">Passes D.</span>
                    </div>
                    {canManage() ? (
                      <input type="number" value={player.assists || 0} onChange={(e) => updatePlayerStats(player.id, 'assists', e.target.value)} className="text-xl font-bold w-full bg-transparent text-foreground outline-none" min="0" />
                    ) : (
                      <div className="text-xl font-bold text-foreground">{player.assists || 0}</div>
                    )}
                  </div>
                </div>

                {(player.matches || 0) > 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Moyenne: {((player.goals || 0) / (player.matches || 1)).toFixed(2)} buts/match
                  </p>
                )}

                {/* Cards section */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm text-muted-foreground">Cartons</h4>
                    {currentUser?.role === 'admin' && (
                      <button onClick={() => onAddCard(player.id)} className="text-xs bg-destructive/10 text-destructive px-2.5 py-1 rounded-lg hover:bg-destructive/20 font-medium transition-all">
                        + Carton
                      </button>
                    )}
                  </div>
                  {playerCards.length === 0 ? (
                    <div className="bg-success/5 border border-success/20 rounded-xl p-2 text-center">
                      <p className="text-xs text-success font-medium">✅ Aucun carton</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {playerCards.map(card => (
                        <div key={card.id} className={`border rounded-xl p-3 ${card.type === 'yellow' ? 'bg-warning/5 border-warning/30' : 'bg-destructive/5 border-destructive/30'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${card.type === 'yellow' ? 'bg-warning text-warning-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                                  {card.type === 'yellow' ? '🟨 JAUNE' : '🟥 ROUGE'}
                                </span>
                                <span className="text-xs text-muted-foreground">{new Date(card.date).toLocaleDateString('fr-FR')}</span>
                              </div>
                              <p className="text-sm text-foreground mt-1">{card.reason}</p>
                              {card.suspendedUntil && (
                                <p className="text-xs text-destructive font-medium mt-1">⚠️ Suspendu jusqu'au {new Date(card.suspendedUntil).toLocaleDateString('fr-FR')}</p>
                              )}
                            </div>
                            {currentUser?.role === 'admin' && (
                              <button onClick={() => deleteCard(card.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded-lg transition-all">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
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
