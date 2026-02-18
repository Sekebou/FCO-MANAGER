import React, { useState } from 'react';
import { auth, sendPasswordResetEmail } from '@/lib/firebase';
import { isIOSCapacitor, restSendPasswordReset } from '@/lib/firestore-rest';
import type { Member } from '@/pages/Dashboard';
import { Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  member: Member;
  onClose: () => void;
}

const AdminResetPasswordForm = ({ member, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      if (isIOSCapacitor) {
        await restSendPasswordReset(member.email);
      } else {
        await sendPasswordResetEmail(auth, member.email);
      }
      setSuccess(true);
      setTimeout(onClose, 3000);
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl p-6 max-w-md w-full border border-border shadow-xl animate-fade-in">
        <h3 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
          <Lock size={20} /> Réinitialiser le mot de passe
        </h3>

        <div className="mb-4 p-4 bg-accent/5 border border-accent/20 rounded-xl">
          <p className="text-sm font-medium text-foreground">👤 {member.name}</p>
          <p className="text-sm text-muted-foreground">📧 {member.email}</p>
        </div>

        {success ? (
          <div className="p-4 bg-success/10 border border-success/30 rounded-xl">
            <p className="text-success font-medium">✅ Email envoyé avec succès !</p>
            <p className="text-sm text-success/80 mt-1">Un lien de réinitialisation a été envoyé.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-warning/5 border border-warning/20 rounded-xl">
              <p className="text-xs text-muted-foreground">Un email sera envoyé avec un lien de réinitialisation valide 1h.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSend} disabled={loading} className="flex-1 bg-accent text-accent-foreground p-3 rounded-xl font-medium hover:bg-accent/90 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Envoi...' : '📧 Envoyer le lien'}
              </button>
            </div>
            <button onClick={onClose} disabled={loading} className="w-full mt-2 bg-secondary text-foreground p-3 rounded-xl font-medium hover:bg-secondary/80 transition-all disabled:opacity-50 text-sm">Annuler</button>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminResetPasswordForm;
