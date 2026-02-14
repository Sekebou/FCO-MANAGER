import React from 'react';
import type { Player, Event, Card } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import { Plus, Trash2, Activity, Target, Trophy, Check } from 'lucide-react';

interface Props {
  players: Player[];
  events: Event[];
  cards: Card[];
  currentUser: AppUser | null;
  canManage: () => boolean | null;
  updatePlayerStats: (playerId: string, field: string, value: string) => void;
  deletePlayer: (playerId: string) => void;
  getPlayerCards: (playerId: string) => Card[];
  deleteCard: (cardId: string) => void;
  onAddPlayer: () => void;
  onAddCard: (playerId: string) => void;
}

const StatsTab = ({ players, events, cards, currentUser, canManage, updatePlayerStats, deletePlayer, getPlayerCards, deleteCard, onAddPlayer, onAddCard }: Props) => {
  const calculateAttendanceRate = (playerId: string) => {
    const trainings = events.filter(e => e.type === 'training');
    if (trainings.length === 0) return null;
    let present = 0, total = 0;
    trainings.forEach(t => {
      const p = t.presences || {};
      if (p[playerId]) { total++; if (p[playerId] === 'present') present++; }
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
          <button onClick={onAddPlayer} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all text-sm font-medium">
            <Plus size={18} /> Ajouter un joueur
          </button>
        )}
      </div>

      {/* Attendance section - admin only */}
      {currentUser?.role === 'admin' && attendanceStats.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
              <Check size={20} className="text-accent-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Taux de présence</h3>
              <p className="text-xs text-muted-foreground">Classement aux entraînements</p>
            </div>
          </div>
          <div className="space-y-3">
            {attendanceStats.map((item, index) => {
              const rate = item.attendance!.rate;
              const colorClass = rate >= 80 ? 'bg-success' : rate >= 60 ? 'bg-accent' : rate >= 40 ? 'bg-warning' : 'bg-destructive';
              return (
                <div key={item.player.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
                  <div className={`w-7 h-7 rounded-full ${colorClass} flex items-center justify-center text-xs font-bold text-card`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{item.player.name}</div>
                    <div className="text-xs text-muted-foreground">{item.attendance!.present}/{item.attendance!.total} présences</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                      <div className={`h-full ${colorClass} transition-all`} style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-sm font-bold text-foreground w-12 text-right">{rate.toFixed(0)}%</span>
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
