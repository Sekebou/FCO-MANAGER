import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, MessageCircle, Plus, ArrowLeft, Users as UsersIcon, Search,
  Trash2, Image as ImageIcon, X, Lock, AlertTriangle, Wifi, WifiOff
} from 'lucide-react';
import clubLogo from '@/assets/logo.png';
import { supabase } from '@/integrations/supabase/client';
import type { AppUser } from '@/contexts/AuthContext';
import type { Member } from '@/pages/Dashboard';
import { toast } from 'sonner';

type ChatView = 'tabs' | 'global' | 'conversations' | 'new-convo' | 'private-chat';

interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string | null>;
  participantRoles: Record<string, string>;
  type: 'private' | 'group';
  name?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  createdBy?: string;
  unreadCount?: Record<string, number>;
  readBy?: Record<string, string>; // userId -> lastReadMessageId
}

interface ChatMessage {
  id: string;
  text: string;
  imageUrl?: string;
  userId?: string;
  senderId?: string;
  userName?: string;
  senderName?: string;
  userRole?: string;
  senderRole?: string;
  userPhoto?: string | null;
  senderPhoto?: string | null;
  createdAt: string;
}

interface Props {
  currentUser: AppUser | null;
  members: Member[];
}

const ROLE_COLORS: Record<string, string> = {
  'admin+': 'bg-red-500', 'admin': 'bg-orange-500', 'entraineur': 'bg-accent',
  'joueur': 'bg-emerald-500', 'photographe': 'bg-purple-500', 'dirigeant': 'bg-amber-600',
};
const ROLE_TEXT_COLORS: Record<string, string> = {
  'admin+': 'text-red-500', 'admin': 'text-orange-500', 'entraineur': 'text-accent',
  'joueur': 'text-emerald-500', 'photographe': 'text-purple-500', 'dirigeant': 'text-amber-600',
};
const ROLE_LABELS: Record<string, string> = {
  'admin+': 'Super Admin', 'admin': 'Admin', 'entraineur': 'Entraîneur',
  'joueur': 'Joueur', 'photographe': 'Photo', 'dirigeant': 'Dirigeant',
};

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const mapGlobalMsg = (r: any): ChatMessage => ({
  id: r.id, text: r.text, userId: r.user_id, userName: r.user_name,
  userRole: r.user_role, userPhoto: r.user_photo, createdAt: r.created_at,
});
const mapConvoMsg = (r: any): ChatMessage => ({
  id: r.id, text: r.text || '', imageUrl: r.image_url, senderId: r.sender_id,
  senderName: r.sender_name, senderRole: r.sender_role, senderPhoto: r.sender_photo, createdAt: r.created_at,
});
const mapConvo = (r: any): Conversation => ({
  id: r.id, participants: r.participants, participantNames: r.participant_names || {},
  participantPhotos: r.participant_photos || {}, participantRoles: r.participant_roles || {},
  type: r.type as any, name: r.name, lastMessage: r.last_message,
  lastMessageAt: r.last_message_at, createdBy: r.created_by, unreadCount: r.unread_count || {},
  readBy: r.read_by || {},
});

// Présence : en ligne si last_seen_at < 2 minutes
const isOnline = (lastSeenAt: string | null | undefined): boolean => {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
};

// Indicateur de présence visuel
const PresenceDot = ({ online }: { online: boolean }) => (
  <span
    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
      online ? 'bg-green-500 animate-pulse' : 'bg-red-500'
    }`}
  />
);

const ChatTab: React.FC<Props> = ({ currentUser, members }) => {
  const [view, setView] = useState<ChatView>('tabs');
  const [animating, setAnimating] = useState(false);
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchMember, setSearchMember] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showDeleteConvo, setShowDeleteConvo] = useState(false);
  const [deletingConvo, setDeletingConvo] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Présence: userId -> last_seen_at
  const [presenceMap, setPresenceMap] = useState<Record<string, string | null>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'admin+';
  const visibleMembers = members.filter(m => m.role !== 'admin+' || m.id === currentUser?.uid);

  const changeView = (newView: ChatView) => {
    if (newView === view) return;
    setAnimating(true);
    setTimeout(() => { setView(newView); setTimeout(() => setAnimating(false), 20); }, 150);
  };

  // ─── HEARTBEAT : mise à jour last_seen_at toutes les 30s ───
  const updateLastSeen = useCallback(async () => {
    if (!currentUser) return;
    await (supabase.from('profiles') as any).update({ last_seen_at: new Date().toISOString() }).eq('id', currentUser.uid);
  }, [currentUser]);

  useEffect(() => {
    updateLastSeen();
    const interval = setInterval(updateLastSeen, 30000);
    return () => clearInterval(interval);
  }, [updateLastSeen]);

  // ─── PRESENCE : charger + écouter last_seen_at de tous les profils ───
  useEffect(() => {
    const fetchPresence = async () => {
      const { data } = await supabase.from('profiles').select('id, last_seen_at');
      if (data) {
        const map: Record<string, string | null> = {};
        data.forEach((p: any) => { map[p.id] = p.last_seen_at; });
        setPresenceMap(map);
      }
    };
    fetchPresence();

    const channel = supabase.channel('presence-profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const p = payload.new as any;
        if (p?.id && 'last_seen_at' in p) {
          setPresenceMap(prev => ({ ...prev, [p.id]: p.last_seen_at }));
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ─── GLOBAL CHAT ───
  useEffect(() => {
    const fetchGlobal = async () => {
      const { data } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(200);
      if (data) setGlobalMessages(data.map(mapGlobalMsg));
    };
    fetchGlobal();

    const isIOSNative = /iPad|iPhone|iPod/.test(navigator.userAgent) && (window as any).Capacitor?.isNativePlatform?.();
    if (isIOSNative) {
      const interval = setInterval(fetchGlobal, 1000);
      return () => clearInterval(interval);
    }

    const channel = supabase.channel('chattab-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(200)
          .then(({ data }) => data && setGlobalMessages(data.map(mapGlobalMsg)));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ─── CONVERSATIONS ───
  useEffect(() => {
    if (!currentUser) return;
    const fetchConvos = async () => {
      const { data } = await supabase.from('conversations').select('*').contains('participants', [currentUser.uid]);
      if (data) {
        const convos = data.map(mapConvo).sort((a, b) => new Date(b.lastMessageAt || '').getTime() - new Date(a.lastMessageAt || '').getTime());
        setConversations(convos);
      }
    };
    fetchConvos();
    const channel = supabase.channel('chattab-convos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchConvos)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // ─── MESSAGES PRIVÉS + "VU PAR" ───
  useEffect(() => {
    if (!activeConversation) { setPrivateMessages([]); return; }
    const fetchMsgs = async () => {
      const { data } = await supabase.from('conversation_messages').select('*').eq('conversation_id', activeConversation.id).order('created_at', { ascending: true });
      if (data) {
        const msgs = data.map(mapConvoMsg);
        setPrivateMessages(msgs);

        // Marquer comme lu : enregistrer le dernier message ID dans read_by
        if (currentUser && msgs.length > 0) {
          const lastMsgId = msgs[msgs.length - 1].id;
          const updatedReadBy = { ...(activeConversation.readBy || {}), [currentUser.uid]: lastMsgId };
          const uc = { ...(activeConversation.unreadCount || {}), [currentUser.uid]: 0 };
          await supabase.from('conversations').update({ unread_count: uc, read_by: updatedReadBy }).eq('id', activeConversation.id);
          // Mettre à jour localement
          setActiveConversation(prev => prev ? { ...prev, readBy: updatedReadBy } : null);
        }
      }
    };
    fetchMsgs();

    const channel = supabase.channel(`chattab-msgs-${activeConversation.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${activeConversation.id}` }, fetchMsgs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversation?.id, currentUser]);

  // ─── SCROLL AUTO ───
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [globalMessages, privateMessages, view]);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount?.[currentUser?.uid || ''] || 0), 0);

  const getConvoName = (c: Conversation) => {
    if (c.type === 'group') return c.name || 'Groupe';
    const oid = c.participants.find(id => id !== currentUser?.uid);
    return oid ? (c.participantNames?.[oid] || 'Utilisateur') : 'Conversation';
  };
  const getConvoPhoto = (c: Conversation) => {
    if (c.type === 'group') return null;
    const oid = c.participants.find(id => id !== currentUser?.uid);
    return oid ? c.participantPhotos?.[oid] : null;
  };
  const getConvoRole = (c: Conversation) => {
    if (c.type === 'group') return null;
    const oid = c.participants.find(id => id !== currentUser?.uid);
    return oid ? c.participantRoles?.[oid] : null;
  };
  const getConvoOtherId = (c: Conversation) => c.participants.find(id => id !== currentUser?.uid);

  // ─── ENVOI GLOBAL ───
  const sendGlobal = async () => {
    if (!newMessage.trim() || !currentUser || sending) return;
    const text = newMessage.trim(); setNewMessage(''); setSending(true);
    try {
      await supabase.from('chat_messages').insert({
        text, user_id: currentUser.uid, user_name: currentUser.name,
        user_role: currentUser.role, user_photo: currentUser.photoURL || null,
      });
      inputRef.current?.focus();
    } catch { setNewMessage(text); } finally { setSending(false); }
  };

  // ─── ENVOI PRIVÉ ───
  const sendPrivate = async () => {
    if (!newMessage.trim() || !currentUser || !activeConversation || sending) return;
    const text = newMessage.trim(); setNewMessage(''); setSending(true);
    try {
      const { data: inserted } = await supabase.from('conversation_messages').insert({
        conversation_id: activeConversation.id, text, sender_id: currentUser.uid,
        sender_name: currentUser.name, sender_role: currentUser.role, sender_photo: currentUser.photoURL || null,
      }).select('id').single();

      const uc = { ...(activeConversation.unreadCount || {}) };
      activeConversation.participants.forEach(pid => { if (pid !== currentUser.uid) uc[pid] = (uc[pid] || 0) + 1; });

      // Marquer comme lu pour moi immédiatement
      const updatedReadBy = inserted
        ? { ...(activeConversation.readBy || {}), [currentUser.uid]: inserted.id }
        : activeConversation.readBy || {};

      await supabase.from('conversations').update({
        last_message: text.slice(0, 60),
        last_message_at: new Date().toISOString(),
        unread_count: uc,
        read_by: updatedReadBy,
      }).eq('id', activeConversation.id);

      setActiveConversation(prev => prev ? { ...prev, readBy: updatedReadBy } : null);
      inputRef.current?.focus();
    } catch { setNewMessage(text); } finally { setSending(false); }
  };

  // ─── UPLOAD IMAGE ───
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !activeConversation) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (max 5 Mo)'); return; }
    setUploading(true);
    try {
      const fileName = `messages/${activeConversation.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('photos').upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(data.path);
      await supabase.from('conversation_messages').insert({
        conversation_id: activeConversation.id, text: '', image_url: urlData.publicUrl,
        sender_id: currentUser.uid, sender_name: currentUser.name, sender_role: currentUser.role, sender_photo: currentUser.photoURL || null,
      });
      const uc = { ...(activeConversation.unreadCount || {}) };
      activeConversation.participants.forEach(pid => { if (pid !== currentUser.uid) uc[pid] = (uc[pid] || 0) + 1; });
      await supabase.from('conversations').update({ last_message: '📷 Photo', last_message_at: new Date().toISOString(), unread_count: uc }).eq('id', activeConversation.id);
    } catch { toast.error("Erreur lors de l'envoi"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const deleteMessage = async (msgId: string, isGlobal: boolean) => {
    try {
      if (isGlobal) await supabase.from('chat_messages').delete().eq('id', msgId);
      else await supabase.from('conversation_messages').delete().eq('id', msgId);
    } catch { toast.error('Impossible de supprimer'); }
  };

  const deleteConversation = async (convoId: string) => {
    setDeletingConvo(true);
    setActiveConversation(null); setPrivateMessages([]); setShowDeleteConvo(false);
    changeView('tabs');
    try {
      await supabase.from('conversation_messages').delete().eq('conversation_id', convoId);
      await supabase.from('conversations').delete().eq('id', convoId);
      toast.success('Conversation supprimée');
    } catch { toast.error('Erreur de suppression'); }
    finally { setDeletingConvo(false); }
  };

  const handleResetGlobalChat = async () => {
    if (!isAdmin) return;
    setResetting(true);
    try {
      const { count } = await supabase.from('chat_messages').select('*', { count: 'exact', head: true });
      await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      toast.success(`${count || 0} message(s) supprimé(s)`);
      setShowResetConfirm(false);
    } catch { toast.error('Erreur lors de la suppression'); }
    finally { setResetting(false); }
  };

  const createConversation = async () => {
    if (!currentUser || selectedMembers.length === 0) return;
    const isGroup = selectedMembers.length > 1;
    if (isGroup && !groupName.trim()) { toast.error('Donne un nom au groupe'); return; }
    if (!isGroup) {
      const existing = conversations.find(c => c.type === 'private' && c.participants.length === 2 && c.participants.includes(selectedMembers[0]));
      if (existing) { setActiveConversation(existing); changeView('private-chat'); setSelectedMembers([]); setGroupName(''); setSearchMember(''); return; }
    }
    const all = [currentUser.uid, ...selectedMembers];
    const names: Record<string, string> = { [currentUser.uid]: currentUser.name };
    const photos: Record<string, string | null> = { [currentUser.uid]: currentUser.photoURL || null };
    const roles: Record<string, string> = { [currentUser.uid]: currentUser.role };
    const unread: Record<string, number> = { [currentUser.uid]: 0 };
    selectedMembers.forEach(mid => {
      const m = members.find(x => x.id === mid);
      if (m) { names[mid] = m.name; photos[mid] = m.photoURL || null; roles[mid] = m.role; }
      unread[mid] = 0;
    });
    try {
      const { data: inserted, error } = await supabase.from('conversations').insert({
        participants: all, participant_names: names, participant_photos: photos, participant_roles: roles,
        type: isGroup ? 'group' : 'private', name: isGroup ? groupName.trim() : null,
        last_message: null, last_message_at: new Date().toISOString(), created_by: currentUser.uid,
        unread_count: unread, read_by: {},
      }).select('id').single();
      if (error) throw error;
      setActiveConversation({ id: inserted.id, participants: all, participantNames: names, participantPhotos: photos, participantRoles: roles, type: isGroup ? 'group' : 'private', name: isGroup ? groupName.trim() : undefined, unreadCount: unread, readBy: {} });
      changeView('private-chat'); setSelectedMembers([]); setGroupName(''); setSearchMember('');
    } catch { toast.error('Erreur lors de la création'); }
  };

  const toggleMember = (id: string) => setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const formatTime = (ts: string | undefined) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return time;
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const formatMsgTime = (ts: string) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const formatDaySep = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const isConsec = (msgs: ChatMessage[], idx: number) => {
    if (idx === 0) return false;
    const prev = msgs[idx - 1], curr = msgs[idx];
    const pId = prev.senderId || prev.userId, cId = curr.senderId || curr.userId;
    if (pId !== cId) return false;
    return new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime() < 120000;
  };

  const isDiffDay = (msgs: ChatMessage[], idx: number) => {
    if (idx === 0) return true;
    return new Date(msgs[idx - 1].createdAt).toDateString() !== new Date(msgs[idx].createdAt).toDateString();
  };

  const filteredMembers = visibleMembers.filter(m => m.id !== currentUser?.uid && m.name.toLowerCase().includes(searchMember.toLowerCase()));

  // ─── CALCUL "VU PAR" ───
  // Retourne les participants qui ont vu jusqu'à ce message (hors moi)
  const getSeenByForMessage = (msg: ChatMessage, msgs: ChatMessage[], convo: Conversation | null): { id: string; name: string; photo: string | null }[] => {
    if (!convo || !currentUser) return [];
    const readBy = convo.readBy || {};
    const seenBy: { id: string; name: string; photo: string | null }[] = [];

    // Pour chaque participant (hors moi), vérifier si son lastReadMessageId >= ce message
    for (const pid of convo.participants) {
      if (pid === currentUser.uid) continue;
      const lastReadId = readBy[pid];
      if (!lastReadId) continue;
      // Trouver l'index du message lu par rapport à la liste
      const lastReadIdx = msgs.findIndex(m => m.id === lastReadId);
      const currentIdx = msgs.findIndex(m => m.id === msg.id);
      if (lastReadIdx >= currentIdx && currentIdx !== -1) {
        seenBy.push({
          id: pid,
          name: convo.participantNames?.[pid] || 'Utilisateur',
          photo: convo.participantPhotos?.[pid] || null,
        });
      }
    }
    return seenBy.slice(0, 3);
  };

  // ─── RENDER MESSAGES ───
  const renderMessages = (msgs: ChatMessage[], isGlobal: boolean, isGroupChat: boolean, convo: Conversation | null = null) => (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
      {msgs.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
          <div className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center">
            <MessageCircle size={28} className="opacity-30" />
          </div>
          <p className="text-sm text-muted-foreground">Aucun message pour l'instant</p>
        </div>
      )}
      {msgs.map((msg, idx) => {
        const senderId = msg.senderId || msg.userId || '';
        const senderName = msg.senderName || msg.userName || '';
        const senderRole = msg.senderRole || msg.userRole || '';
        const senderPhoto = msg.senderPhoto || msg.userPhoto;
        const own = senderId === currentUser?.uid;
        const consecutive = isConsec(msgs, idx);
        const showDateSep = isDiffDay(msgs, idx);
        const canDelete = own || isAdmin;

        // "Vu par" uniquement sur mes propres messages dans les chats privés/groupes
        const isLastOwnMsg = !isGlobal && own && (() => {
          for (let i = msgs.length - 1; i >= 0; i--) {
            if ((msgs[i].senderId || msgs[i].userId) === currentUser?.uid) return msgs[i].id === msg.id;
          }
          return false;
        })();
        const seenBy = isLastOwnMsg ? getSeenByForMessage(msg, msgs, convo) : [];

        return (
          <React.Fragment key={msg.id}>
            {showDateSep && (
              <div className="flex items-center gap-2 py-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-3 py-1 rounded-full border border-border">{formatDaySep(msg.createdAt)}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <div className={`group flex items-end gap-2 ${own ? 'flex-row-reverse' : ''} ${consecutive ? 'mt-0.5' : 'mt-3'}`}>
              {!own && !consecutive ? (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden ${ROLE_COLORS[senderRole] || 'bg-muted-foreground'}`}>
                  {senderPhoto ? <img src={senderPhoto} alt="" className="w-full h-full object-cover" /> : getInitials(senderName)}
                </div>
              ) : !own ? <div className="w-8 shrink-0" /> : null}
              <div className={`max-w-[78%] flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                {!consecutive && !own && (isGlobal || isGroupChat) && (
                  <div className="flex items-center gap-1.5 mb-1 ml-0.5">
                    <span className={`text-xs font-bold ${ROLE_TEXT_COLORS[senderRole] || 'text-muted-foreground'}`}>{senderName}</span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${ROLE_COLORS[senderRole] || 'bg-muted-foreground'} text-white opacity-80`}>{ROLE_LABELS[senderRole] || senderRole}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  {own && canDelete && <button onClick={() => deleteMessage(msg.id, isGlobal)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"><Trash2 size={12} /></button>}
                  <div className={`px-3 py-2.5 text-sm leading-relaxed break-words shadow-sm ${own ? 'bg-gradient-to-br from-accent to-accent/90 text-accent-foreground rounded-2xl rounded-br-md' : 'bg-secondary text-foreground rounded-2xl rounded-bl-md border border-border/50'}`}>
                    {msg.imageUrl && <img src={msg.imageUrl} alt="" className="max-w-full rounded-lg mb-1 max-h-48 object-contain cursor-pointer" onClick={() => window.open(msg.imageUrl, '_blank')} />}
                    {msg.text && <span>{msg.text}</span>}
                  </div>
                  {!own && isAdmin && <button onClick={() => deleteMessage(msg.id, isGlobal)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"><Trash2 size={12} /></button>}
                </div>
                {!consecutive && <span className={`text-[10px] text-muted-foreground/60 mt-0.5 ${own ? 'mr-0.5' : 'ml-0.5'}`}>{formatMsgTime(msg.createdAt)}</span>}

                {/* ─── "VU PAR" — style iMessage/Facebook ─── */}
                {seenBy.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 mr-0.5">
                    <span className="text-[9px] text-muted-foreground/60">Vu</span>
                    <div className="flex -space-x-1">
                      {seenBy.map(s => (
                        <div
                          key={s.id}
                          className={`w-3.5 h-3.5 rounded-full border border-card overflow-hidden flex items-center justify-center text-[6px] font-bold text-white shrink-0 ${ROLE_COLORS[convo?.participantRoles?.[s.id] || ''] || 'bg-muted-foreground'}`}
                          title={s.name}
                        >
                          {s.photo
                            ? <img src={s.photo} alt="" className="w-full h-full object-cover" />
                            : getInitials(s.name)
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );

  const renderInput = (onSend: () => void, showImage: boolean) => (
    <div className="border-t border-border px-4 py-3 bg-card/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2">
        {showImage && (
          <>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40"><ImageIcon size={18} /></button>
          </>
        )}
        <input ref={inputRef} type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Écrivez un message..."
          className="flex-1 px-4 py-2.5 bg-secondary border border-border rounded-2xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 text-sm transition-all"
          style={{ fontSize: '16px' }} maxLength={1000} />
        <button onClick={onSend} disabled={!newMessage.trim() || sending} className="p-2.5 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground rounded-2xl hover:shadow-md hover:scale-105 transition-all disabled:opacity-30"><Send size={18} /></button>
      </div>
      {uploading && <p className="text-xs text-accent mt-1.5 text-center animate-pulse">Envoi en cours...</p>}
    </div>
  );

  const containerHeight = 'calc(100dvh - 10rem - env(safe-area-inset-bottom) - env(safe-area-inset-top))';

  return (
    <div className="flex flex-col overflow-hidden relative" style={{ height: containerHeight }}>
      <div className={`flex flex-col flex-1 min-h-0 transition-all duration-150 ${animating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>

        {/* ─── VUE ACCUEIL (tabs) ─── */}
        {view === 'tabs' && (
          <>
            {/* Header sans fond bleu, sans logo */}
            <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
              <span className="font-bold text-base flex-1 text-foreground">Discussions</span>
              {totalUnread > 0 && (
                <span className="bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">{totalUnread > 99 ? '99+' : totalUnread}</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Discussion globale */}
              <button onClick={() => changeView('global')} className="flex items-center gap-3 w-full px-4 py-4 hover:bg-secondary/50 transition-all border-b border-border text-left">
                <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center shadow-md overflow-hidden shrink-0 border border-border">
                  <img src={clubLogo} alt="Logo du club" className="w-9 h-9 object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">💬 Discussion globale du club</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {globalMessages.length > 0 ? globalMessages[globalMessages.length - 1]?.text?.slice(0, 40) || 'Message récent' : 'Tout le club'}
                  </p>
                </div>
                {globalMessages.length > 0 && (
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(globalMessages[globalMessages.length - 1]?.createdAt)}</span>
                )}
              </button>

              {/* Section messages privés */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Lock size={10} /> Messages Privés</span>
                <button onClick={() => changeView('new-convo')} className="p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all" title="Nouvelle conversation"><Plus size={14} /></button>
              </div>

              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-secondary/80 flex items-center justify-center"><Lock size={22} className="opacity-30" /></div>
                  <p className="text-sm text-muted-foreground">Pas de conversation privée</p>
                  <button onClick={() => changeView('new-convo')} className="text-sm text-accent font-semibold hover:underline">Démarrer une conversation</button>
                </div>
              ) : (
                conversations.map(convo => {
                  const name = getConvoName(convo);
                  const photo = getConvoPhoto(convo);
                  const role = getConvoRole(convo);
                  const otherId = getConvoOtherId(convo);
                  const online = convo.type === 'private' && otherId ? isOnline(presenceMap[otherId]) : false;
                  const unread = convo.unreadCount?.[currentUser?.uid || ''] || 0;
                  return (
                    <button key={convo.id} onClick={() => { setActiveConversation(convo); changeView('private-chat'); }}
                      className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all border-b border-border/50 ${unread > 0 ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-secondary/50'}`}>
                      {/* Avatar avec indicateur de présence */}
                      <div className="relative shrink-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden shadow-sm ${convo.type === 'group' ? 'bg-accent' : (ROLE_COLORS[role || ''] || 'bg-muted-foreground')}`}>
                          {convo.type === 'group' ? <UsersIcon size={16} /> : photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
                        </div>
                        {convo.type === 'private' && <PresenceDot online={online} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-sm truncate ${unread > 0 ? 'font-bold' : 'font-semibold'} text-foreground`}>{name}</p>
                          {convo.lastMessageAt && <span className={`text-[10px] shrink-0 ${unread > 0 ? 'text-accent font-semibold' : 'text-muted-foreground'}`}>{formatTime(convo.lastMessageAt)}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <p className={`text-xs truncate ${unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{convo.lastMessage || 'Pas de message'}</p>
                          {unread > 0 && <span className="bg-accent text-accent-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">{unread}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ─── VUE CHAT GLOBAL ─── */}
        {view === 'global' && (
          <>
            {/* Header sans fond bleu, sans logo */}
            <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border shrink-0">
              <button onClick={() => changeView('tabs')} className="p-1.5 rounded-lg hover:bg-secondary transition-all text-foreground"><ArrowLeft size={20} /></button>
              <span className="font-bold text-sm flex-1 text-foreground">Discussion globale du club</span>
              {isAdmin && globalMessages.length > 0 && (
                <button onClick={() => setShowResetConfirm(true)} className="p-1.5 rounded-lg hover:bg-secondary transition-all text-muted-foreground hover:text-destructive" title="Vider le chat"><Trash2 size={16} /></button>
              )}
            </div>

            {showResetConfirm && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-card border border-border rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle size={20} className="text-destructive" /></div>
                    <h3 className="text-base font-bold text-foreground">Vider la discussion ?</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">Tous les messages ({globalMessages.length}) seront définitivement supprimés.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowResetConfirm(false)} disabled={resetting} className="flex-1 px-4 py-2.5 bg-secondary text-foreground rounded-xl font-medium text-sm">Annuler</button>
                    <button onClick={handleResetGlobalChat} disabled={resetting} className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl font-medium text-sm disabled:opacity-50">{resetting ? 'Suppression...' : 'Tout supprimer'}</button>
                  </div>
                </div>
              </div>
            )}

            {renderMessages(globalMessages, true, true, null)}
            {currentUser ? renderInput(sendGlobal, false) : (
              <div className="border-t border-border px-4 py-4 text-center text-sm text-muted-foreground bg-secondary/50">🔒 Connectez-vous pour participer</div>
            )}
          </>
        )}

        {/* ─── VUE NOUVELLE CONVERSATION ─── */}
        {view === 'new-convo' && (
          <>
            <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border shrink-0">
              <button onClick={() => { changeView('tabs'); setSelectedMembers([]); setGroupName(''); setSearchMember(''); }} className="p-1.5 rounded-lg hover:bg-secondary transition-all text-foreground"><ArrowLeft size={20} /></button>
              <span className="font-bold text-sm flex-1 text-foreground">Nouvelle conversation</span>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={searchMember} onChange={e => setSearchMember(e.target.value)} placeholder="Rechercher un membre..."
                  className="w-full pl-9 pr-3 py-2.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-sm" />
              </div>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedMembers.map(mid => { const m = members.find(x => x.id === mid); return (
                    <span key={mid} className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/15 text-accent rounded-full text-xs font-semibold">
                      {m?.name}<button onClick={() => toggleMember(mid)} className="hover:text-destructive ml-0.5"><X size={10} /></button>
                    </span>
                  ); })}
                </div>
              )}
              {selectedMembers.length > 1 && (
                <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Nom du groupe..."
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-sm" />
              )}
              <div className="space-y-1">
                {filteredMembers.map(member => {
                  const online = isOnline(presenceMap[member.id]);
                  return (
                    <button key={member.id} onClick={() => toggleMember(member.id)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-left ${selectedMembers.includes(member.id) ? 'bg-accent/10 ring-1 ring-accent/30' : 'hover:bg-secondary/60'}`}>
                      {/* Avatar avec indicateur de présence */}
                      <div className="relative shrink-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white overflow-hidden ${ROLE_COLORS[member.role] || 'bg-muted-foreground'}`}>
                          {member.photoURL ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" /> : getInitials(member.name)}
                        </div>
                        <PresenceDot online={online} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold uppercase ${ROLE_TEXT_COLORS[member.role] || 'text-muted-foreground'}`}>{ROLE_LABELS[member.role] || member.role}</span>
                          <span className={`text-[9px] ${online ? 'text-green-500' : 'text-muted-foreground/60'}`}>• {online ? 'En ligne' : 'Hors ligne'}</span>
                        </div>
                      </div>
                      {selectedMembers.includes(member.id) && (
                        <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center shrink-0">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-border shrink-0">
              <button onClick={createConversation} disabled={selectedMembers.length === 0}
                className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-semibold text-sm hover:shadow-md transition-all disabled:opacity-40">
                {selectedMembers.length > 1 ? '👥 Créer le groupe' : '💬 Démarrer la conversation'}
              </button>
            </div>
          </>
        )}

        {/* ─── VUE CHAT PRIVÉ / GROUPE ─── */}
        {view === 'private-chat' && activeConversation && (
          <>
            <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border shrink-0">
              <button onClick={() => { changeView('tabs'); setActiveConversation(null); }} className="p-1.5 rounded-lg hover:bg-secondary transition-all text-foreground"><ArrowLeft size={20} /></button>
              {(() => {
                const photo = getConvoPhoto(activeConversation);
                const role = getConvoRole(activeConversation);
                const name = getConvoName(activeConversation);
                const otherId = getConvoOtherId(activeConversation);
                const online = activeConversation.type === 'private' && otherId ? isOnline(presenceMap[otherId]) : false;
                return (
                  <>
                    {/* Avatar avec indicateur de présence */}
                    <div className="relative shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white overflow-hidden ${activeConversation.type === 'group' ? 'bg-accent' : (ROLE_COLORS[role || ''] || 'bg-muted-foreground')}`}>
                        {activeConversation.type === 'group' ? <UsersIcon size={14} /> : photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
                      </div>
                      {activeConversation.type === 'private' && <PresenceDot online={online} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-foreground">{name}</p>
                      {activeConversation.type === 'private' ? (
                        <p className={`text-[10px] font-medium flex items-center gap-1 ${online ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {online ? <><Wifi size={9} /> En ligne</> : <><WifiOff size={9} /> Hors ligne</>}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">{activeConversation.participants.length} membres</p>
                      )}
                    </div>
                  </>
                );
              })()}
              <button onClick={() => setShowDeleteConvo(true)} className="p-1.5 rounded-lg hover:bg-secondary transition-all text-muted-foreground hover:text-destructive" title="Supprimer"><Trash2 size={16} /></button>
            </div>

            {showDeleteConvo && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-card border border-border rounded-2xl p-5 mx-4 max-w-sm w-full shadow-xl">
                  <div className="flex items-center gap-2 mb-2"><Trash2 size={18} className="text-destructive" /><h3 className="text-sm font-bold text-foreground">Supprimer la conversation ?</h3></div>
                  <p className="text-xs text-muted-foreground mb-4">Tous les messages seront définitivement supprimés.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowDeleteConvo(false)} disabled={deletingConvo} className="flex-1 px-3 py-2.5 bg-secondary text-foreground rounded-xl font-medium text-sm">Annuler</button>
                    <button onClick={() => deleteConversation(activeConversation.id)} disabled={deletingConvo} className="flex-1 px-3 py-2.5 bg-destructive text-destructive-foreground rounded-xl font-medium text-sm disabled:opacity-50">{deletingConvo ? '...' : 'Supprimer'}</button>
                  </div>
                </div>
              </div>
            )}

            {renderMessages(privateMessages, false, activeConversation.type === 'group', activeConversation)}
            {currentUser && renderInput(sendPrivate, true)}
          </>
        )}

        {view === 'private-chat' && !activeConversation && (
          <div className="flex-1 flex items-center justify-center">
            <button onClick={() => changeView('tabs')} className="text-sm text-accent font-semibold hover:underline">← Retour aux discussions</button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ChatTab;
