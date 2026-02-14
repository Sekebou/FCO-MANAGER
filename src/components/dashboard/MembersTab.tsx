import React from 'react';
import type { Member, Player, Card } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import { Users, Activity, Target, Trophy, Lock, Mail, CalendarDays, Shield, Dumbbell, UserCircle } from 'lucide-react';

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

  const admins = members.filter(m => m.role === 'admin');
  const coaches = members.filter(m => m.role === 'entraineur');
  const playerMembers = members.filter(m => m.role === 'joueur');

  const roleConfig = {
    admin: { icon: Shield, color: 'warning', label: 'Administrateur', gradient: 'from-amber-500/20 to-orange-500/20' },
    entraineur: { icon: Dumbbell, color: 'accent', label: 'Entraîneur', gradient: 'from-emerald-500/20 to-teal-500/20' },
    joueur: { icon: UserCircle, color: 'primary', label: 'Joueur', gradient: 'from-blue-500/20 to-indigo-500/20' },
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-foreground">Membres du club</h2>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-warning/10 text-warning px-3 py-2 rounded-xl">
            <Shield size={14} />
            <span className="text-xs font-bold">{admins.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-accent/10 text-accent px-3 py-2 rounded-xl">
            <Dumbbell size={14} />
            <span className="text-xs font-bold">{coaches.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl">
            <Users size={14} />
            <span className="text-xs font-bold">{playerMembers.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-secondary text-foreground px-3 py-2 rounded-xl">
            <span className="text-xs font-bold">Total : {members.length}</span>
          </div>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Users className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground font-medium">Aucun membre</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(member => {
            const player = member.playerId ? players.find(p => p.id === member.playerId) : null;
            const license = player?.licenseExpiry ? getLicenseStatus(player.licenseExpiry) : null;
            const playerCards = player ? getPlayerCards(player.id) : [];
            const config = roleConfig[member.role as keyof typeof roleConfig] || roleConfig.joueur;
            const RoleIcon = config.icon;

            return (
              <div key={member.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 animate-fade-in">
                {/* Colored header band */}
                <div className={`h-2 bg-gradient-to-r ${config.gradient}`} />

                <div className="p-5">
                  {/* Top: Avatar + Name + Role */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg overflow-hidden shrink-0 bg-gradient-to-br ${config.gradient} shadow-sm`}>
                      {member.photoURL ? (
                        <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <RoleIcon size={22} className={`text-${config.color}`} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-foreground truncate">{member.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-${config.color}/10 text-${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail size={12} className="text-accent shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    {player && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Target size={12} className="text-accent shrink-0" />
                        <span>Poste : <span className="font-medium text-foreground">{player.position}</span></span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays size={12} className="text-accent shrink-0" />
                      <span>Depuis le {new Date(member.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Stats bar */}
                  {player && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-accent/5 rounded-xl p-2.5 text-center">
                        <Activity size={14} className="text-accent mx-auto mb-1" />
                        <div className="text-sm font-bold text-foreground">{player.matches || 0}</div>
                        <div className="text-[10px] text-muted-foreground">Matchs</div>
                      </div>
                      <div className="bg-accent/5 rounded-xl p-2.5 text-center">
                        <Target size={14} className="text-accent mx-auto mb-1" />
                        <div className="text-sm font-bold text-foreground">{player.goals || 0}</div>
                        <div className="text-[10px] text-muted-foreground">Buts</div>
                      </div>
                      <div className="bg-accent/5 rounded-xl p-2.5 text-center">
                        <Trophy size={14} className="text-accent mx-auto mb-1" />
                        <div className="text-sm font-bold text-foreground">{player.assists || 0}</div>
                        <div className="text-[10px] text-muted-foreground">Passes D.</div>
                      </div>
                    </div>
                  )}

                  {/* License badge */}
                  {license && (
                    <div className={`relative flex items-center gap-3 p-3 rounded-xl text-xs font-semibold mb-3 overflow-hidden ${
                      license.status === 'active' ? 'bg-accent/10 text-accent border border-accent/20' :
                      license.status === 'expiring' ? 'bg-warning/10 text-warning border border-warning/20' :
                      'bg-destructive/10 text-destructive border border-destructive/20'
                    }`}>
                      {/* Pulse ring */}
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          license.status === 'active' ? 'bg-accent' :
                          license.status === 'expiring' ? 'bg-warning' :
                          'bg-destructive'
                        }`} />
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${
                          license.status === 'active' ? 'bg-accent' :
                          license.status === 'expiring' ? 'bg-warning' :
                          'bg-destructive'
                        }`} />
                      </span>
                      <div>
                        {license.status === 'expired' && `🎫 Licence expirée depuis ${license.days} jour${license.days > 1 ? 's' : ''} — Renouvellement requis`}
                        {license.status === 'expiring' && `🎫 Licence à renouveler dans ${license.days} jour${license.days > 1 ? 's' : ''}`}
                        {license.status === 'active' && `🎫 Licence active — Valide encore ${license.days} jour${license.days > 1 ? 's' : ''}`}
                      </div>
                    </div>
                  )}

                  {/* Cards */}
                  {playerCards.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {playerCards.map(card => (
                        <span key={card.id} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          card.type === 'yellow' ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'
                        }`}>
                          {card.type === 'yellow' ? '🟨' : '🟥'} {card.reason.substring(0, 20)}{card.reason.length > 20 ? '…' : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Admin action */}
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => onResetPassword(member)}
                      className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-primary hover:text-primary-foreground text-muted-foreground px-3 py-2.5 rounded-xl transition-all text-xs font-semibold"
                    >
                      <Lock size={13} />
                      Réinitialiser le mot de passe
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
