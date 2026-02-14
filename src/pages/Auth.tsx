import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, signInWithEmailAndPassword, doc, getDoc } from '@/lib/firebase';
import { Lock, Mail, LogIn, Loader2 } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-primary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] -top-48 -left-48 animate-pulse" />
        <div className="absolute w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px] -bottom-32 -right-32 animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-2xl mb-4 shadow-lg shadow-accent/30">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground">FCO Manager</h1>
          <p className="text-primary-foreground/60 text-sm mt-1">Connectez-vous à votre espace</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border/10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none"
                  placeholder="votre@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-accent-foreground py-3 rounded-xl font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <LogIn size={20} />
              )}
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {/* Help */}
          <div className="mt-6 p-4 bg-secondary rounded-xl">
            <p className="text-xs font-semibold text-muted-foreground mb-2">💡 Comptes par défaut</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>• Admin : admin@fco-manager.local / admin123</p>
              <p>• Coach : coach@fco-manager.local / coach123</p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/30 rounded-full">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <p className="text-xs text-success font-medium">Serveur connecté</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
