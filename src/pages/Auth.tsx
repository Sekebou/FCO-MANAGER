import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, signInWithEmailAndPassword, doc, getDoc } from '@/lib/firebase';
import { Lock, Mail, LogIn, Loader2, Shield, ChevronRight } from 'lucide-react';

const FlatBall = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="currentColor" opacity="0.08" />
    <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
    {/* Pentagon center */}
    <polygon points="50,30 62,40 58,55 42,55 38,40" fill="currentColor" opacity="0.15" />
    {/* Pentagon top */}
    <polygon points="50,8 60,18 50,30 40,18" fill="currentColor" opacity="0.1" />
    {/* Pentagon right top */}
    <polygon points="75,20 78,35 62,40 50,30 60,18" fill="currentColor" opacity="0.12" />
    {/* Pentagon right bottom */}
    <polygon points="78,35 82,55 70,65 58,55 62,40" fill="currentColor" opacity="0.1" />
    {/* Pentagon left bottom */}
    <polygon points="22,55 18,35 38,40 42,55 30,65" fill="currentColor" opacity="0.12" />
    {/* Pentagon left top */}
    <polygon points="18,35 25,20 40,18 50,30 38,40" fill="currentColor" opacity="0.1" />
    {/* Pentagon bottom */}
    <polygon points="30,65 42,55 50,70 58,55 70,65 62,80 38,80" fill="currentColor" opacity="0.08" />
    {/* Seam lines */}
    <path d="M50 8 L50 30 M75 20 L62 40 M78 35 L62 40 M82 55 L58 55 M70 65 L58 55 M62 80 L50 70 M38 80 L50 70 M30 65 L42 55 M22 55 L42 55 M18 35 L38 40 M25 20 L38 40 M40 18 L50 30 M60 18 L50 30" stroke="currentColor" strokeWidth="0.8" opacity="0.12" />
  </svg>
);

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
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Decorative side - blue club */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-primary">
        {/* Floating flat balls */}
        <FlatBall className="absolute top-12 right-16 w-24 h-24 text-white animate-[spin_40s_linear_infinite]" />
        <FlatBall className="absolute bottom-20 left-12 w-16 h-16 text-white animate-[spin_30s_linear_infinite_reverse]" />
        <FlatBall className="absolute top-1/3 right-8 w-10 h-10 text-white animate-[spin_25s_linear_infinite]" />
        <FlatBall className="absolute bottom-1/3 left-32 w-14 h-14 text-white animate-[spin_35s_linear_infinite_reverse]" />
        <FlatBall className="absolute top-[60%] right-32 w-8 h-8 text-white animate-[spin_20s_linear_infinite]" />

        <div className="absolute w-[600px] h-[600px] bg-white/5 rounded-full blur-[150px] -top-32 -left-32" />
        <div className="absolute w-[400px] h-[400px] bg-white/5 rounded-full blur-[120px] bottom-0 right-0" />
        
        <div className="relative z-10 px-16 max-w-lg">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl mb-8 border border-white/20">
            <span className="text-5xl">⚽</span>
          </div>
          <h1 className="text-5xl font-bold text-white leading-tight mb-4">
            FCO
            <span className="block text-white/70">Manager</span>
          </h1>
          <p className="text-white/40 text-lg leading-relaxed">
            Gérez votre équipe, suivez les présences et les performances de vos joueurs en un seul endroit.
          </p>
          
          {/* Feature pills */}
          <div className="mt-10 space-y-3">
            {['Gestion des présences', 'Suivi des performances', 'Calendrier des événements'].map((feat) => (
              <div key={feat} className="flex items-center gap-3 text-white/50">
                <div className="w-1.5 h-1.5 bg-white/60 rounded-full" />
                <span className="text-sm font-medium">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login side - white */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background relative">
        {/* Subtle floating balls on white side */}
        <FlatBall className="absolute top-8 right-8 w-12 h-12 text-primary/20 animate-[spin_35s_linear_infinite]" />
        <FlatBall className="absolute bottom-12 left-8 w-10 h-10 text-primary/15 animate-[spin_28s_linear_infinite_reverse]" />
        <FlatBall className="absolute top-1/4 left-6 w-6 h-6 text-primary/10 animate-[spin_22s_linear_infinite]" />
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4 border border-primary/20">
              <span className="text-3xl">⚽</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              FCO <span className="text-primary">Manager</span>
            </h1>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Connexion</h2>
            <p className="text-muted-foreground text-sm mt-1">Accédez à votre espace de gestion</p>
          </div>

          {/* Form card */}
          <div className="bg-card rounded-2xl p-6 sm:p-8 border border-border shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Email
                </label>
                <div className={`relative rounded-xl transition-all duration-300 ${focused === 'email' ? 'ring-2 ring-primary/30' : ''}`}>
                  <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === 'email' ? 'text-primary' : 'text-muted-foreground/50'}`} size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    className="w-full pl-11 pr-4 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Mot de passe
                </label>
                <div className={`relative rounded-xl transition-all duration-300 ${focused === 'password' ? 'ring-2 ring-primary/30' : ''}`}>
                  <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === 'password' ? 'text-primary' : 'text-muted-foreground/50'}`} size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    className="w-full pl-11 pr-4 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
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
                className="group w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
          <div className="mt-6 p-4 rounded-xl border border-border bg-secondary/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Comptes démo</p>
            <div className="space-y-2">
              {[
                { label: 'Admin', email: 'admin@fco-manager.local', pass: 'admin123' },
                { label: 'Coach', email: 'coach@fco-manager.local', pass: 'coach123' },
              ].map((account) => (
                <button
                  key={account.label}
                  type="button"
                  onClick={() => { setEmail(account.email); setPassword(account.pass); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-card hover:bg-primary/5 border border-border transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-xs font-bold">{account.label[0]}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium text-foreground">{account.label}</p>
                      <p className="text-[10px] text-muted-foreground">{account.email}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
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
