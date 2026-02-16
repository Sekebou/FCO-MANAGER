import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, signInWithEmailAndPassword, doc, getDoc } from '@/lib/firebase';
import { Lock, Mail, Loader2, Shield, ChevronRight, Users, TrendingUp, Calendar } from 'lucide-react';
import clubLogo from '@/assets/logo.svg';

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

        {/* Floating ring decorations */}
        <div className="absolute top-16 right-20 w-32 h-32 rounded-full border border-white/[0.08] animate-[floatSlow_12s_ease-in-out_infinite]" />
        <div className="absolute bottom-24 left-16 w-20 h-20 rounded-full border border-white/[0.06] animate-[floatSlow_10s_ease-in-out_infinite_2s]" />
        <div className="absolute top-1/2 right-12 w-12 h-12 rounded-full border border-white/[0.05] animate-[floatSlow_8s_ease-in-out_infinite_4s]" />

        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }} />

        <div className="relative z-10 px-16 max-w-lg">
          {/* Animated icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl mb-8 border border-white/20 animate-[fadeSlideUp_0.8s_ease-out_both] hover:scale-105 hover:bg-white/15 transition-all duration-500">
            <img src={clubLogo} alt="FCO Logo" className="w-14 h-14 object-contain" />
          </div>

          {/* Title with shimmer highlight */}
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-4 animate-[fadeSlideUp_0.8s_ease-out_0.1s_both]">
            <span className="inline-block animate-[glowText_4s_ease-in-out_infinite]">FCO</span>
            <span className="block text-3xl font-semibold text-white/50 mt-1 tracking-wide">Manager</span>
          </h1>

          {/* Subtitle with typing feel */}
          <p className="text-white/35 text-lg leading-relaxed animate-[fadeSlideUp_0.8s_ease-out_0.2s_both]">
            Gérez votre équipe, suivez les présences et les performances de vos joueurs en un seul endroit.
          </p>
          
          {/* Separator line */}
          <div className="mt-8 mb-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[fadeSlideUp_0.8s_ease-out_0.3s_both]" />

          {/* Feature pills - modern cards */}
          <div className="space-y-3">
            {[
              { Icon: Users, text: 'Gestion des présences' },
              { Icon: TrendingUp, text: 'Suivi des performances' },
              { Icon: Calendar, text: 'Calendrier des événements' },
            ].map((feat, i) => (
              <div
                key={feat.text}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-300 cursor-default animate-[fadeSlideUp_0.6s_ease-out_both]"
                style={{ animationDelay: `${0.4 + i * 0.12}s` }}
              >
                <feat.Icon size={18} className="text-white/50 shrink-0" />
                <span className="text-sm font-medium text-white/60">{feat.text}</span>
              </div>
            ))}
          </div>

          {/* Bottom decorative text */}
          <p className="mt-10 text-[11px] uppercase tracking-[0.2em] text-white/20 font-semibold animate-[fadeSlideUp_0.6s_ease-out_0.8s_both]">
            Football Club Organisation
          </p>
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
              <img src={clubLogo} alt="FCO Logo" className="w-10 h-10 object-contain" />
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
