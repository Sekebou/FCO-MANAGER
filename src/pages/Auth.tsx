import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, signInWithEmailAndPassword, doc, getDoc } from '@/lib/firebase';
import { Lock, Mail, Loader2, Shield, ChevronRight } from 'lucide-react';

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
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-primary overflow-hidden">
        {/* Animated gradient blobs */}
        <div className="absolute w-[500px] h-[500px] bg-white/[0.07] rounded-full blur-[100px] -top-20 -left-20 animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute w-[350px] h-[350px] bg-white/[0.05] rounded-full blur-[80px] bottom-10 right-10 animate-[pulse_6s_ease-in-out_infinite_1s]" />
        <div className="absolute w-[200px] h-[200px] bg-white/[0.04] rounded-full blur-[60px] top-1/2 left-1/4 animate-[pulse_7s_ease-in-out_infinite_2s]" />

        {/* Geometric lines pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `linear-gradient(45deg, white 1px, transparent 1px), linear-gradient(-45deg, white 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        <div className="relative z-10 px-16 max-w-lg">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl mb-8 border border-white/20 animate-[fadeSlideUp_0.8s_ease-out_both]">
            <span className="text-5xl">⚽</span>
          </div>
          <h1 className="text-5xl font-bold text-white leading-tight mb-4 animate-[fadeSlideUp_0.8s_ease-out_0.1s_both]">
            FCO
            <span className="block text-white/70">Manager</span>
          </h1>
          <p className="text-white/40 text-lg leading-relaxed animate-[fadeSlideUp_0.8s_ease-out_0.2s_both]">
            Gérez votre équipe, suivez les présences et les performances de vos joueurs en un seul endroit.
          </p>
          
          {/* Feature pills */}
          <div className="mt-10 space-y-3">
            {['Gestion des présences', 'Suivi des performances', 'Calendrier des événements'].map((feat, i) => (
              <div key={feat} className="flex items-center gap-3 text-white/50 animate-[fadeSlideUp_0.6s_ease-out_both]" style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
                <div className="w-1.5 h-1.5 bg-white/60 rounded-full" />
                <span className="text-sm font-medium">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login side - white */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/[0.03] rounded-full" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-primary/[0.02] rounded-full" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10 animate-[fadeSlideUp_0.6s_ease-out_both]">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4 border border-primary/20">
              <span className="text-3xl">⚽</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              FCO <span className="text-primary">Manager</span>
            </h1>
          </div>

          {/* Header */}
          <div className="mb-8 animate-[fadeSlideUp_0.6s_ease-out_0.05s_both]">
            <h2 className="text-2xl font-bold text-foreground">Connexion</h2>
            <p className="text-muted-foreground text-sm mt-1">Accédez à votre espace de gestion</p>
          </div>

          {/* Form card */}
          <div className="bg-card rounded-2xl p-6 sm:p-8 border border-border shadow-sm animate-[fadeSlideUp_0.6s_ease-out_0.1s_both]">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Email
                </label>
                <div className={`relative rounded-xl transition-all duration-300 ${focused === 'email' ? 'ring-2 ring-primary/30 shadow-md shadow-primary/5' : ''}`}>
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
                <div className={`relative rounded-xl transition-all duration-300 ${focused === 'password' ? 'ring-2 ring-primary/30 shadow-md shadow-primary/5' : ''}`}>
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
                className="group w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Se connecter
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                  </>
                )}
                {loading && 'Connexion...'}
              </button>
            </form>
          </div>

          {/* Help section */}
          <div className="mt-6 p-4 rounded-xl border border-border bg-secondary/50 animate-[fadeSlideUp_0.6s_ease-out_0.2s_both]">
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
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-card hover:bg-primary/5 border border-border hover:border-primary/20 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                      <span className="text-primary text-xs font-bold">{account.label[0]}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium text-foreground">{account.label}</p>
                      <p className="text-[10px] text-muted-foreground">{account.email}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="mt-6 flex justify-center animate-[fadeSlideUp_0.6s_ease-out_0.3s_both]">
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
