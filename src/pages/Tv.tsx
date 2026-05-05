import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Tv as TvIcon, Lock, Mail, Loader2, LogOut, Search, Star, StarOff,
  Plus, Pencil, Trash2, X, Play, Maximize2, ChevronLeft, Radio,
} from "lucide-react";
import clubLogo from "@/assets/logo.png";
import { toast } from "sonner";

type SourceType = "cloudflare" | "iframe" | "m3u8";

interface Channel {
  id: string;
  name: string;
  category: string | null;
  source_type: SourceType;
  url: string;
  logo_url: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number | null;
}

/** Convert any Cloudflare Stream input (UID, watch URL, iframe URL, customer URL) to a clean iframe URL. */
function toCloudflareIframe(input: string): string {
  const v = input.trim();
  // Already a CF iframe URL
  if (/cloudflarestream\.com\/.+\/iframe/i.test(v)) return v;
  // customer-xxx.cloudflarestream.com/<uid>/...  → use that uid + customer
  const cust = v.match(/https?:\/\/(customer-[^/]+)\.cloudflarestream\.com\/([a-f0-9]{20,})/i);
  if (cust) return `https://${cust[1]}.cloudflarestream.com/${cust[2]}/iframe`;
  // watch.cloudflarestream.com/<uid>
  const watch = v.match(/cloudflarestream\.com\/([a-f0-9]{20,})/i);
  if (watch) return `https://iframe.cloudflarestream.com/${watch[1]}`;
  // Bare UID (32 hex chars)
  if (/^[a-f0-9]{20,}$/i.test(v)) return `https://iframe.cloudflarestream.com/${v}`;
  return v;
}

function buildPlayerUrl(c: Channel): string {
  if (c.source_type === "cloudflare") {
    const base = toCloudflareIframe(c.url);
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}autoplay=true&muted=false&preload=true&letterboxColor=transparent`;
  }
  return c.url;
}

const Tv = () => {
  // ----- Auth -----
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // ----- Data -----
  const [channels, setChannels] = useState<Channel[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // ----- UI -----
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setChannels([]);
      setFavorites(new Set());
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    void loadAll();
  }, [session?.user?.id]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: ch }, { data: fav }, { data: roles }] = await Promise.all([
      supabase.from("tv_channels").select("*").eq("is_active", true).order("sort_order", { ascending: true }).order("name"),
      supabase.from("tv_favorites").select("channel_id").eq("user_id", session.user.id),
      supabase.from("user_roles").select("role").eq("user_id", session.user.id),
    ]);
    setChannels((ch as any) || []);
    setFavorites(new Set((fav || []).map((f: any) => f.channel_id)));
    const r = (roles || []).map((x: any) => x.role);
    setIsAdmin(r.includes("admin") || r.includes("admin_plus") || r.includes("super_admin"));
    setLoading(false);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthError("Identifiants incorrects");
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPlaying(null);
  };

  const toggleFav = async (c: Channel) => {
    const isFav = favorites.has(c.id);
    const next = new Set(favorites);
    if (isFav) {
      next.delete(c.id);
      setFavorites(next);
      await supabase.from("tv_favorites").delete().eq("user_id", session.user.id).eq("channel_id", c.id);
    } else {
      next.add(c.id);
      setFavorites(next);
      await supabase.from("tv_favorites").insert({ user_id: session.user.id, channel_id: c.id });
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => c.category && set.add(c.category));
    return Array.from(set).sort();
  }, [channels]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels.filter((c) => {
      if (activeCat === "favs" && !favorites.has(c.id)) return false;
      if (activeCat !== "all" && activeCat !== "favs" && c.category !== activeCat) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.category || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [channels, search, activeCat, favorites]);

  // ============== AUTH GATE ==============
  if (!authReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={clubLogo} alt="FCO-Manager" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-xl" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
              <Radio className="w-3 h-3" /> FCO TV
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Connexion requise</h1>
            <p className="text-muted-foreground mt-2 text-sm">Accès réservé aux membres FCO-Manager</p>
          </div>
          <form onSubmit={handleLogin} className="bg-card/80 backdrop-blur-xl border border-border rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 pl-11 pr-4 rounded-xl bg-secondary/60 border border-transparent focus:border-primary focus:bg-background outline-none text-base transition-colors"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                required
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-11 pr-4 rounded-xl bg-secondary/60 border border-transparent focus:border-primary focus:bg-background outline-none text-base transition-colors"
              />
            </div>
            {authError && <p className="text-destructive text-sm text-center">{authError}</p>}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
            >
              {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Se connecter</>}
            </button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-6">© FCO-Manager · TV</p>
        </div>
      </div>
    );
  }

  // ============== APP ==============
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TvIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight leading-none">FCO TV</h1>
            <p className="text-xs text-muted-foreground leading-none mt-1">Streams en direct</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Chaîne</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 active:scale-95 transition"
            aria-label="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Search + categories */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une chaîne…"
              className="w-full h-11 pl-11 pr-4 rounded-full bg-secondary/70 border border-transparent focus:border-primary focus:bg-background outline-none text-base transition-colors"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>Toutes</CatChip>
            <CatChip active={activeCat === "favs"} onClick={() => setActiveCat("favs")} icon={<Star className="w-3.5 h-3.5" />}>Favoris</CatChip>
            {categories.map((c) => (
              <CatChip key={c} active={activeCat === c} onClick={() => setActiveCat(c)}>{c}</CatChip>
            ))}
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
              <TvIcon className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              {channels.length === 0 ? "Aucune chaîne disponible pour le moment." : "Aucun résultat."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((c) => (
              <ChannelCard
                key={c.id}
                channel={c}
                isFav={favorites.has(c.id)}
                isAdmin={isAdmin}
                onPlay={() => setPlaying(c)}
                onFav={() => toggleFav(c)}
                onEdit={() => { setEditing(c); setShowForm(true); }}
              />
            ))}
          </div>
        )}
      </main>

      {playing && <PlayerModal channel={playing} onClose={() => setPlaying(null)} />}
      {showForm && isAdmin && (
        <ChannelForm
          channel={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void loadAll(); }}
          onDeleted={() => { setShowForm(false); void loadAll(); }}
        />
      )}
    </div>
  );
};

const CatChip = ({ active, onClick, children, icon }: any) => (
  <button
    onClick={onClick}
    className={`shrink-0 h-9 px-4 rounded-full text-sm font-medium flex items-center gap-1.5 transition active:scale-95 ${
      active ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary/70 text-foreground hover:bg-secondary"
    }`}
  >
    {icon}{children}
  </button>
);

// ================= CARD =================
const ChannelCard = ({ channel, isFav, isAdmin, onPlay, onFav, onEdit }: {
  channel: Channel; isFav: boolean; isAdmin: boolean;
  onPlay: () => void; onFav: () => void; onEdit: () => void;
}) => {
  return (
    <div className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
      <button onClick={onPlay} className="block w-full text-left">
        <div className="relative aspect-video bg-gradient-to-br from-primary/15 via-primary/5 to-secondary overflow-hidden">
          {channel.logo_url ? (
            <img src={channel.logo_url} alt={channel.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <TvIcon className="w-12 h-12 text-primary/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
              <Play className="w-6 h-6 text-primary fill-primary ml-0.5" />
            </div>
          </div>
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/95 text-white text-[10px] font-bold tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm truncate">{channel.name}</h3>
              {channel.category && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{channel.category}</p>
              )}
            </div>
          </div>
        </div>
      </button>
      <div className="absolute top-2 right-2 flex flex-col gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onFav(); }}
          className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 active:scale-90 transition"
          aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
        >
          {isFav ? <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /> : <StarOff className="w-4 h-4" />}
        </button>
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 active:scale-90 transition"
            aria-label="Modifier"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

// ================= PLAYER MODAL =================
const PlayerModal = ({ channel, onClose }: { channel: Channel; onClose: () => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const url = buildPlayerUrl(channel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const goFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14 text-white shrink-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{channel.name}</h2>
          {channel.category && <p className="text-xs text-white/60 truncate">{channel.category}</p>}
        </div>
        <button onClick={goFullscreen} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition" aria-label="Plein écran">
          <Maximize2 className="w-4 h-4" />
        </button>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition" aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-2 sm:p-6">
        <div ref={containerRef} className="w-full max-w-6xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
          <iframe
            src={url}
            title={channel.name}
            className="w-full h-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="eager"
          />
        </div>
      </div>
      {channel.description && (
        <div className="px-6 pb-6 text-white/70 text-sm max-w-3xl mx-auto text-center">{channel.description}</div>
      )}
    </div>
  );
};

// ================= ADMIN FORM =================
const ChannelForm = ({ channel, onClose, onSaved, onDeleted }: {
  channel: Channel | null; onClose: () => void; onSaved: () => void; onDeleted: () => void;
}) => {
  const [name, setName] = useState(channel?.name || "");
  const [category, setCategory] = useState(channel?.category || "");
  const [sourceType, setSourceType] = useState<SourceType>(channel?.source_type || "cloudflare");
  const [url, setUrl] = useState(channel?.url || "");
  const [logoUrl, setLogoUrl] = useState(channel?.logo_url || "");
  const [description, setDescription] = useState(channel?.description || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      category: category.trim() || null,
      source_type: sourceType,
      url: url.trim(),
      logo_url: logoUrl.trim() || null,
      description: description.trim() || null,
      is_active: true,
    };
    let error;
    if (channel) {
      ({ error } = await supabase.from("tv_channels").update(payload).eq("id", channel.id));
    } else {
      ({ error } = await supabase.from("tv_channels").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Erreur : " + error.message); return; }
    toast.success(channel ? "Chaîne mise à jour" : "Chaîne ajoutée");
    onSaved();
  };

  const remove = async () => {
    if (!channel) return;
    if (!confirm(`Supprimer la chaîne "${channel.name}" ?`)) return;
    const { error } = await supabase.from("tv_channels").delete().eq("id", channel.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Chaîne supprimée");
    onDeleted();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-150">
      <form
        onSubmit={save}
        className="w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border px-5 py-4 flex items-center gap-3">
          <h2 className="font-bold text-lg flex-1">{channel ? "Modifier la chaîne" : "Nouvelle chaîne"}</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nom *">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="Ex: FCO Match du dimanche" />
          </Field>
          <Field label="Catégorie">
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="Ex: Matchs, Replays…" />
          </Field>
          <Field label="Type de source">
            <div className="grid grid-cols-3 gap-2">
              {(["cloudflare", "iframe", "m3u8"] as SourceType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSourceType(t)}
                  className={`h-11 rounded-xl text-sm font-medium transition ${
                    sourceType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/70"
                  }`}
                >
                  {t === "cloudflare" ? "Cloudflare" : t === "iframe" ? "Iframe" : "HLS"}
                </button>
              ))}
            </div>
          </Field>
          <Field label={sourceType === "cloudflare" ? "URL ou UID Cloudflare *" : "URL *"}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} required className={inputCls}
              placeholder={sourceType === "cloudflare" ? "UID, customer-xxx.cloudflarestream.com/<uid>… ou /iframe" : "https://…"} />
            {sourceType === "cloudflare" && (
              <p className="text-xs text-muted-foreground mt-1.5">Accepte le UID, l'URL customer-xxx ou l'URL /iframe complète.</p>
            )}
          </Field>
          <Field label="Logo / vignette (URL)">
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={inputCls} placeholder="https://…" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-none py-3`} placeholder="Optionnel" />
          </Field>
        </div>
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-border px-5 py-4 flex gap-2" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {channel && (
            <button type="button" onClick={remove} className="h-11 px-4 rounded-xl bg-destructive/10 text-destructive font-medium flex items-center gap-1.5 hover:bg-destructive/15 active:scale-95 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl bg-secondary font-medium hover:bg-secondary/70 active:scale-[0.98] transition">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : channel ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
};

const inputCls = "w-full h-11 px-4 rounded-xl bg-secondary/60 border border-transparent focus:border-primary focus:bg-background outline-none text-base transition-colors";

const Field = ({ label, children }: { label: string; children: any }) => (
  <div>
    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

export default Tv;
