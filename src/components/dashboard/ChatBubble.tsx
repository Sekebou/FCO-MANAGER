import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Send, MessageCircle, Plus, ArrowLeft, Users as UsersIcon, Search,
  Trash2, Image as ImageIcon, X, Globe, Lock, UserPlus
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
  chatOpen: boolean;
  setChatOpen: (v: boolean | ((p: boolean) => boolean)) => void;
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
});

const ChatBubble: React.FC<Props> = ({ currentUser, members, chatOpen, setChatOpen }) => {
  const [view, setView] = useState<ChatView>('tabs');
  const [prevView, setPrevView] = useState<ChatView>('tabs');
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSeenGlobalRef = useRef<number>(Date.now());
  const [unreadGlobal, setUnreadGlobal] = useState(0);
  // drag removed

  const changeView = (newView: ChatView) => {
    if (newView === view) return;
    setAnimating(true); setPrevView(view);
    setTimeout(() => { setView(newView); setTimeout(() => setAnimating(false), 20); }, 150);
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'admin+';
  const visibleMembers = members.filter(m => m.role !== 'admin+' || m.id === currentUser?.uid);

  // Global chat
  useEffect(() => {
    const fetchGlobal = async () => {
      const { data } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(200);
      if (data) setGlobalMessages(data.map(mapGlobalMsg));
    };
    fetchGlobal();
    const channel = supabase.channel('bubble-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(200)
          .then(({ data }) => {
            if (!data) return;
            const msgs = data.map(mapGlobalMsg);
            setGlobalMessages(msgs);
            if (!chatOpen || view !== 'global') {
              const newMsgs = msgs.filter(m => new Date(m.createdAt).getTime() > lastSeenGlobalRef.current && (m.senderId || m.userId) !== currentUser?.uid);
              if (newMsgs.length > 0) setUnreadGlobal(newMsgs.length);
            }
          });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (chatOpen && view === 'global') { setUnreadGlobal(0); lastSeenGlobalRef.current = Date.now(); }
  }, [chatOpen, view]);

  // Conversations
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
    const channel = supabase.channel('bubble-convos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchConvos)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Private messages
  useEffect(() => {
    if (!activeConversation) { setPrivateMessages([]); return; }
    const fetchMsgs = async () => {
      const { data } = await supabase.from('conversation_messages').select('*').eq('conversation_id', activeConversation.id).order('created_at', { ascending: true });
      if (data) setPrivateMessages(data.map(mapConvoMsg));
    };
    fetchMsgs();
    // Reset unread
    if (currentUser) {
      const uc = { ...(activeConversation.unreadCount || {}), [currentUser.uid]: 0 };
      supabase.from('conversations').update({ unread_count: uc }).eq('id', activeConversation.id).then(() => {});
    }
    const channel = supabase.channel(`bubble-msgs-${activeConversation.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${activeConversation.id}` }, fetchMsgs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversation?.id, currentUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [globalMessages, privateMessages, view]);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount?.[currentUser?.uid || ''] || 0), 0) + unreadGlobal;

  const getConvoName = (c: Conversation) => {
    if (c.type === 'group') return c.name || 'Groupe';
    const oid = c.participants.find(id => id !== currentUser?.uid);
    return oid ? (c.participantNames?.[oid] || 'Utilisateur') : 'Conversation';
  };
  const getConvoPhoto = (c: Conversation) => { if (c.type === 'group') return null; const oid = c.participants.find(id => id !== currentUser?.uid); return oid ? c.participantPhotos?.[oid] : null; };
  const getConvoRole = (c: Conversation) => { if (c.type === 'group') return null; const oid = c.participants.find(id => id !== currentUser?.uid); return oid ? c.participantRoles?.[oid] : null; };

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

  const sendPrivate = async () => {
    if (!newMessage.trim() || !currentUser || !activeConversation || sending) return;
    const text = newMessage.trim(); setNewMessage(''); setSending(true);
    try {
      await supabase.from('conversation_messages').insert({
        conversation_id: activeConversation.id, text, sender_id: currentUser.uid,
        sender_name: currentUser.name, sender_role: currentUser.role, sender_photo: currentUser.photoURL || null,
      });
      const uc = { ...(activeConversation.unreadCount || {}) };
      activeConversation.participants.forEach(pid => { if (pid !== currentUser.uid) uc[pid] = (uc[pid] || 0) + 1; });
      await supabase.from('conversations').update({ last_message: text.slice(0, 60), last_message_at: new Date().toISOString(), unread_count: uc }).eq('id', activeConversation.id);
      inputRef.current?.focus();
    } catch { setNewMessage(text); } finally { setSending(false); }
  };

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
    setActiveConversation(null); setPrivateMessages([]); setShowDeleteConvo(false); setView('tabs'); setAnimating(false);
    try {
      await supabase.from('conversation_messages').delete().eq('conversation_id', convoId);
      await supabase.from('conversations').delete().eq('id', convoId);
      toast.success('Conversation supprimée');
    } catch { toast.error('Erreur de suppression'); }
    finally { setDeletingConvo(false); }
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
        last_message: null, last_message_at: new Date().toISOString(), created_by: currentUser.uid, unread_count: unread,
      }).select('id').single();
      if (error) throw error;
      setActiveConversation({ id: inserted.id, participants: all, participantNames: names, participantPhotos: photos, participantRoles: roles, type: isGroup ? 'group' : 'private', name: isGroup ? groupName.trim() : undefined, unreadCount: unread });
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

  const formatDaySep = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const filteredMembers = visibleMembers.filter(m => m.id !== currentUser?.uid && m.name.toLowerCase().includes(searchMember.toLowerCase()));

  const renderMessages = (msgs: ChatMessage[], isGlobal: boolean, isGroupChat: boolean) => (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
      {msgs.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <MessageCircle size={24} className="text-primary/30" />
          <p className="text-xs text-foreground/50">Aucun message</p>
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

        return (
          <React.Fragment key={msg.id}>
            {showDateSep && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{formatDaySep(msg.createdAt)}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <div className={`group flex items-end gap-2 ${own ? 'flex-row-reverse' : ''} ${consecutive ? 'mt-0.5' : 'mt-3'}`}>
              {!own && !consecutive ? (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden ${ROLE_COLORS[senderRole] || 'bg-muted-foreground'}`}>
                  {senderPhoto ? <img src={senderPhoto} alt="" className="w-full h-full object-cover" /> : getInitials(senderName)}
                </div>
              ) : !own ? <div className="w-7 shrink-0" /> : null}
              <div className={`max-w-[80%] flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                {!consecutive && !own && (isGlobal || isGroupChat) && (
                  <span className={`text-[10px] font-bold mb-0.5 ml-0.5 ${ROLE_TEXT_COLORS[senderRole] || 'text-muted-foreground'}`}>{senderName}</span>
                )}
                <div className="flex items-center gap-1">
                  {own && <button onClick={() => deleteMessage(msg.id, isGlobal)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all"><Trash2 size={11} /></button>}
                  <div className={`px-3 py-2 text-[13px] leading-relaxed break-words ${own ? 'bg-gradient-to-br from-accent to-accent/90 text-accent-foreground rounded-2xl rounded-br-md' : 'bg-card text-foreground rounded-2xl rounded-bl-md border border-border'}`}>
                    {msg.imageUrl && <img src={msg.imageUrl} alt="" className="max-w-full rounded-lg mb-1 max-h-48 object-contain cursor-pointer" onClick={() => window.open(msg.imageUrl, '_blank')} />}
                    {msg.text && <span>{msg.text}</span>}
                  </div>
                  {!own && isAdmin && <button onClick={() => deleteMessage(msg.id, isGlobal)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all"><Trash2 size={11} /></button>}
                </div>
                {!consecutive && <span className={`text-[9px] text-foreground/35 mt-0.5 ${own ? 'mr-0.5' : 'ml-0.5'}`}>{formatMsgTime(msg.createdAt)}</span>}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );

  const renderInput = (onSend: () => void, showImage: boolean) => (
    <div className="border-t border-border px-3 py-2 bg-card shrink-0">
      <div className="flex items-center gap-1.5">
        {showImage && (
          <>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 rounded-lg text-foreground/40 hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40"><ImageIcon size={16} /></button>
          </>
        )}
        <input ref={inputRef} type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Message..." className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-[13px] transition-all"
          style={{ fontSize: '16px' }} maxLength={1000} />
        <button onClick={onSend} disabled={!newMessage.trim() || sending} className="p-2 bg-accent text-accent-foreground rounded-xl hover:shadow-md transition-all disabled:opacity-30"><Send size={16} /></button>
      </div>
      {uploading && <p className="text-[10px] text-accent mt-1 text-center animate-pulse">Envoi...</p>}
    </div>
  );

  if (!chatOpen) {
    return (
      <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 sm:left-auto sm:right-6 z-50">
        <button onClick={() => setChatOpen(true)} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg flex items-center justify-center bg-accent text-accent-foreground transition-all hover:scale-105 relative">
          <MessageCircle size={20} className="sm:w-6 sm:h-6" />
          {totalUnread > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center animate-scale-in shadow-md">{totalUnread > 99 ? '99+' : totalUnread}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 sm:left-auto sm:right-6 z-50 flex flex-col items-start sm:items-end gap-3">
      <div className="w-[calc(100vw-2rem)] sm:w-[380px] h-[55vh] sm:h-[540px] max-h-[calc(100dvh-12rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col">
        <div className={`flex flex-col flex-1 min-h-0 transition-all duration-200 ${animating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>


        {view === 'tabs' && (
          <>
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
              <span className="font-bold text-sm">💬 Discussion</span>
              <button onClick={() => setChatOpen(false)} className="p-1 rounded-lg hover:bg-white/15"><X size={18} /></button>
            </div>
            <div className="flex-1 flex flex-col">
              <button onClick={() => changeView('global')} className="flex items-center gap-3 px-4 py-4 hover:bg-primary/5 transition-all border-b border-border text-left">
                <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-md overflow-hidden"><img src={clubLogo} alt="Logo du club" className="w-8 h-8 object-contain" /></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-bold text-foreground">Discussion globale</p><p className="text-xs text-muted-foreground">Tout le club</p></div>
                {globalMessages.length > 0 && <span className="text-[10px] text-foreground/40">{formatTime(globalMessages[globalMessages.length - 1]?.createdAt)}</span>}
              </button>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <span className="text-xs font-bold text-foreground/60 uppercase tracking-wider">Messages privés</span>
                <button onClick={() => changeView('new-convo')} className="p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all"><Plus size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Lock size={20} className="text-primary/25" />
                    <p className="text-xs text-foreground/40">Pas de conversation privée</p>
                    <button onClick={() => changeView('new-convo')} className="text-xs text-accent font-semibold hover:underline">Démarrer une conversation</button>
                  </div>
                ) : conversations.map(convo => {
                  const name = getConvoName(convo); const photo = getConvoPhoto(convo); const role = getConvoRole(convo);
                  const unread = convo.unreadCount?.[currentUser?.uid || ''] || 0;
                  return (
                    <button key={convo.id} onClick={() => { setActiveConversation(convo); changeView('private-chat'); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-all border-b border-border/50 ${unread > 0 ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-primary/5'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden shadow-sm ${convo.type === 'group' ? 'bg-accent' : (ROLE_COLORS[role || ''] || 'bg-primary/50')}`}>
                        {convo.type === 'group' ? <UsersIcon size={16} /> : photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-[13px] truncate ${unread > 0 ? 'font-bold' : 'font-semibold'} text-foreground`}>{name}</p>
                          {convo.lastMessageAt && <span className={`text-[10px] shrink-0 ${unread > 0 ? 'text-accent font-semibold' : 'text-foreground/35'}`}>{formatTime(convo.lastMessageAt)}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <p className={`text-[11px] truncate ${unread > 0 ? 'text-foreground font-medium' : 'text-foreground/45'}`}>{convo.lastMessage || 'Pas de message'}</p>
                          {unread > 0 && <span className="bg-accent text-accent-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{unread}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {view === 'global' && (
          <>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground shrink-0">
              <button onClick={() => changeView('tabs')} className="p-1.5 rounded-lg hover:bg-white/15"><ArrowLeft size={18} /></button>
              <img src={clubLogo} alt="Logo" className="w-6 h-6 object-contain rounded-full bg-white p-0.5" />
              <span className="font-bold text-sm flex-1">Discussion globale</span>
              <button onClick={() => setChatOpen(false)} className="p-1 rounded-lg hover:bg-white/15"><X size={16} /></button>
            </div>
            {renderMessages(globalMessages, true, true)}
            {currentUser && renderInput(sendGlobal, false)}
          </>
        )}

        {view === 'new-convo' && (
          <>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground shrink-0">
              <button onClick={() => { changeView('tabs'); setSelectedMembers([]); setGroupName(''); setSearchMember(''); }} className="p-1.5 rounded-lg hover:bg-white/15"><ArrowLeft size={18} /></button>
              <span className="font-bold text-sm flex-1">Nouvelle conversation</span>
              <button onClick={() => setChatOpen(false)} className="p-1 rounded-lg hover:bg-white/15"><X size={16} /></button>
            </div>
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={searchMember} onChange={e => setSearchMember(e.target.value)} placeholder="Rechercher..."
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-[13px]" />
              </div>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedMembers.map(mid => { const m = members.find(x => x.id === mid); return (
                    <span key={mid} className="inline-flex items-center gap-1 px-2 py-1 bg-accent/15 text-accent rounded-full text-[11px] font-semibold">{m?.name}<button onClick={() => toggleMember(mid)} className="hover:text-destructive"><X size={10} /></button></span>
                  ); })}
                </div>
              )}
              {selectedMembers.length > 1 && (
                <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Nom du groupe..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-[13px]" />
              )}
              <div className="space-y-0.5">
                {filteredMembers.map(member => (
                  <button key={member.id} onClick={() => toggleMember(member.id)}
                    className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl transition-all text-left ${selectedMembers.includes(member.id) ? 'bg-accent/10 ring-1 ring-accent/30' : 'hover:bg-primary/5'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden ${ROLE_COLORS[member.role] || 'bg-muted-foreground'}`}>
                      {member.photoURL ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" /> : getInitials(member.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{member.name}</p>
                      <span className={`text-[9px] font-semibold uppercase ${ROLE_TEXT_COLORS[member.role] || 'text-muted-foreground'}`}>{ROLE_LABELS[member.role] || member.role}</span>
                    </div>
                    {selectedMembers.includes(member.id) && <div className="w-4 h-4 bg-accent rounded-full flex items-center justify-center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 border-t border-border shrink-0">
              <button onClick={createConversation} disabled={selectedMembers.length === 0}
                className="w-full py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold text-[13px] hover:shadow-md transition-all disabled:opacity-40">
                {selectedMembers.length > 1 ? 'Créer le groupe' : 'Démarrer'}
              </button>
            </div>
          </>
        )}

        {view === 'private-chat' && activeConversation && (
          <>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground shrink-0">
              <button onClick={() => { changeView('tabs'); setActiveConversation(null); }} className="p-1.5 rounded-lg hover:bg-white/15"><ArrowLeft size={18} /></button>
              {(() => {
                const photo = getConvoPhoto(activeConversation); const role = getConvoRole(activeConversation); const name = getConvoName(activeConversation);
                return (
                  <>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden ring-1 ring-white/20 ${activeConversation.type === 'group' ? 'bg-white/20' : (ROLE_COLORS[role || ''] || 'bg-white/20')}`}>
                      {activeConversation.type === 'group' ? <UsersIcon size={14} /> : photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold truncate">{name}</p>
                      {activeConversation.type === 'group' && <p className="text-[10px] opacity-70">{activeConversation.participants.length} membres</p>}
                    </div>
                  </>
                );
              })()}
              <button onClick={() => setShowDeleteConvo(true)} className="p-1.5 rounded-lg hover:bg-white/15" title="Supprimer"><Trash2 size={16} /></button>
              <button onClick={() => setChatOpen(false)} className="p-1 rounded-lg hover:bg-white/15"><X size={16} /></button>
            </div>

            {showDeleteConvo && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl">
                <div className="bg-card border border-border rounded-2xl p-5 mx-3 max-w-[280px] w-full shadow-xl">
                  <div className="flex items-center gap-2 mb-2"><Trash2 size={18} className="text-destructive" /><h3 className="text-sm font-bold text-foreground">Supprimer ?</h3></div>
                  <p className="text-xs text-muted-foreground mb-4">Tous les messages seront définitivement supprimés.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowDeleteConvo(false)} disabled={deletingConvo} className="flex-1 px-3 py-2 bg-secondary text-foreground rounded-xl font-medium text-xs">Annuler</button>
                    <button onClick={() => deleteConversation(activeConversation.id)} disabled={deletingConvo} className="flex-1 px-3 py-2 bg-destructive text-destructive-foreground rounded-xl font-medium text-xs disabled:opacity-50">{deletingConvo ? '...' : 'Supprimer'}</button>
                  </div>
                </div>
              </div>
            )}

            {renderMessages(privateMessages, false, activeConversation.type === 'group')}
            {currentUser && renderInput(sendPrivate, true)}
          </>
        )}

        {view === 'private-chat' && !activeConversation && (
          <>
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
              <span className="font-bold text-sm">💬 Discussion</span>
              <button onClick={() => setChatOpen(false)} className="p-1 rounded-lg hover:bg-white/15"><X size={18} /></button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <button onClick={() => changeView('tabs')} className="text-sm text-accent font-semibold hover:underline">← Retour aux discussions</button>
            </div>
          </>
        )}

        </div>
      </div>

      <button onClick={() => { setChatOpen(false); setView('tabs'); }}
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg flex items-center justify-center bg-muted text-muted-foreground transition-all hover:scale-105">
        <X size={20} className="sm:w-6 sm:h-6" />
      </button>
    </div>
  );
};

export default ChatBubble;

