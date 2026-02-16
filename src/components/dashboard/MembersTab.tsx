import React, { useState } from 'react';
import type { Member, Player, Card } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import { Users, Activity, Target, Trophy, Lock, Mail, CalendarDays, Shield, Dumbbell, UserCircle, Trash2, Plus, Camera, X, KeyRound, Loader2, Briefcase, Send } from 'lucide-react';

interface Props {
  members: Member[];
  players: Player[];
  cards: Card[];
  currentUser: AppUser | null;
  canManage: () => boolean | null;
  getPlayerCards: (playerId: string) => Card[];
  deletePlayer: (playerId: string) => void;
  deleteMember: (memberId: string, playerId?: string) => void;
  onResetPassword: (member: Member) => void;
  onAddPlayer: () => void;
  onInvitePlayer: () => void;
  onChangeRole: (memberId: string, newRole: string, password: string) => Promise<void>;
}

const MembersTab = ({ members, players, cards, currentUser, canManage, getPlayerCards, deletePlayer, deleteMember, onResetPassword, onAddPlayer, onInvitePlayer, onChangeRole }: Props) => {
  const [roleChangeRequest, setRoleChangeRequest] = useState<{ memberId: string; memberName: string; newRole: string } | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleChangeLoading, setRoleChangeLoading] = useState(false);

  const handleRoleChangeConfirm = async () => {
    if (!roleChangeRequest || !confirmPassword) return;
    setRoleChangeLoading(true);
    try {
      await onChangeRole(roleChangeRequest.memberId, roleChangeRequest.newRole, confirmPassword);
      setRoleChangeRequest(null);
      setConfirmPassword('');
    } catch {
      // error handled by parent
    } finally {
      setRoleChangeLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = { joueur: 'Joueur', entraineur: 'Entraîneur', photographe: 'Photographe', dirigeant: 'Dirigeant', admin: 'Administrateur', 'admin+': 'Administrateur' };
    return labels[role] || role;
  };

  const getLicenseStatus = (expiryDate: string) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { status: 'expired', text: 'Expirée', days: Math.abs(days) };
    if (days <= 30) return { status: 'expiring', text: 'À renouveler', days };
    return { status: 'active', text: 'Active', days };
  };

  const visibleMembers = members.filter(m => m.role !== 'admin+');
  const admins = visibleMembers.filter(m => m.role === 'admin');
  const coaches = visibleMembers.filter(m => m.role === 'entraineur');
  const dirigeants = visibleMembers.filter(m => m.role === 'dirigeant');
  const playerMembers = visibleMembers.filter(m => m.role === 'joueur');

  const roleConfig: Record<string, any> = {
    'admin+': { icon: Shield, color: 'warning', label: 'Administrateur', gradient: 'from-amber-500/20 to-orange-500/20' },
    admin: { icon: Shield, color: 'warning', label: 'Administrateur', gradient: 'from-amber-500/20 to-orange-500/20' },
    entraineur: { icon: Dumbbell, color: 'accent', label: 'Entraîneur', gradient: 'from-emerald-500/20 to-teal-500/20' },
    dirigeant: { icon: Briefcase, color: 'accent', label: 'Dirigeant', gradient: 'from-sky-500/20 to-blue-500/20' },
    photographe: { icon: Camera, color: 'accent', label: 'Photographe', gradient: 'from-purple-500/20 to-pink-500/20' },
    joueur: { icon: UserCircle, color: 'primary', label: 'Joueur', gradient: 'from-blue-500/20 to-indigo-500/20' },
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-foreground">Membres du club</h2>
        <div className="flex gap-2 items-center flex-wrap">
          {canManage() && (
            <div className="flex gap-2">
              <button onClick={onInvitePlayer} className="bg-primary/10 text-primary px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary/20 transition-all text-sm font-medium border border-primary/20">
                <Send size={16} /> Inviter
              </button>
              <button onClick={onAddPlayer} className="bg-accent text-accent-foreground px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-accent/90 transition-all text-sm font-medium">
                <Plus size={18} /> Ajouter
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 bg-warning/10 text-warning px-3 py-2 rounded-xl">
            <Shield size={14} />
            <span className="text-xs font-bold">{admins.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-accent/10 text-accent px-3 py-2 rounded-xl">
            <Dumbbell size={14} />
            <span className="text-xs font-bold">{coaches.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-sky-500/10 text-sky-600 px-3 py-2 rounded-xl">
            <Briefcase size={14} />
            <span className="text-xs font-bold">{dirigeants.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl">
            <Users size={14} />
            <span className="text-xs font-bold">{playerMembers.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-secondary text-foreground px-3 py-2 rounded-xl">
            <span className="text-xs font-bold">Total : {visibleMembers.length}</span>
          </div>
        </div>
      </div>

      {visibleMembers.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Users className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground font-medium">Aucun membre</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleMembers.map(member => {
            const player = member.playerId ? players.find(p => p.id === member.playerId) : null;
            const license = player?.licenseExpiry ? getLicenseStatus(player.licenseExpiry) : null;
            const playerCards = player ? getPlayerCards(player.id) : [];
            const config = roleConfig[member.role] || roleConfig.joueur;
            const RoleIcon = config.icon;

            return (
              <div key={member.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 animate-fade-in flex flex-col">
                {/* Colored header band */}
                <div className={`h-2 bg-gradient-to-r ${config.gradient}`} />

                <div className="p-5 flex flex-col flex-1">
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
                    {player && member.role !== 'photographe' && member.role !== 'dirigeant' && (
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

                  {/* Stats bar - hidden for photographe */}
                  {player && member.role !== 'photographe' && member.role !== 'dirigeant' && (
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

                  {/* License badge - hidden for photographe */}
                  {license && member.role !== 'photographe' && member.role !== 'dirigeant' && (
                    <div className={`relative flex items-center gap-3 p-3 rounded-xl text-xs font-semibold mb-3 overflow-hidden ${
                      license.status === 'active' ? 'bg-accent/10 text-accent border border-accent/20' :
                      license.status === 'expiring' ? 'bg-warning/10 text-warning border border-warning/20' :
                      'bg-destructive/10 text-destructive border border-destructive/20'
                    }`}>
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className={`absolute inline-flex h-full w-full rounded-full ${
                          license.status === 'active' ? 'bg-accent glow-pulse-green' :
                          license.status === 'expiring' ? 'bg-warning glow-pulse-orange' :
                          'bg-destructive glow-pulse-red'
                        }`} />
                      </span>
                      <div>
                        {license.status === 'expired' && `Licence expirée depuis ${license.days} jour${license.days > 1 ? 's' : ''} — Renouvellement requis`}
                        {license.status === 'expiring' && `Licence à renouveler dans ${license.days} jour${license.days > 1 ? 's' : ''}`}
                        {license.status === 'active' && `Licence active — Valide encore ${license.days} jour${license.days > 1 ? 's' : ''}`}
                      </div>
                    </div>
                  )}

                  {/* Cards - hidden for photographe */}
                  {playerCards.length > 0 && member.role !== 'photographe' && member.role !== 'dirigeant' && (
                    <div className="space-y-2 mb-3">
                      {playerCards.map(card => (
                        <div key={card.id} className={`p-2.5 rounded-xl border text-xs ${
                          card.type === 'yellow' ? 'bg-warning/5 border-warning/20' : 'bg-destructive/5 border-destructive/20'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-bold ${card.type === 'yellow' ? 'text-warning' : 'text-destructive'}`}>
                              {card.type === 'yellow' ? '🟨 JAUNE' : '🟥 ROUGE'}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <CalendarDays size={10} /> {new Date(card.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-foreground">{card.reason}</p>
                          {card.suspendedUntil && (
                            <p className="text-[10px] text-destructive font-semibold mt-1">
                              ⛔ Suspendu jusqu'au {new Date(card.suspendedUntil).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Spacer to push button to bottom */}
                  <div className="flex-1" />

                  {/* Admin actions - always at bottom */}
                  {(currentUser?.role === 'admin+' || currentUser?.role === 'admin') && (
                    <div className="space-y-2 mt-3">
                      {/* Role selector logic */}
                      {(() => {
                        const isSuperAdmin = currentUser?.role === 'admin+';
                        const targetIsSuperAdmin = member.role === 'admin+';
                        const targetIsAdmin = member.role === 'admin';
                        const isSelf = member.id === currentUser?.uid;

                        // Admin+ can't change own role, nobody changes admin+ role
                        if (targetIsSuperAdmin) {
                          return (
                            <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-xl">
                              <Shield size={13} className="text-destructive shrink-0" />
                              <span className="text-xs text-muted-foreground italic">Rôle Admin+ — Intouchable</span>
                            </div>
                          );
                        }
                        // Admin can't change own admin role or other admins' roles
                        if (!isSuperAdmin && (isSelf && currentUser?.role === 'admin')) {
                          return (
                            <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border border-border rounded-xl">
                              <Shield size={13} className="text-warning shrink-0" />
                              <span className="text-xs text-muted-foreground italic">Vous ne pouvez pas modifier votre propre rôle admin</span>
                            </div>
                          );
                        }
                        if (!isSuperAdmin && targetIsAdmin) {
                          return (
                            <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border border-border rounded-xl">
                              <Shield size={13} className="text-warning shrink-0" />
                              <span className="text-xs text-muted-foreground italic">Seul l'Admin+ peut modifier un rôle Admin</span>
                            </div>
                          );
                        }
                        // Show role selector
                        return (
                          <div className="flex items-center gap-2">
                            <Shield size={13} className="text-muted-foreground shrink-0" />
                            <select
                              value={member.role}
                              onChange={(e) => {
                                const newRole = e.target.value;
                                if (newRole !== member.role) {
                                  setRoleChangeRequest({ memberId: member.id, memberName: member.name, newRole });
                                }
                              }}
                              className="flex-1 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-accent/50 appearance-none cursor-pointer"
                            >
                              <option value="joueur">Joueur</option>
                              <option value="entraineur">Entraîneur</option>
                              <option value="dirigeant">Dirigeant</option>
                              <option value="photographe">Photographe</option>
                              <option value="admin">Administrateur</option>
                              {isSuperAdmin && <option value="admin+">Admin+</option>}
                            </select>
                          </div>
                        );
                      })()}

                      <div className="flex gap-2">
                        <button
                          onClick={() => onResetPassword(member)}
                          className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-primary hover:text-primary-foreground text-muted-foreground px-3 py-2.5 rounded-xl transition-all text-xs font-semibold"
                        >
                          <Lock size={13} />
                          Réinitialiser MDP
                        </button>
                        {/* Hide delete button for admin+ accounts and admin-on-admin */}
                        {member.role !== 'admin+' && (currentUser?.role === 'admin+' || member.role !== 'admin') && (
                          <button
                            onClick={() => deleteMember(member.id, member.playerId)}
                            className="flex items-center justify-center gap-2 bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground text-destructive px-3 py-2.5 rounded-xl transition-all text-xs font-semibold"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Password confirmation modal for role change */}
      {roleChangeRequest && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => { setRoleChangeRequest(null); setConfirmPassword(''); }}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center">
                  <KeyRound size={20} className="text-warning" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Confirmation</h3>
              </div>
              <button onClick={() => { setRoleChangeRequest(null); setConfirmPassword(''); }} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Vous êtes sur le point de changer le rôle de <span className="font-semibold text-foreground">{roleChangeRequest.memberName}</span> en <span className="font-semibold text-foreground">{getRoleLabel(roleChangeRequest.newRole)}</span>.
              </p>
              <p className="text-sm text-muted-foreground">Entrez votre mot de passe pour confirmer :</p>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="Votre mot de passe"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && confirmPassword) handleRoleChangeConfirm(); }}
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 text-sm transition-all"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button
                onClick={() => { setRoleChangeRequest(null); setConfirmPassword(''); }}
                className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleRoleChangeConfirm}
                disabled={!confirmPassword || roleChangeLoading}
                className="flex-1 py-3 bg-warning text-warning-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-warning/20 flex items-center justify-center gap-2"
              >
                {roleChangeLoading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersTab;
