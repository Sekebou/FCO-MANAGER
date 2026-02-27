import React, { useState, useEffect, useRef } from 'react';
import { Bell, Plus, X, Megaphone, Trash2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

const NotificationBell = () => {
  const { currentUser } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = currentUser?.role === 'admin+';

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (data) setAnnouncements(data.map(r => ({ id: r.id, title: r.title, content: r.content, createdAt: r.created_at, createdBy: r.created_by })));
    };
    fetchAnnouncements();

    const isIOSNative = /iPad|iPhone|iPod/.test(navigator.userAgent) && (window as any).Capacitor?.isNativePlatform?.();

    if (isIOSNative) {
      const interval = setInterval(fetchAnnouncements, 3000);
      return () => { clearInterval(interval); };
    }

    const channel = supabase.channel('announcements-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        supabase.from('announcements').select('*').order('created_at', { ascending: false })
          .then(({ data }) => data && setAnnouncements(data.map(r => ({ id: r.id, title: r.title, content: r.content, createdAt: r.created_at, createdBy: r.created_by }))));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) { setOpen(false); setShowForm(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { toast.warning('Remplissez le titre et le message'); return; }
    setSending(true);
    try {
      await supabase.from('announcements').insert({
        title: title.trim(), content: message.trim(), created_by: currentUser?.uid || '',
      });
      setTitle(''); setMessage(''); setShowForm(false);
      toast.success('Annonce publiée !');
    } catch (err: any) { toast.error('Erreur : ' + err.message); }
    finally { setSending(false); }
  };

  const handleDelete = async (id: string) => {
    try { await supabase.from('announcements').delete().eq('id', id); toast.success('Annonce supprimée'); }
    catch (err: any) { toast.error('Erreur : ' + err.message); }
  };

  const formatDate = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen(!open)} className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-all" title="Notifications">
        <Bell size={14} className="sm:hidden" /><Bell size={16} className="hidden sm:block" />
        {announcements.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">{announcements.length}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 max-h-[80vh] sm:max-h-[70vh] bg-card border border-border rounded-2xl shadow-2xl z-[100] overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-accent" />
              <span className="font-semibold text-sm text-foreground">Annonces</span>
              {announcements.length > 0 && <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-medium">{announcements.length}</span>}
            </div>
            <div className="flex items-center gap-1">
              {isSuperAdmin && <button onClick={() => setShowForm(!showForm)} className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-accent transition-all" title="Nouvelle annonce">{showForm ? <X size={14} /> : <Plus size={14} />}</button>}
              <button onClick={() => { setOpen(false); setShowForm(false); }} className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground transition-all"><X size={14} /></button>
            </div>
          </div>

          {showForm && isSuperAdmin && (
            <div className="p-4 border-b border-border bg-accent/5 space-y-3">
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l'annonce..." className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-foreground placeholder:text-muted-foreground" maxLength={80} />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Votre message..." className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none text-foreground placeholder:text-muted-foreground" rows={3} maxLength={500} />
              <button onClick={handleSend} disabled={sending} className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-all disabled:opacity-50"><Send size={14} />{sending ? 'Envoi...' : "Publier l'annonce"}</button>
            </div>
          )}

          <div className="overflow-y-auto max-h-[50vh] divide-y divide-border">
            {announcements.length === 0 ? (
              <div className="py-12 text-center"><Megaphone size={32} className="mx-auto text-muted-foreground/30 mb-3" /><p className="text-sm text-muted-foreground">Aucune annonce pour le moment</p></div>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="px-4 py-3 hover:bg-muted/20 transition-all group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground">{a.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">{a.content}</p>
                      <span className="text-[10px] text-muted-foreground/60 mt-1.5 block">{formatDate(a.createdAt)}</span>
                    </div>
                    {isSuperAdmin && (
                      <button onClick={() => handleDelete(a.id)} className="sm:opacity-0 sm:group-hover:opacity-100 w-6 h-6 rounded-md hover:bg-destructive/10 flex items-center justify-center text-destructive/60 hover:text-destructive transition-all shrink-0" title="Supprimer"><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
