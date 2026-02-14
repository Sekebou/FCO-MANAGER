import React from 'react';
import type { Event, Player } from '@/pages/Dashboard';
import { Calendar, Plus, Check, X, Trash2 } from 'lucide-react';

interface Props {
  events: Event[];
  players: Player[];
  canManage: () => boolean | null;
  canManageOwnPresence: (playerId: string) => boolean | null;
  togglePresence: (eventId: string, playerId: string, status: string) => void;
  deleteEvent: (eventId: string) => void;
  onAddPlayer: () => void;
  onAddEvent: () => void;
}

const PresencesTab = ({ events, players, canManage, canManageOwnPresence, togglePresence, deleteEvent, onAddPlayer, onAddEvent }: Props) => {
  const upcomingEvents = events
    .filter(e => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground">Gestion des présences</h2>
        <div className="flex gap-2">
          {canManage() && (
            <>
              <button onClick={onAddPlayer} className="bg-accent text-accent-foreground px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-accent/90 transition-all text-sm font-medium">
                <Plus size={18} /> Joueur
              </button>
              <button onClick={onAddEvent} className="bg-accent text-accent-foreground px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-accent/90 transition-all text-sm font-medium">
                <Plus size={18} /> Événement
              </button>
            </>
          )}
        </div>
      </div>

      {upcomingEvents.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Calendar className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground font-medium">Aucun événement à venir</p>
          {canManage() && <p className="text-sm text-muted-foreground/70 mt-2">Cliquez sur "+ Événement" pour en créer un</p>}
        </div>
      ) : (
        upcomingEvents.map(event => {
          const presences = event.presences || {};
          const presentCount = Object.values(presences).filter(p => p === 'present').length;
          const absentCount = Object.values(presences).filter(p => p === 'absent').length;
          const unknownCount = players.length - presentCount - absentCount;

          return (
            <div key={event.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm animate-fade-in">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-foreground">{event.title}</h3>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-success font-medium">✓ {presentCount}</span>
                    <span className="text-destructive font-medium">✗ {absentCount}</span>
                    <span className="text-muted-foreground">? {unknownCount}</span>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    event.type === 'match' ? 'bg-accent/10 text-accent' :
                    event.type === 'training' ? 'bg-purple-100 text-purple-700' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {event.type === 'match' ? 'Match' : event.type === 'training' ? 'Entraînement' : 'Autre'}
                  </span>
                  {canManage() && (
                    <button onClick={() => deleteEvent(event.id)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-all">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {players.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">Aucun joueur enregistré</p>
                ) : (
                  players.map(player => {
                    const status = presences[player.id];
                    return (
                      <div key={player.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                        <span className="font-medium text-sm text-foreground">{player.name}</span>
                        {canManageOwnPresence(player.id) ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => togglePresence(event.id, player.id, 'present')}
                              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all ${
                                status === 'present' ? 'bg-success text-success-foreground shadow-sm' : 'bg-card border border-border hover:border-success/50 text-muted-foreground'
                              }`}
                            >
                              <Check size={14} /> Présent
                            </button>
                            <button
                              onClick={() => togglePresence(event.id, player.id, 'absent')}
                              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all ${
                                status === 'absent' ? 'bg-destructive text-destructive-foreground shadow-sm' : 'bg-card border border-border hover:border-destructive/50 text-muted-foreground'
                              }`}
                            >
                              <X size={14} /> Absent
                            </button>
                          </div>
                        ) : (
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                            status === 'present' ? 'bg-success/10 text-success' :
                            status === 'absent' ? 'bg-destructive/10 text-destructive' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {status === 'present' ? '✓ Présent' : status === 'absent' ? '✗ Absent' : '? Non confirmé'}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default PresencesTab;
