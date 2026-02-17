import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signInWithEmailAndPassword, sendPasswordResetEmail, doc, getDoc } from "@/lib/firebase";
import { Lock, Mail, Loader2, Shield, ChevronRight, Users, TrendingUp, Calendar, ArrowLeft } from "lucide-react";
import clubLogo from "@/assets/logo.svg";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (!userDoc.exists()) {
        throw new Error("Profil utilisateur introuvable. Contactez l'administrateur.");
      }

      const userData = userDoc.data();
      sessionStorage.setItem(
        "currentUser",
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          role: userData.role,
          name: userData.name,
          username: userData.username || "",
          playerId: userData.playerId || null,
          photoURL: userData.photoURL || null,
        }),
      );

      navigate("/");
    } catch (err: any) {
      let message = "Erreur de connexion";
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        message = "Email ou mot de passe incorrect";
      } else if (err.code === "auth/invalid-email") {
        message = "Email invalide";
      } else if (err.code === "auth/too-many-requests") {
        message = "Trop de tentatives. Réessayez plus tard.";
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Veuillez entrer votre adresse email");
      return;
    }
    setError("");
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success("Email envoyé ! Vérifiez aussi vos spams / courriers indésirables.", { duration: 6000 });
      setForgotMode(false);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("Aucun compte associé à cet email");
      } else if (err.code === "auth/invalid-email") {
        setError("Email invalide");
      } else if (err.code === "auth/too-many-requests") {
        setError("Trop de tentatives. Réessayez plus tard.");
      } else {
        setError("Erreur lors de l'envoi. Réessayez.");
      }
    } finally {
      setResetLoading(false);
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
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 px-16 max-w-lg flex flex-col items-center text-center">
          {/* Club logo - large and prominent */}
          <div className="inline-flex items-center justify-center w-36 h-36 bg-white/15 backdrop-blur-md rounded-3xl mb-8 border border-white/25 shadow-xl shadow-black/10 animate-[fadeSlideUp_0.8s_ease-out_both] hover:scale-105 hover:bg-white/20 transition-all duration-500">
            <img src={clubLogo} alt="FCO Logo" className="w-28 h-28 object-contain drop-shadow-lg" />
          </div>

          {/* Title - single line */}
          <h1 className="text-4xl font-extrabold tracking-wide uppercase leading-tight mb-4 animate-[fadeSlideUp_0.8s_ease-out_0.1s_both]">
            <span className="inline-block text-white animate-[glowText_4s_ease-in-out_infinite]">FCO</span>
            <span className="ml-3 inline-block text-white animate-[glowText_4s_ease-in-out_infinite_2s]">Manager</span>
          </h1>

          {/* Subtitle */}
          <p className="text-white/35 text-lg leading-relaxed animate-[fadeSlideUp_0.8s_ease-out_0.2s_both]">
            Gérez votre équipe, suivez les présences et les performances de vos joueurs en un seul endroit.
          </p>

          {/* Separator line */}
          <div className="mt-8 mb-8 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[fadeSlideUp_0.8s_ease-out_0.3s_both]" />

          {/* Feature pills - 3 features + "et bien plus" */}
          <div className="space-y-3 w-full">
            {[
              { Icon: Users, text: "Gestion des présences" },
              { Icon: TrendingUp, text: "Suivi des performances" },
              { Icon: Calendar, text: "Calendrier des événements" },
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
            <p
              className="text-xs text-white/30 font-medium pt-1 animate-[fadeSlideUp_0.6s_ease-out_both]"
              style={{ animationDelay: "0.76s" }}
            >
              … et bien d'autres fonctionnalités
            </p>
          </div>

          {/* Bottom decorative text */}
          <p className="mt-10 text-[11px] uppercase tracking-[0.2em] text-white/20 font-semibold animate-[fadeSlideUp_0.6s_ease-out_0.8s_both]">
            Football Club Organisation
          </p>
        </div>
      </div>

      {/* Login side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-primary lg:bg-background relative overflow-hidden">
        {/* Mobile decorative blobs */}
        <div className="absolute w-[300px] h-[300px] bg-white/[0.07] rounded-full blur-[80px] -top-16 -right-16 lg:hidden" />
        <div className="absolute w-[200px] h-[200px] bg-white/[0.05] rounded-full blur-[60px] bottom-10 -left-10 lg:hidden" />
        {/* Desktop decorative circles */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/[0.03] rounded-full hidden lg:block" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-primary/[0.02] rounded-full hidden lg:block" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10 animate-[fadeSlideUp_0.6s_ease-out_both]">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/15 backdrop-blur-md rounded-2xl mb-4 border border-white/25 shadow-xl shadow-black/10">
              <img src={clubLogo} alt="FCO Logo" className="w-14 h-14 object-contain drop-shadow-lg" />
            </div>
            <h1 className="text-3xl font-bold text-white uppercase tracking-wide">
              FCO Manager
            </h1>
          </div>

          {/* Header */}
          <div className="mb-8 animate-[fadeSlideUp_0.6s_ease-out_0.05s_both]">
            <h2 className="text-2xl font-bold text-white lg:text-foreground">Connexion</h2>
            <p className="text-white/60 lg:text-muted-foreground text-sm mt-1">Accédez à votre espace de gestion</p>
          </div>

          {/* Form card */}
          <div className="bg-white/10 backdrop-blur-md lg:bg-card lg:backdrop-blur-none rounded-2xl p-6 sm:p-8 border border-white/20 lg:border-border shadow-sm animate-[fadeSlideUp_0.6s_ease-out_0.1s_both]">
            {forgotMode ? (
              /* Forgot password form */
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError(""); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ArrowLeft size={16} />
                  Retour
                </button>

                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Mot de passe oublié</h3>
                  <p className="text-sm text-muted-foreground">Entrez votre email pour recevoir un lien de réinitialisation.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <div
                    className={`relative rounded-xl transition-all duration-300 ${focused === "email" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5" : ""}`}
                  >
                    <Mail
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === "email" ? "text-primary" : "text-muted-foreground/50"}`}
                      size={18}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      className="w-full pl-11 pr-4 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
                      placeholder="votre@email.com"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm animate-fade-in">
                    <Shield size={16} className="shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="group w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Envoi...
                    </>
                  ) : (
                    <>
                      Envoyer le lien
                      <Mail size={18} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Login form */
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-white/70 lg:text-muted-foreground uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <div
                    className={`relative rounded-xl transition-all duration-300 ${focused === "email" ? "ring-2 ring-white/30 lg:ring-primary/30 shadow-md shadow-black/10 lg:shadow-primary/5" : ""}`}
                  >
                    <Mail
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === "email" ? "text-white lg:text-primary" : "text-white/40 lg:text-muted-foreground/50"}`}
                      size={18}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      className="w-full pl-11 pr-4 py-3.5 bg-white/20 lg:bg-secondary border border-white/20 lg:border-border rounded-xl text-white lg:text-foreground placeholder:text-white/40 lg:placeholder:text-muted-foreground/50 focus:border-white/40 lg:focus:border-primary/50 transition-all outline-none text-sm"
                      placeholder="votre@email.com"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-white/70 lg:text-muted-foreground uppercase tracking-wider">
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setError(""); }}
                      className="text-xs text-white/70 lg:text-primary hover:text-white lg:hover:text-primary/80 font-medium transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div
                    className={`relative rounded-xl transition-all duration-300 ${focused === "password" ? "ring-2 ring-white/30 lg:ring-primary/30 shadow-md shadow-black/10 lg:shadow-primary/5" : ""}`}
                  >
                    <Lock
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === "password" ? "text-white lg:text-primary" : "text-white/40 lg:text-muted-foreground/50"}`}
                      size={18}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      className="w-full pl-11 pr-4 py-3.5 bg-white/20 lg:bg-secondary border border-white/20 lg:border-border rounded-xl text-white lg:text-foreground placeholder:text-white/40 lg:placeholder:text-muted-foreground/50 focus:border-white/40 lg:focus:border-primary/50 transition-all outline-none text-sm"
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
                  className="group w-full bg-white text-primary lg:bg-primary lg:text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-white/90 lg:hover:bg-primary/90 hover:shadow-xl hover:shadow-black/15 lg:hover:shadow-primary/25 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-black/10 lg:shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      Se connecter
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                    </>
                  )}
                  {loading && "Connexion..."}
                </button>
              </form>
            )}
          </div>

          {/* Help section */}
          <div className="mt-6 p-4 rounded-xl border border-white/20 lg:border-border bg-white/10 lg:bg-secondary/50 backdrop-blur-md lg:backdrop-blur-none animate-[fadeSlideUp_0.6s_ease-out_0.2s_both]">
            <p className="text-xs font-semibold text-white/60 lg:text-muted-foreground uppercase tracking-wider mb-3">Comptes démo</p>
            <div className="space-y-2">
              {[
                { label: "Admin", email: "admin@fco-manager.local", pass: "admin123" },
                { label: "Coach", email: "coach@fco-manager.local", pass: "coach123" },
              ].map((account) => (
                <button
                  key={account.label}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.pass);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/10 lg:bg-card hover:bg-white/20 lg:hover:bg-primary/5 border border-white/15 lg:border-border hover:border-white/30 lg:hover:border-primary/20 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/20 lg:bg-primary/10 flex items-center justify-center group-hover:bg-white/30 lg:group-hover:bg-primary/15 transition-colors">
                      <span className="text-white lg:text-primary text-xs font-bold">{account.label[0]}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium text-white lg:text-foreground">{account.label}</p>
                      <p className="text-[10px] text-white/60 lg:text-muted-foreground">{account.email}</p>
                    </div>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-white/50 lg:text-muted-foreground group-hover:text-white lg:group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="mt-6 flex justify-center animate-[fadeSlideUp_0.6s_ease-out_0.3s_both]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/20 bg-success/5">
              <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              <p className="text-[11px] text-success/70 font-medium">Connecté au serveur</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
