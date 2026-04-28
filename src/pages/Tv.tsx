import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tv as TvIcon, Lock, LogOut, Plus, Pencil, Trash2, Star, Search, X, Play, Cast } from "lucide-react";
import { toast } from "sonner";
import clubLogo from "@/assets/logo.png";
import Hls from "hls.js";
// @ts-ignore - plyr ships without default-export types but exports default at runtime
import Plyr from "plyr";
import "plyr/dist/plyr.css";

type Channel = {
  id: string;
  name: string;
  category: string;
  source_type: "m3u8" | "iframe";
  url: string;
  logo_url: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

const CATEGORIES = ["Ligue 1", "Ligue 2", "Champions League", "Europa League", "Premier League", "Liga", "Autres sports", "Autre"];

const Tv = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<{ name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [channels, setChannels] = useState<Channel[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Toutes");
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Channel> | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [castAvailable, setCastAvailable] = useState(false);
  const [castConnected, setCastConnected] = useState(false);

  const isAdmin = profile?.role === "admin" || profile?.role === "admin+";

  // Load Google Cast SDK once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).__castLoaded) return;
    (window as any).__castLoaded = true;

    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (!isAvailable) return;
      const ctx = (window as any).cast.framework.CastContext.getInstance();
      ctx.setOptions({
        receiverApplicationId: (window as any).chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: (window as any).chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });
      setCastAvailable(true);
      ctx.addEventListener(
        (window as any).cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        (e: any) => {
          const CONNECTED = (window as any).cast.framework.CastState.CONNECTED;
          setCastConnected(e.castState === CONNECTED);
        }
      );
    };

    const s = document.createElement("script");
    s.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const startCasting = async () => {
    if (!activeChannel) return;
    if (activeChannel.source_type !== "m3u8") {
      toast.error("Le casting n'est pas disponible pour les flux iframe");
      return;
    }
    try {
      const w = window as any;
      const ctx = w.cast.framework.CastContext.getInstance();
      await ctx.requestSession();
      const session = ctx.getCurrentSession();
      if (!session) return;

      const mediaInfo = new w.chrome.cast.media.MediaInfo(activeChannel.url, "application/x-mpegURL");
      mediaInfo.metadata = new w.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = activeChannel.name;
      mediaInfo.metadata.subtitle = activeChannel.category;
      if (activeChannel.logo_url) {
        mediaInfo.metadata.images = [new w.chrome.cast.Image(activeChannel.logo_url)];
      }
      const request = new w.chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(request);
      toast.success("📺 Diffusion sur la TV");
    } catch (e: any) {
      if (e !== "cancel") toast.error("Impossible de lancer le cast");
    }
  };

  const stopCasting = () => {
    try {
      const w = window as any;
      w.cast.framework.CastContext.getInstance().endCurrentSession(true);
      toast.success("Diffusion arrêtée");
    } catch {}
  };

  // Auth bootstrap
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id);
      else setProfile(null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("name, role").eq("id", uid).maybeSingle();
    if (data) setProfile(data as any);
  };

  // Load channels & favorites once authenticated
  useEffect(() => {
    if (!session?.user) return;
    loadChannels();
    loadFavorites(session.user.id);
  }, [session?.user?.id]);

  const loadChannels = async () => {
    const { data, error } = await supabase
      .from("tv_channels")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) { toast.error("Impossible de charger les chaînes"); return; }
    setChannels((data || []) as Channel[]);
  };

  const loadFavorites = async (uid: string) => {
    const { data } = await supabase.from("tv_favorites").select("channel_id").eq("user_id", uid);
    setFavorites(new Set((data || []).map((f: any) => f.channel_id)));
  };

  const toggleFavorite = async (channelId: string) => {
    if (!session?.user) return;
    if (favorites.has(channelId)) {
      await supabase.from("tv_favorites").delete().eq("user_id", session.user.id).eq("channel_id", channelId);
      setFavorites((s) => { const n = new Set(s); n.delete(channelId); return n; });
    } else {
      await supabase.from("tv_favorites").insert({ user_id: session.user.id, channel_id: channelId });
      setFavorites((s) => new Set(s).add(channelId));
    }
  };

  // Player setup
  useEffect(() => {
    if (!activeChannel || activeChannel.source_type !== "m3u8") return;
    if (!videoRef.current) return;

    // Cleanup previous
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }

    const video = videoRef.current;
    const url = activeChannel.url;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    }

    playerRef.current = new Plyr(video, {
      controls: ["play-large", "play", "progress", "current-time", "mute", "volume", "settings", "pip", "airplay", "fullscreen"],
      settings: ["quality", "speed"],
      autoplay: true,
    });

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [activeChannel?.id, activeChannel?.url, activeChannel?.source_type]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setAuthLoading(false);
    if (error) toast.error("Identifiants incorrects");
    else { setEmail(""); setPassword(""); toast.success("Connecté"); }
  };

  const handleLogout = async () => {
    if (hlsRef.current) hlsRef.current.destroy();
    if (playerRef.current) playerRef.current.destroy();
    setActiveChannel(null);
    await supabase.auth.signOut();
  };

  const openEditor = (ch?: Channel) => {
    setEditing(ch ? { ...ch } : { name: "", category: "Ligue 1", source_type: "m3u8", url: "", logo_url: "", description: "", is_active: true, sort_order: 0 });
    setEditorOpen(true);
  };

  const saveChannel = async () => {
    if (!editing?.name?.trim() || !editing?.url?.trim()) { toast.error("Nom et URL obligatoires"); return; }
    const payload = {
      name: editing.name.trim(),
      category: editing.category || "Autre",
      source_type: editing.source_type || "m3u8",
      url: editing.url.trim(),
      logo_url: editing.logo_url?.trim() || null,
      description: editing.description?.trim() || null,
      is_active: editing.is_active ?? true,
      sort_order: editing.sort_order ?? 0,
    };
    if (editing.id) {
      const { error } = await supabase.from("tv_channels").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erreur: " + error.message); return; }
      toast.success("Chaîne mise à jour");
    } else {
      const { error } = await supabase.from("tv_channels").insert({ ...payload, created_by: session.user.id });
      if (error) { toast.error("Erreur: " + error.message); return; }
      toast.success("Chaîne ajoutée");
    }
    setEditorOpen(false);
    setEditing(null);
    loadChannels();
  };

  const deleteChannel = async (id: string) => {
    if (!confirm("Supprimer cette chaîne ?")) return;
    const { error } = await supabase.from("tv_channels").delete().eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    toast.success("Chaîne supprimée");
    if (activeChannel?.id === id) setActiveChannel(null);
    loadChannels();
  };

  const filtered = useMemo(() => {
    let list = channels.filter((c) => c.is_active || isAdmin);
    if (activeCategory === "Favoris") list = list.filter((c) => favorites.has(c.id));
    else if (activeCategory !== "Toutes") list = list.filter((c) => c.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    }
    return list;
  }, [channels, favorites, activeCategory, search, isAdmin]);

  const visibleCategories = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => { if (c.is_active || isAdmin) set.add(c.category); });
    return ["Toutes", "Favoris", ...Array.from(set).sort()];
  }, [channels, isAdmin]);

  // ============ LOADING ============
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Chargement…</div>;
  }

  // ============ LOGIN GATE ============
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={clubLogo} alt="FCO-Manager" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-2xl" />
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
              <TvIcon className="w-7 h-7" /> FCO TV
            </h1>
            <p className="text-white/70 text-sm mt-2">Connexion requise pour accéder aux chaînes</p>
          </div>

          <form onSubmit={handleLogin} className="bg-card/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Lock className="w-4 h-4" />
              <span>Utilise ton compte FCO-Manager</span>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ fontSize: 16 }} />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ fontSize: 16 }} />
            </div>
            <Button type="submit" disabled={authLoading} className="w-full h-12 text-base font-semibold">
              {authLoading ? "Connexion…" : "Se connecter"}
            </Button>
            <p className="text-xs text-center text-muted-foreground pt-2">
              Pas encore de compte ? Télécharge l'app FCO-Manager.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ============ MAIN UI ============
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={clubLogo} alt="" className="w-9 h-9 rounded-xl" />
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2"><TvIcon className="w-5 h-5 text-primary" /> FCO TV</h1>
              <p className="text-xs text-muted-foreground">Bonjour {profile?.name?.split(" ")[0] || ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button size="sm" onClick={() => openEditor()} className="gap-1">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Ajouter</span>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleLogout} className="gap-1">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Active player */}
        {activeChannel && (
          <div className="bg-card rounded-3xl overflow-hidden shadow-2xl border border-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {activeChannel.logo_url ? (
                  <img src={activeChannel.logo_url} alt="" className="w-9 h-9 rounded-full object-cover bg-accent" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                    <TvIcon className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{activeChannel.name}</h2>
                  <p className="text-xs text-muted-foreground">{activeChannel.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {castAvailable && activeChannel.source_type === "m3u8" && (
                  <Button
                    size="sm"
                    variant={castConnected ? "default" : "ghost"}
                    onClick={castConnected ? stopCasting : startCasting}
                    className="gap-1.5"
                    title={castConnected ? "Arrêter la diffusion" : "Caster sur une TV"}
                  >
                    <Cast className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">{castConnected ? "Arrêter" : "Caster"}</span>
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => setActiveChannel(null)}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="aspect-video bg-black">
              {activeChannel.source_type === "m3u8" ? (
                <video ref={videoRef} controls playsInline className="w-full h-full" />
              ) : (
                <iframe src={activeChannel.url} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
              )}
            </div>
            {castAvailable && activeChannel.source_type === "iframe" && (
              <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-border">
                ℹ️ Le casting n'est compatible qu'avec les flux HLS (.m3u8). Pour les iframes, utilise le miroir d'écran de ton téléphone.
              </p>
            )}
          </div>
        )}

        {/* Search + categories */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher une chaîne…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ fontSize: 16 }} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {visibleCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${activeCategory === cat ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-accent/40 text-foreground hover:bg-accent/70"}`}
              >
                {cat === "Favoris" ? "★ Favoris" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Channel grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <TvIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune chaîne disponible</p>
            {isAdmin && <p className="text-sm mt-1">Clique sur « Ajouter » pour en créer une.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((ch) => {
              const isFav = favorites.has(ch.id);
              const isPlaying = activeChannel?.id === ch.id;
              return (
                <div
                  key={ch.id}
                  className={`group relative bg-card rounded-2xl overflow-hidden border transition shadow-sm hover:shadow-xl hover:-translate-y-0.5 ${isPlaying ? "border-primary ring-2 ring-primary/40" : "border-border"} ${!ch.is_active ? "opacity-60" : ""}`}
                >
                  <button onClick={() => setActiveChannel(ch)} className="w-full text-left">
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/40 flex items-center justify-center relative">
                      {ch.logo_url ? (
                        <img src={ch.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <TvIcon className="w-10 h-10 text-primary/60" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-2xl">
                          <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                      {!ch.is_active && (
                        <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-background/80 backdrop-blur">Inactif</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm truncate">{ch.name}</p>
                      <p className="text-xs text-muted-foreground">{ch.category}</p>
                    </div>
                  </button>

                  {/* Action overlay */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(ch.id); }}
                      className={`w-8 h-8 rounded-full backdrop-blur flex items-center justify-center transition ${isFav ? "bg-yellow-400 text-yellow-900" : "bg-background/80 text-muted-foreground hover:text-foreground"}`}
                    >
                      <Star className="w-4 h-4" fill={isFav ? "currentColor" : "none"} />
                    </button>
                  </div>

                  {isAdmin && (
                    <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={(e) => { e.stopPropagation(); openEditor(ch); }} className="w-7 h-7 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-accent">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }} className="w-7 h-7 rounded-full bg-destructive/90 text-destructive-foreground backdrop-blur flex items-center justify-center hover:bg-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Editor Modal */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier la chaîne" : "Nouvelle chaîne"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Nom</Label>
                <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={{ fontSize: 16 }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Catégorie</Label>
                  <select
                    value={editing.category || "Autre"}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    style={{ fontSize: 16 }}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Type de source</Label>
                  <select
                    value={editing.source_type || "m3u8"}
                    onChange={(e) => setEditing({ ...editing, source_type: e.target.value as any })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    style={{ fontSize: 16 }}
                  >
                    <option value="m3u8">Stream HLS (.m3u8)</option>
                    <option value="iframe">Iframe (embed)</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>URL</Label>
                <Input value={editing.url || ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://…" style={{ fontSize: 16 }} />
              </div>
              <div>
                <Label>Logo URL (optionnel)</Label>
                <Input value={editing.logo_url || ""} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} placeholder="https://…" style={{ fontSize: 16 }} />
              </div>
              <div>
                <Label>Description (optionnel)</Label>
                <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} style={{ fontSize: 16 }} />
              </div>
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                  Visible par les membres
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Ordre</span>
                  <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Annuler</Button>
            <Button onClick={saveChannel}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tv;
