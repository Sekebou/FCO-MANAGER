import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Mail, User, Loader2, Shield, ChevronRight, XCircle, AlertTriangle, Download, Smartphone, PartyPopper, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clubLogo from '@/assets/logo.png';

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const successRef = useRef(sessionStorage.getItem('register_success') === 'true');
  const [invitation, setInvitation] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'expired' | 'used' | 'not_found'>('loading');
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(successRef.current);
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    // If already registered successfully, skip invitation check
    if (success) return;
    if (!token) { setStatus('not_found'); return; }
    const checkInvitation = async () => {
      try {
        const { data: inv, error } = await supabase
          .from('invitations')
          .select('*')
          .eq('id', token)
          .single();

        if (error || !inv) { setStatus('not_found'); return; }
        const maxUses = (inv as any).max_uses ?? 1;
        const useCount = (inv as any).use_count ?? 0;
        const isMultiUse = maxUses > 1;
        if (!isMultiUse && inv.status === 'used') { setStatus('used'); return; }
        if (isMultiUse && useCount >= maxUses) { setStatus('used'); return; }
        if (new Date(inv.expires_at) < new Date()) { setStatus('expired'); return; }
        setInvitation(inv);
        setStatus('valid');
      } catch (err) {
        console.error('Error checking invitation:', err);
        setStatus('not_found');
      }
    };
    checkInvitation();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName.trim() || !formData.lastName.trim()) { setError('Veuillez remplir tous les champs'); return; }
    if (formData.password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Les mots de passe ne correspondent pas'); return; }

    setLoading(true);
    try {
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      const emailToUse = invitation.email || formData.email.trim();
      if (!emailToUse) { setError('Veuillez renseigner votre email'); setLoading(false); return; }

      // Sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailToUse,
        password: formData.password,
      });
      if (authError) {
        if (authError.message.includes('already registered')) throw { code: 'auth/email-already-in-use' };
        throw authError;
      }
      const userId = authData.user?.id;
      if (!userId) throw new Error('Erreur de création de compte');

      const maxUses = (invitation as any).max_uses ?? 1;
      const isMultiUse = maxUses > 1;

      // Use register_user RPC to create profile + player
      const { error: regError } = await supabase.rpc('register_user', {
        p_user_id: userId,
        p_email: emailToUse,
        p_name: fullName,
        p_role: invitation.role,
        p_position: invitation.position || 'Attaquant',
        p_license_expiry: invitation.license_expiry || null,
        p_invitation_id: isMultiUse ? undefined : token,
      });
      if (regError) throw regError;

      // For multi-use links, increment use_count manually
      if (isMultiUse) {
        const currentCount = (invitation as any).use_count ?? 0;
        await supabase.from('invitations').update({
          use_count: currentCount + 1,
        } as any).eq('id', token!);
      }

      // Mark success IMMEDIATELY — ref ensures it survives any re-mount
      const emailForSuccess = invitation.email || formData.email.trim();
      sessionStorage.setItem('register_success', 'true');
      sessionStorage.setItem('register_email', emailForSuccess);
      successRef.current = true;
      setSuccess(true);

      // Do NOT sign out — it triggers AuthProvider re-render causing blank page on Chrome mobile
      // The user will use the native app to log in anyway
    } catch (err: any) {
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') msg = 'Un compte avec cet email existe déjà.';
      else if (err.code === 'auth/invalid-email') msg = 'Email invalide.';
      else if (msg?.includes('weak') || msg?.includes('easy to guess')) msg = 'Ce mot de passe est trop faible et facile à deviner, veuillez en choisir un autre.';
      else if (msg?.includes('at least')) msg = 'Le mot de passe doit contenir au moins 6 caractères.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = { joueur: 'Joueur', entraineur: 'Entraîneur', photographe: 'Photographe', dirigeant: 'Dirigeant', admin: 'Administrateur' };
    return labels[role] || role;
  };

  // Check ref OR state — ref survives re-mounts from AuthProvider re-renders
  const isSuccess = success || successRef.current;

  if (status === 'loading' && !isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isSuccess && (status === 'not_found' || status === 'expired' || status === 'used')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-2xl mb-4">
            <img src={clubLogo} alt="FCO" className="w-14 h-14 object-contain" />
          </div>
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${status === 'expired' ? 'bg-warning/10' : 'bg-destructive/10'}`}>
            {status === 'expired' ? <AlertTriangle size={28} className="text-warning" /> : <XCircle size={28} className="text-destructive" />}
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {status === 'not_found' && "Invitation introuvable"}
            {status === 'expired' && "Invitation expirée"}
            {status === 'used' && "Invitation déjà utilisée"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {status === 'not_found' && "Ce lien d'invitation n'existe pas ou est invalide."}
            {status === 'expired' && "Ce lien d'invitation a expiré. Demandez un nouveau lien à votre administrateur."}
            {status === 'used' && "Ce lien a déjà été utilisé pour créer un compte."}
          </p>
          <button onClick={() => navigate('/auth')} className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-all">
            Aller à la connexion
          </button>
        </div>
      </div>
    );
  }

  const registeredEmail = invitation?.email || formData.email || sessionStorage.getItem('register_email') || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/[0.03] rounded-full" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-primary/[0.02] rounded-full" />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-8 animate-[fadeSlideUp_0.6s_ease-out_both]">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-2xl mb-4 border border-primary/20 shadow-lg shadow-primary/10">
            <img src={clubLogo} alt="FCO Logo" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Créer votre compte</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vous avez été invité en tant que <span className="font-semibold text-primary">{getRoleLabel(invitation?.role)}</span>
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 sm:p-8 border border-border shadow-sm animate-[fadeSlideUp_0.6s_ease-out_0.1s_both]">
          {invitation?.email ? (
            <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50 mb-5">
              <Mail size={16} className="text-primary shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="text-sm font-medium text-foreground">{invitation?.email}</p>
              </div>
            </div>
          ) : (
            <div className="mb-5">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Email</label>
              <div className={`relative rounded-xl transition-all duration-300 ${focused === 'email' ? 'ring-2 ring-primary/30 shadow-md shadow-primary/5' : ''}`}>
                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === 'email' ? 'text-primary' : 'text-muted-foreground/50'}`} size={18} />
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                  className="w-full pl-11 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
                  placeholder="Votre adresse email" required />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Prénom</label>
              <div className={`relative rounded-xl transition-all duration-300 ${focused === 'firstName' ? 'ring-2 ring-primary/30 shadow-md shadow-primary/5' : ''}`}>
                <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === 'firstName' ? 'text-primary' : 'text-muted-foreground/50'}`} size={18} />
                <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} onFocus={() => setFocused('firstName')} onBlur={() => setFocused(null)}
                  className="w-full pl-11 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
                  placeholder="Votre prénom" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nom</label>
              <div className={`relative rounded-xl transition-all duration-300 ${focused === 'lastName' ? 'ring-2 ring-primary/30 shadow-md shadow-primary/5' : ''}`}>
                <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === 'lastName' ? 'text-primary' : 'text-muted-foreground/50'}`} size={18} />
                <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} onFocus={() => setFocused('lastName')} onBlur={() => setFocused(null)}
                  className="w-full pl-11 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
                  placeholder="Votre nom" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mot de passe</label>
              <div className={`relative rounded-xl transition-all duration-300 ${focused === 'password' ? 'ring-2 ring-primary/30 shadow-md shadow-primary/5' : ''}`}>
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === 'password' ? 'text-primary' : 'text-muted-foreground/50'}`} size={18} />
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                  className="w-full pl-11 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
                  placeholder="Minimum 6 caractères" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Confirmer le mot de passe</label>
              <div className={`relative rounded-xl transition-all duration-300 ${focused === 'confirm' ? 'ring-2 ring-primary/30 shadow-md shadow-primary/5' : ''}`}>
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === 'confirm' ? 'text-primary' : 'text-muted-foreground/50'}`} size={18} />
                <input type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)}
                  className="w-full pl-11 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
                  placeholder="Confirmez votre mot de passe" required />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm animate-fade-in">
                <Shield size={16} className="shrink-0" /> {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="group w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              {loading ? (<><Loader2 className="animate-spin" size={20} /> Création en cours...</>) : (<>Créer mon compte <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" /></>)}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center animate-[fadeSlideUp_0.6s_ease-out_0.3s_both]">
          <button onClick={() => navigate('/auth')} className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Déjà un compte ? <span className="font-semibold">Se connecter</span>
          </button>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-6 text-center relative"
            >
              {/* Confetti icon */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                className="inline-flex items-center justify-center w-16 h-16 bg-accent/10 rounded-2xl mb-4 border border-accent/20 shadow-lg shadow-accent/10"
              >
                <PartyPopper size={30} className="text-accent" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl font-extrabold text-foreground mb-1 tracking-tight"
              >
                Félicitations ! 🎉
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="text-sm font-semibold text-primary mb-1"
              >
                Ton compte a été créé avec succès
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="text-xs text-muted-foreground mb-5"
              >
                Bienvenue dans la famille FCO ! 💪
              </motion.p>

              {/* Steps */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="bg-secondary/60 rounded-xl p-4 border border-border/50 mb-5"
              >
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Prochaines étapes
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Download size={14} className="text-accent" />
                    </div>
                    <p className="text-xs text-foreground">
                      Télécharge l'application <span className="font-bold">FCO Manager</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Smartphone size={14} className="text-primary" />
                    </div>
                    <p className="text-xs text-foreground">
                      Connecte-toi avec <span className="font-bold">{registeredEmail}</span>
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Download button */}
              <motion.a
                href="https://play.google.com/apps/testing/com.sekebou.fcomanager"
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, type: 'spring', stiffness: 150 }}
                className="group inline-flex items-center justify-center gap-2 w-full bg-accent text-accent-foreground py-3 rounded-xl font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-accent/20"
              >
                <Download size={16} />
                Télécharger sur Google Play
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform duration-300" />
              </motion.a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Register;
