import React from 'react';
import type { Member, Player, Card } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import { Users, Activity, Target, Trophy, Lock } from 'lucide-react';

interface Props {
  members: Member[];
  players: Player[];
  cards: Card[];
  currentUser: AppUser | null;
  getPlayerCards: (playerId: string) => Card[];
  onResetPassword: (member: Member) => void;
}

const MembersTab = ({ members, players, cards, currentUser, getPlayerCards, onResetPassword }: Props) => {
  const getLicenseStatus = (expiryDate: string) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { status: 'expired', text: 'Expirée', days: Math.abs(days) };
    if (days <= 30) return { status: 'expiring', text: 'À renouveler', days };
    return { status: 'active', text: 'Active', days };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Membres du club</h2>
        <span className="text-sm text-muted-foreground">
          Total : <span className="font-bold text-accent">{members.length}</span>
        </span>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Users className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground font-medium">Aucun membre</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {members.map(member => {
            const player = member.playerId ? players.find(p => p.id === member.playerId) : null;
            const license = player?.licenseExpiry ? getLicenseStatus(player.licenseExpiry) : null;
            const playerCards = player ? getPlayerCards(player.id) : [];

            return (
              <div key={member.id} className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow animate-fade-in">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg overflow-hidden shrink-0 ${
                      member.role === 'admin' ? 'bg-warning/20 text-warning' :
                      member.role === 'entraineur' ? 'bg-accent/20 text-accent' :
                      'bg-success/20 text-success'
                    }`}>
                      {member.photoURL ? (
                        <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <>{member.role === 'admin' ? '👑' : member.role === 'entraineur' ? '🎽' : '⚽'}</>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">{member.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{member.email}</p>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.role === 'admin' ? 'bg-warning/10 text-warning' :
                          member.role === 'entraineur' ? 'bg-accent/10 text-accent' :
                          'bg-success/10 text-success'
                        }`}>
                          {member.role === 'admin' ? '👑 Admin' : member.role === 'entraineur' ? '🎽 Entraîneur' : '⚽ Joueur'}
                        </span>
                        {player && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">📍 {player.position}</span>}
                        {license && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                            license.status === 'active' ? 'bg-success/10 text-success' :
                            license.status === 'expiring' ? 'bg-warning/10 text-warning' :
                            'bg-destructive/10 text-destructive'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              license.status === 'active' ? 'bg-success animate-pulse' :
                              license.status === 'expiring' ? 'bg-warning animate-pulse' :
                              'bg-destructive'
                            }`} />
                            🎫 {license.text}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        📅 Membre depuis le {new Date(member.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>

                      {license && (
                        <div className={`mt-2 p-2 rounded-lg text-xs ${
                          license.status === 'active' ? 'bg-success/5 text-success' :
                          license.status === 'expiring' ? 'bg-warning/5 text-warning' :
                          'bg-destructive/5 text-destructive'
                        }`}>
                          {license.status === 'expired' && `⚠️ Expirée depuis ${license.days} jour${license.days > 1 ? 's' : ''}`}
                          {license.status === 'expiring' && `⏰ Renouvellement dans ${license.days} jour${license.days > 1 ? 's' : ''}`}
                          {license.status === 'active' && `✓ Valide (${license.days} jours restants)`}
                        </div>
                      )}

                      {player && (
                        <div className="mt-3 flex gap-4 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Activity size={14} className="text-accent" /> {player.matches || 0} matchs
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Target size={14} className="text-success" /> {player.goals || 0} buts
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Trophy size={14} className="text-purple-600" /> {player.assists || 0} passes D
                          </div>
                        </div>
                      )}

                      {playerCards.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {playerCards.map(card => (
                            <span key={card.id} className={`px-2 py-0.5 rounded text-xs font-medium ${
                              card.type === 'yellow' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                            }`}>
                              {card.type === 'yellow' ? '🟨' : '🟥'} {card.reason.substring(0, 25)}{card.reason.length > 25 ? '...' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => onResetPassword(member)}
                      className="flex items-center gap-1.5 bg-warning/10 hover:bg-warning/20 text-warning px-3 py-2 rounded-xl transition-all text-xs font-medium shrink-0"
                    >
                      <Lock size={14} />
                      <span className="hidden sm:inline">Reset MDP</span>
                    </button>
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

export default MembersTab;
