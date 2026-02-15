import React, { useState } from 'react';
import { X, User, MapPin, Calendar, Mail, Lock, UserPlus, Shield, Users } from 'lucide-react';
import { TEAMS } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';

interface Props {
  onSubmit: (data: any) => void;
  onClose: () => void;
  currentUser: AppUser | null;
}

const AddPlayerForm = ({ onSubmit, onClose, currentUser }: Props) => {
  const isAdmin = currentUser?.role === 'admin';
  const isCoach = currentUser?.role === 'entraineur';

  const [formData, setFormData] = useState({
    name: '', position: 'Attaquant', createAccount: true, email: '', password: '', licenseExpiry: '',
    role: isCoach ? 'joueur' : 'joueur',
    team: isCoach ? (currentUser?.team || '') : ''
  });

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-border shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <UserPlus size={20} className="text-accent" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Ajouter un membre</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Role section */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rôle</label>
            {isAdmin ? (
              <div className="relative">
                <Shield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all appearance-none"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="joueur">Joueur</option>
                  <option value="entraineur">Entraîneur</option>
                  <option value="photographe">Photographe</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-accent/10 border border-accent/20 rounded-xl">
                <Shield size={14} className="text-accent shrink-0" />
                <span className="text-sm font-medium text-foreground">Joueur</span>
              </div>
            )}
          </div>

          {/* Team section - for joueur and entraineur */}
          {(formData.role === 'joueur' || formData.role === 'entraineur') && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Équipe</label>
              {isAdmin ? (
                <div className="relative">
                  <Users size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <select
                    className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all appearance-none"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  >
                    <option value="">— Sélectionner une équipe —</option>
                    {TEAMS.map(t => (
                      <option key={t.id} value={t.id}>{t.label} ({t.division})</option>
                    ))}
                  </select>
                </div>
              ) : currentUser?.team ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-accent/10 border border-accent/20 rounded-xl">
                  <Users size={14} className="text-accent shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {TEAMS.find(t => t.id === currentUser.team)?.label} ({TEAMS.find(t => t.id === currentUser.team)?.division})
                  </span>
                </div>
              ) : null}
            </div>
          )}
          {/* Info section */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informations</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Nom complet" className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            {formData.role !== 'photographe' && (
              <>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <select className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all appearance-none" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })}>
                    <option>Gardien</option><option>Défenseur</option><option>Milieu</option><option>Attaquant</option>
                  </select>
                </div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expiration de licence</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="date" className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" value={formData.licenseExpiry} onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">📋 Date de fin de validité de la licence FFF du joueur</p>
              </>
            )}
          </div>

          {/* Account section */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compte joueur</label>
            <div className="space-y-3 p-4 bg-accent/5 rounded-xl border border-accent/10">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent/60" />
                <input type="email" placeholder="Email" className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 text-sm transition-all" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent/60" />
                <input type="text" placeholder="Mot de passe (min. 6)" className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 text-sm transition-all" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
            Annuler
          </button>
          <button
            onClick={() => onSubmit(formData)}
            disabled={!formData.name || !formData.email || !formData.password}
            className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-accent/20"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPlayerForm;
