import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, signInWithEmailAndPassword, doc, getDoc } from '@/lib/firebase';
import { Lock, Mail, LogIn, Loader2, Shield, ChevronRight } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists()) {
        throw new Error('Profil utilisateur introuvable. Contactez l\'administrateur.');
      }

      const userData = userDoc.data();
      sessionStorage.setItem('currentUser', JSON.stringify({
        uid: user.uid,
        email: user.email,
        role: userData.role,
        name: userData.name,
        username: userData.username || '',
        playerId: userData.playerId || null,
        photoURL: userData.photoURL || null,
      }));

      navigate('/');
    } catch (err: any) {
      let message = 'Erreur de connexion';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Email ou mot de passe incorrect';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Email invalide';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Trop de tentatives. Réessayez plus tard.';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex relative overflow-hidden">
      {/* Decorative side */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center">
        {/* Gradient orbs */}
        <div className="absolute w-[600px] h-[600px] bg-accent/15 rounded-full blur-[150px] -top-32 -left-32" />
        <div className="absolute w-[400px] h-[400px] bg-accent/10 rounded-full blur-[120px] bottom-0 right-0" />
        
        <div className="relative z-10 px-16 max-w-lg">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent/20 backdrop-blur-sm rounded-3xl mb-8 border border-accent/30">
            <span className="text-5xl">⚽</span>
          </div>
          <h1 className="text-5xl font-bold text-primary-foreground leading-tight mb-4">
            FCO
            <span className="block text-accent">Manager</span>
          </h1>
          <p className="text-primary-foreground/50 text-lg leading-relaxed">
            Gérez votre équipe, suivez les présences et les performances de vos joueurs en un seul endroit.
          </p>
          
          {/* Feature pills */}
          <div className="mt-10 space-y-3">
            {['Gestion des présences', 'Suivi des performances', 'Calendrier des événements'].map((feat) => (
              <div key={feat} className="flex items-center gap-3 text-primary-foreground/40">
                <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                <span className="text-sm font-medium">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/20 backdrop-blur-sm rounded-2xl mb-4 border border-accent/30">
              <span className="text-3xl">⚽</span>
            </div>
            <h1 className="text-3xl font-bold text-primary-foreground">
              FCO <span className="text-accent">Manager</span>
            </h1>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-primary-foreground">Connexion</h2>
            <p className="text-primary-foreground/40 text-sm mt-1">Accédez à votre espace de gestion</p>
          </div>

          {/* Form card */}
          <div className="bg-card/5 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-primary-foreground/10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-primary-foreground/60 uppercase tracking-wider mb-2">
                  Email
                </label>
                <div className={`relative rounded-xl transition-all duration-300 ${focused === 'email' ? 'ring-2 ring-accent/50' : ''}`}>
                  <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === 'email' ? 'text-accent' : 'text-primary-foreground/30'}`} size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    className="w-full pl-11 pr-4 py-3.5 bg-primary-foreground/5 border border-primary-foreground/10 rounded-xl text-primary-foreground placeholder:text-primary-foreground/20 focus:border-accent/50 transition-all outline-none text-sm"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-primary-foreground/60 uppercase tracking-wider mb-2">
                  Mot de passe
                </label>
                <div className={`relative rounded-xl transition-all duration-300 ${focused === 'password' ? 'ring-2 ring-accent/50' : ''}`}>
                  <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === 'password' ? 'text-accent' : 'text-primary-foreground/30'}`} size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    className="w-full pl-11 pr-4 py-3.5 bg-primary-foreground/5 border border-primary-foreground/10 rounded-xl text-primary-foreground placeholder:text-primary-foreground/20 focus:border-accent/50 transition-all outline-none text-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm animate-fade-in">
                  <Shield size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group w-full bg-accent text-accent-foreground py-3.5 rounded-xl font-semibold hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-accent/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Se connecter
                    <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
                {loading && 'Connexion...'}
              </button>
            </form>
          </div>

          {/* Help section */}
          <div className="mt-6 p-4 rounded-xl border border-primary-foreground/5 bg-primary-foreground/[0.02]">
            <p className="text-xs font-semibold text-primary-foreground/30 uppercase tracking-wider mb-3">Comptes démo</p>
            <div className="space-y-2">
              {[
                { label: 'Admin', email: 'admin@fco-manager.local', pass: 'admin123' },
                { label: 'Coach', email: 'coach@fco-manager.local', pass: 'coach123' },
              ].map((account) => (
                <button
                  key={account.label}
                  type="button"
                  onClick={() => { setEmail(account.email); setPassword(account.pass); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-primary-foreground/5 hover:bg-primary-foreground/10 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                      <span className="text-accent text-xs font-bold">{account.label[0]}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium text-primary-foreground/70">{account.label}</p>
                      <p className="text-[10px] text-primary-foreground/30">{account.email}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-primary-foreground/20 group-hover:text-accent transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="mt-6 flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/20 bg-success/5">
              <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              <p className="text-[11px] text-success/70 font-medium">Connecté</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
