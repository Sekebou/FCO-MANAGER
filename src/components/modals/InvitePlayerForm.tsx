import React, { useState } from 'react';
import { X, Mail, Shield, Send, Link2, Briefcase, Dumbbell, UserCircle, Camera, MapPin, Calendar } from 'lucide-react';
import type { AppUser } from '@/contexts/AuthContext';

interface Props {
  onSubmit: (data: { email: string; role: string; licenseExpiry?: string; position?: string }) => void;
  onClose: () => void;
  currentUser: AppUser | null;
}

const InvitePlayerForm = ({ onSubmit, onClose, currentUser }: Props) => {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'admin+';
  const isSuperAdmin = currentUser?.role === 'admin+';

  const [formData, setFormData] = useState({
    email: '',
    role: 'joueur',
    licenseExpiry: '',
    position: '',
  });

  const handleSubmit = () => {
    if (!formData.email) return;
    onSubmit({
      email: formData.email,
      role: formData.role,
      licenseExpiry: formData.licenseExpiry || undefined,
      position: formData.position || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-border shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Send size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Inviter par email</h3>
              <p className="text-xs text-muted-foreground whitespace-nowrap">L'utilisateur créera son compte lui-même</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Role */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rôle attribué</label>
            {isAdmin ? (
              <div className="relative">
                <Shield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm transition-all appearance-none"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="joueur">Joueur</option>
                  <option value="entraineur">Entraîneur</option>
                  <option value="dirigeant">Dirigeant</option>
                  <option value="photographe">Photographe</option>
                  <option value="admin">Administrateur</option>
                  {isSuperAdmin && <option value="admin+">Admin+</option>}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded-xl">
                <UserCircle size={14} className="text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">Joueur</span>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email du destinataire</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                placeholder="joueur@email.com"
                className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          {/* Optional: Position */}
          {formData.role !== 'photographe' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Poste <span className="text-muted-foreground/50 normal-case">(optionnel)</span>
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm transition-all appearance-none"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                >
                  <option value="">Non défini</option>
                  <option value="Gardien">Gardien</option>
                  <option value="Défenseur">Défenseur</option>
                  <option value="Milieu">Milieu</option>
                  <option value="Attaquant">Attaquant</option>
                </select>
              </div>
            </div>
          )}

          {/* Optional: License */}
          {formData.role !== 'photographe' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Licence FFF <span className="text-muted-foreground/50 normal-case">(optionnel)</span>
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm transition-all"
                  value={formData.licenseExpiry}
                  onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl">
            <div className="flex items-start gap-2">
              <Link2 size={14} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Un lien d'inscription sera envoyé par email. La personne pourra créer son compte en renseignant son nom, prénom et mot de passe. Le lien expire dans <span className="font-semibold text-foreground">48 heures</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.email}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            Envoyer l'invitation
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvitePlayerForm;
