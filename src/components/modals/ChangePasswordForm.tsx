import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

const ChangePasswordForm = ({ onClose }: Props) => {
  const [formData, setFormData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) { setError('Tous les champs sont obligatoires'); return; }
    if (formData.newPassword.length < 6) { setError('Minimum 6 caractères'); return; }
    if (formData.newPassword !== formData.confirmPassword) { setError('Les mots de passe ne correspondent pas'); return; }

    setLoading(true);
    try {
      // Verify current password
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Non authentifié');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: formData.currentPassword,
      });
      if (signInError) throw { code: 'auth/wrong-password' };

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ password: formData.newPassword });
      if (updateError) throw updateError;

      toast.success('Mot de passe modifié avec succès !');
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') setError('Mot de passe actuel incorrect');
      else if (err.code === 'auth/weak-password') setError('Mot de passe trop faible');
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl p-6 max-w-md w-full border border-border shadow-xl animate-fade-in">
        <h3 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
          <Lock size={20} /> Changer mon mot de passe
        </h3>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mot de passe actuel</label>
            <input type="password" placeholder="••••••••" className="w-full p-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.currentPassword} onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nouveau mot de passe</label>
            <input type="password" placeholder="••••••••" className="w-full p-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.newPassword} onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirmer</label>
            <input type="password" placeholder="••••••••" className="w-full p-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} />
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm">{error}</div>}

        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-accent text-accent-foreground p-3 rounded-xl font-medium hover:bg-accent/90 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Changement...' : 'Changer'}
          </button>
          <button onClick={onClose} disabled={loading} className="flex-1 bg-secondary text-foreground p-3 rounded-xl font-medium hover:bg-secondary/80 transition-all disabled:opacity-50 text-sm">Annuler</button>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordForm;
