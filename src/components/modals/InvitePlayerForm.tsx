import React, { useState } from 'react';
import { X, Mail, Shield, Send, Link2, Briefcase, Dumbbell, UserCircle, Camera, MapPin, Calendar, Share2, Hash } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import NativeDatePicker from '@/components/ui/native-date-picker';
import type { AppUser } from '@/contexts/AuthContext';

interface Props {
  onSubmit: (data: { email?: string; role: string; licenseExpiry?: string; position?: string; mode: 'email' | 'link' | 'collective' | 'code' }) => void;
  onClose: () => void;
  currentUser: AppUser | null;
}

const InvitePlayerForm = ({ onSubmit, onClose, currentUser }: Props) => {
  useBodyScrollLock();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'admin+';
  const isSuperAdmin = currentUser?.role === 'admin+';

  const [mode, setMode] = useState<'email' | 'link' | 'collective' | 'code'>('code');
  const [codeCollective, setCodeCollective] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role: 'joueur',
    licenseExpiry: '',
    position: '',
  });

  const handleSubmit = () => {
    if (mode === 'email' && !formData.email) return;
    const isCodeMode = mode === 'code' || (mode === 'collective' && codeCollective);
    onSubmit({
      email: mode === 'email' ? formData.email : undefined,
      role: isCodeMode ? 'joueur' : formData.role,
      licenseExpiry: formData.licenseExpiry || undefined,
      position: formData.position || undefined,
      mode: codeCollective && mode === 'collective' ? 'code' : mode,
      ...(codeCollective && mode === 'collective' ? { collective: true } : {}),
    } as any);
  };

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-[70]" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-border shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <Send size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-foreground">Inviter un membre</h3>
              <p className="text-xs text-muted-foreground truncate">La création du compte est réalisée par l'utilisateur.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-secondary rounded-xl">
            <button
              onClick={() => { setMode('code'); setFormData(f => ({ ...f, role: 'joueur' })); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'code' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Hash size={14} />
              Code individuel
            </button>
            <button
              onClick={() => { setMode('collective' as any); setCodeCollective(true); setFormData(f => ({ ...f, role: 'joueur' })); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'collective' && codeCollective ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Hash size={14} />
              Code collectif
            </button>
            <button
              onClick={() => { setMode('email'); setCodeCollective(false); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'email' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail size={14} />
              Email
            </button>
            <button
              onClick={() => { setMode('link'); setCodeCollective(false); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'link' && !codeCollective ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Share2 size={14} />
              Lien unique
            </button>
          </div>

          {/* Role - hidden for code modes (always joueur) */}
          {!(mode === 'code' || (mode === 'collective' && codeCollective)) && (
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
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded-xl">
                  <UserCircle size={14} className="text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">Joueur</span>
                </div>
              )}
            </div>
          )}

          {/* Role badge for code modes */}
          {(mode === 'code' || (mode === 'collective' && codeCollective)) && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded-xl">
              <UserCircle size={14} className="text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground">Rôle : Joueur</span>
              <span className="text-xs text-muted-foreground ml-auto">(par défaut)</span>
            </div>
          )}

          {/* Email - only in email mode */}
          {mode === 'email' && (
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
          )}

          {/* Optional: Position - hidden for code modes */}
          {!(mode === 'code' || (mode === 'collective' && codeCollective)) && formData.role !== 'photographe' && (
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

          {/* Optional: License - hidden for code modes */}
          {!(mode === 'code' || (mode === 'collective' && codeCollective)) && formData.role !== 'photographe' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Licence FFF <span className="text-muted-foreground/50 normal-case">(optionnel)</span>
              </label>
              <NativeDatePicker
                value={formData.licenseExpiry}
                onChange={(date) => setFormData({ ...formData, licenseExpiry: date })}
                placeholder="Date d'expiration licence"
              />
            </div>
          )}

          {/* Info */}
          <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl">
            <div className="flex items-start gap-2">
              <Link2 size={14} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {mode === 'code' && !codeCollective
                  ? <>Un <span className="font-semibold text-foreground">code individuel</span> sera généré (<span className="font-semibold text-foreground">1 utilisation</span>). Le joueur l'entre dans l'app pour créer son compte. Expire dans <span className="font-semibold text-foreground">24 heures</span>.</>
                  : mode === 'collective' && codeCollective
                  ? <>Un <span className="font-semibold text-foreground">code collectif</span> sera généré (<span className="font-semibold text-foreground">utilisations illimitées</span>). Partagez-le à tout le vestiaire ! Expire dans <span className="font-semibold text-foreground">24 heures</span>.</>
                  : mode === 'email'
                  ? <>Un lien d'inscription sera envoyé par email. Le lien expire dans <span className="font-semibold text-foreground">48 heures</span>.</>
                  : mode === 'link'
                  ? <>Un lien unique sera généré pour <span className="font-semibold text-foreground">un seul compte</span>. Le lien expire dans <span className="font-semibold text-foreground">48 heures</span>.</>
                  : <>Un lien <span className="font-semibold text-foreground">réutilisable</span> sera généré. N'importe qui peut créer un compte avec le rôle sélectionné. Le lien expire dans <span className="font-semibold text-foreground">7 jours</span>.</>
                }
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="shrink-0 px-5 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={mode === 'email' && !formData.email}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-1.5 min-w-0"
          >
            {mode === 'code' && !codeCollective ? (
              <><Hash size={15} className="shrink-0" /> <span className="truncate">Générer</span></>
            ) : mode === 'collective' && codeCollective ? (
              <><Hash size={15} className="shrink-0" /> <span className="truncate">Code collectif</span></>
            ) : mode === 'email' ? (
              <><Send size={15} className="shrink-0" /> <span className="truncate">Envoyer</span></>
            ) : mode === 'link' ? (
              <><Share2 size={15} className="shrink-0" /> <span className="truncate">Générer le lien</span></>
            ) : (
              <><Link2 size={15} className="shrink-0" /> <span className="truncate">Lien collectif</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvitePlayerForm;
