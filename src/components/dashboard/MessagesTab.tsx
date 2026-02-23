import React, { useState, useEffect, useRef } from 'react';
import {
  Send, MessageCircle, Plus, ArrowLeft, Users as UsersIcon, Search,
  Trash2, Image as ImageIcon, X, MoreVertical
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { AppUser } from '@/contexts/AuthContext';
import type { Member } from '@/pages/Dashboard';
import { toast } from 'sonner';

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

interface Message {
  id: string;
  text: string;
  imageUrl?: string;
  senderId: string;
  senderName: string;
  senderRole: string;
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

const mapConvo = (r: any): Conversation => ({
  id: r.id, participants: r.participants, participantNames: r.participant_names || {},
  participantPhotos: r.participant_photos || {}, participantRoles: r.participant_roles || {},
  type: r.type, name: r.name, lastMessage: r.last_message, lastMessageAt: r.last_message_at,
  createdBy: r.created_by, unreadCount: r.unread_count || {},
});
const mapMsg = (r: any): Message => ({
  id: r.id, text: r.text || '', imageUrl: r.image_url, senderId: r.sender_id,
  senderName: r.sender_name, senderRole: r.sender_role, senderPhoto: r.sender_photo, createdAt: r.created_at,
});

const MessagesTab: React.FC<Props> = ({ currentUser, members }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [searchMember, setSearchMember] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showDeleteConvoConfirm, setShowDeleteConvoConfirm] = useState(false);
  const [deletingConvo, setDeletingConvo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleMembers = members.filter(m => m.role !== 'admin+' || m.id === currentUser?.uid);

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

    const isIOSNative = /iPad|iPhone|iPod/.test(navigator.userAgent) && (window as any).Capacitor?.isNativePlatform?.();

    if (isIOSNative) {
      const interval = setInterval(fetchConvos, 1000);
      return () => { clearInterval(interval); };
    }

    const channel = supabase.channel('messages-tab-convos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchConvos)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  useEffect(() => {
    if (!activeConversation) { setMessages([]); return; }
    const fetchMsgs = async () => {
      const { data } = await supabase.from('conversation_messages').select('*').eq('conversation_id', activeConversation.id).order('created_at', { ascending: true });
      if (data) setMessages(data.map(mapMsg));
    };
    fetchMsgs();
    if (currentUser) {
      const uc = { ...(activeConversation.unreadCount || {}), [currentUser.uid]: 0 };
      supabase.from('conversations').update({ unread_count: uc }).eq('id', activeConversation.id).then(() => {});
    }

    const isIOSNative = /iPad|iPhone|iPod/.test(navigator.userAgent) && (window as any).Capacitor?.isNativePlatform?.();

    if (isIOSNative) {
      const interval = setInterval(fetchMsgs, 1000);
      return () => { clearInterval(interval); };
    }

    const channel = supabase.channel(`messages-tab-msgs-${activeConversation.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${activeConversation.id}` }, fetchMsgs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversation?.id, currentUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const getConversationName = (convo: Conversation) => { if (convo.type === 'group') return convo.name || 'Groupe'; const oid = convo.participants.find(id => id !== currentUser?.uid); return oid ? (convo.participantNames?.[oid] || 'Utilisateur') : 'Conversation'; };
  const getConversationPhoto = (convo: Conversation) => { if (convo.type === 'group') return null; const oid = convo.participants.find(id => id !== currentUser?.uid); return oid ? convo.participantPhotos?.[oid] : null; };
  const getConversationRole = (convo: Conversation) => { if (convo.type === 'group') return null; const oid = convo.participants.find(id => id !== currentUser?.uid); return oid ? convo.participantRoles?.[oid] : null; };
  const getUnreadCount = (convo: Conversation) => currentUser ? (convo.unreadCount?.[currentUser.uid] || 0) : 0;

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUser || !activeConversation || sending) return;
    const text = newMessage.trim(); setNewMessage(''); setSending(true);
    try {
      await supabase.from('conversation_messages').insert({
        conversation_id: activeConversation.id, text, sender_id: currentUser.uid,
        sender_name: currentUser.name, sender_role: currentUser.role, sender_photo: currentUser.photoURL || null,
      });
      const uc = { ...(activeConversation.unreadCount || {}) };
      activeConversation.participants.forEach(pid => { if (pid !== currentUser.uid) uc[pid] = (uc[pid] || 0) + 1; });
      await supabase.from('conversations').update({ last_message: text.length > 60 ? text.slice(0, 60) + '…' : text, last_message_at: new Date().toISOString(), unread_count: uc }).eq('id', activeConversation.id);
      inputRef.current?.focus();
    } catch (err) { console.error('Error sending message:', err); setNewMessage(text); }
    finally { setSending(false); }
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
    } catch (err: any) { console.error('Upload error:', err); toast.error("Erreur lors de l'envoi de l'image"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!activeConversation) return;
    try { await supabase.from('conversation_messages').delete().eq('id', msgId); toast.success('Message supprimé'); }
    catch (err) { console.error('Error deleting message:', err); toast.error('Impossible de supprimer ce message'); }
  };

  const handleDeleteConversation = async (convoId: string) => {
    setDeletingConvo(true);
    try {
      await supabase.from('conversation_messages').delete().eq('conversation_id', convoId);
      await supabase.from('conversations').delete().eq('id', convoId);
      setActiveConversation(null); setShowDeleteConvoConfirm(false);
      toast.success('Conversation supprimée');
    } catch (err) { console.error('Error deleting conversation:', err); toast.error('Impossible de supprimer cette conversation'); }
    finally { setDeletingConvo(false); }
  };

  const createConversation = async () => {
    if (!currentUser || selectedMembers.length === 0) return;
    const isGroup = selectedMembers.length > 1;
    if (isGroup && !groupName.trim()) { toast.error('Donne un nom au groupe'); return; }
    if (!isGroup) {
      const existing = conversations.find(c => c.type === 'private' && c.participants.length === 2 && c.participants.includes(selectedMembers[0]));
      if (existing) { setActiveConversation(existing); setShowNewConvo(false); setSelectedMembers([]); setGroupName(''); setSearchMember(''); return; }
    }
    try {
      // Ensure Supabase auth session is active (required for RLS)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée, veuillez vous reconnecter');
        return;
      }
      // Use the auth user id to satisfy RLS policy (auth.uid() = ANY(participants))
      const authUserId = session.user.id;
      const allParticipantsAuth = [authUserId, ...selectedMembers.filter(id => id !== authUserId)];
      const participantNamesAuth: Record<string, string> = { [authUserId]: currentUser.name };
      const participantPhotosAuth: Record<string, string | null> = { [authUserId]: currentUser.photoURL || null };
      const participantRolesAuth: Record<string, string> = { [authUserId]: currentUser.role };
      const unreadCountAuth: Record<string, number> = { [authUserId]: 0 };
      selectedMembers.forEach(mid => {
        if (mid === authUserId) return;
        const member = members.find(m => m.id === mid);
        if (member) { participantNamesAuth[mid] = member.name; participantPhotosAuth[mid] = member.photoURL || null; participantRolesAuth[mid] = member.role; }
        unreadCountAuth[mid] = 0;
      });
      const insertPayload = {
        participants: allParticipantsAuth,
        participant_names: participantNamesAuth as any,
        participant_photos: participantPhotosAuth as any,
        participant_roles: participantRolesAuth as any,
        type: isGroup ? 'group' : 'private',
        name: isGroup ? groupName.trim() : null,
        last_message: null,
        last_message_at: new Date().toISOString(),
        created_by: authUserId,
        unread_count: unreadCountAuth as any,
      };
      console.log('Creating conversation with auth uid:', authUserId);
      const { data: inserted, error } = await supabase.from('conversations').insert(insertPayload).select('id').single();
      if (error) {
        console.error('Supabase conversation insert error:', error.message, error.details, error.hint, error.code);
        toast.error(`Erreur: ${error.message}`);
        return;
      }
      setActiveConversation({ id: inserted.id, participants: allParticipantsAuth, participantNames: participantNamesAuth, participantPhotos: participantPhotosAuth, participantRoles: participantRolesAuth, type: isGroup ? 'group' : 'private', name: isGroup ? groupName.trim() : undefined, unreadCount: unreadCountAuth });
      setShowNewConvo(false); setSelectedMembers([]); setGroupName(''); setSearchMember('');
    } catch (err: any) { console.error('Error creating conversation:', err); toast.error(`Erreur: ${err?.message || 'Erreur inconnue'}`); }
  };

  const toggleMemberSelection = (memberId: string) => setSelectedMembers(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]);

  const formatTime = (ts?: string) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() === now.toDateString()) return time;
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Hier';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const formatMessageTime = (ts: string) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const isConsecutive = (idx: number) => {
    if (idx === 0) return false;
    const prev = messages[idx - 1], curr = messages[idx];
    if (prev.senderId !== curr.senderId) return false;
    return new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime() < 120000;
  };

  const isDifferentDay = (idx: number) => {
    if (idx === 0) return true;
    return new Date(messages[idx - 1].createdAt).toDateString() !== new Date(messages[idx].createdAt).toDateString();
  };

  const formatDateSeparator = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Hier';
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const filteredMembers = visibleMembers.filter(m => m.id !== currentUser?.uid && m.name.toLowerCase().includes(searchMember.toLowerCase()));
  const totalUnread = conversations.reduce((sum, c) => sum + getUnreadCount(c), 0);

  if (!currentUser) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">🔒 Connectez-vous pour accéder aux messages</div>;
  }

  if (showNewConvo) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-primary/5">
          <button onClick={() => { setShowNewConvo(false); setSelectedMembers([]); setGroupName(''); setSearchMember(''); }} className="p-2 rounded-xl hover:bg-primary/10 transition-all text-foreground"><ArrowLeft size={20} /></button>
          <h2 className="text-base font-bold text-foreground">Nouvelle conversation</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={searchMember} onChange={e => setSearchMember(e.target.value)} placeholder="Rechercher un membre..." className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-sm" />
          </div>
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedMembers.map(mid => { const member = members.find(m => m.id === mid); return (
                <span key={mid} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/15 text-accent rounded-full text-xs font-semibold">{member?.name}<button onClick={() => toggleMemberSelection(mid)} className="hover:text-destructive transition-colors"><X size={12} /></button></span>
              ); })}
            </div>
          )}
          {selectedMembers.length > 1 && <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Nom du groupe..." className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-sm" />}
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            {filteredMembers.map(member => (
              <button key={member.id} onClick={() => toggleMemberSelection(member.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-left ${selectedMembers.includes(member.id) ? 'bg-accent/10 ring-1 ring-accent/30' : 'hover:bg-primary/5'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden ${ROLE_COLORS[member.role] || 'bg-muted-foreground'}`}>
                  {member.photoURL ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" /> : getInitials(member.name)}
                </div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-foreground truncate">{member.name}</p><span className={`text-[10px] font-semibold uppercase ${ROLE_TEXT_COLORS[member.role] || 'text-muted-foreground'}`}>{ROLE_LABELS[member.role] || member.role}</span></div>
                {selectedMembers.includes(member.id) && <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>}
              </button>
            ))}
          </div>
          <button onClick={createConversation} disabled={selectedMembers.length === 0} className="w-full py-3 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground rounded-xl font-semibold text-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {selectedMembers.length > 1 ? 'Créer le groupe' : 'Démarrer la conversation'}
          </button>
        </div>
      </div>
    );
  }

  if (activeConversation) {
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'admin+';
    return (
      <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-primary text-primary-foreground shrink-0">
          <button onClick={() => setActiveConversation(null)} className="p-2 rounded-xl hover:bg-white/15 transition-all"><ArrowLeft size={20} /></button>
          {(() => { const photo = getConversationPhoto(activeConversation); const role = getConversationRole(activeConversation); const name = getConversationName(activeConversation); return (<>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden ring-2 ring-white/20 ${activeConversation.type === 'group' ? 'bg-white/20' : (ROLE_COLORS[role || ''] || 'bg-white/20')}`}>
              {activeConversation.type === 'group' ? <UsersIcon size={18} /> : photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
            </div>
            <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{name}</p>{activeConversation.type === 'group' && <p className="text-[11px] opacity-80 truncate">{activeConversation.participants.length} membres</p>}</div>
          </>); })()}
          <button onClick={() => setShowDeleteConvoConfirm(true)} className="p-2 rounded-xl hover:bg-white/15 transition-all" title="Supprimer la conversation"><Trash2 size={18} /></button>
        </div>

        {showDeleteConvoConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ borderRadius: 'inherit' }}>
            <div className="bg-card border border-border rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center"><Trash2 size={20} className="text-destructive" /></div><h3 className="text-base font-bold text-foreground">Supprimer la conversation ?</h3></div>
              <p className="text-sm text-muted-foreground mb-5">Tous les messages seront définitivement supprimés. Cette action est irréversible.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConvoConfirm(false)} disabled={deletingConvo} className="flex-1 px-4 py-2.5 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">Annuler</button>
                <button onClick={() => handleDeleteConversation(activeConversation.id)} disabled={deletingConvo} className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm disabled:opacity-50">{deletingConvo ? 'Suppression...' : 'Supprimer'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 bg-background/50" style={{ scrollbarWidth: 'thin' }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center"><MessageCircle size={28} className="text-primary/40" /></div>
              <p className="text-sm font-medium text-foreground/60">Aucun message. Commencez la conversation ! 💬</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const own = msg.senderId === currentUser.uid;
            const consecutive = isConsecutive(idx);
            const showDateSep = isDifferentDay(idx);
            return (
              <React.Fragment key={msg.id}>
                {showDateSep && <div className="flex items-center gap-3 py-3"><div className="flex-1 h-px bg-border" /><span className="text-[11px] font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">{formatDateSeparator(msg.createdAt)}</span><div className="flex-1 h-px bg-border" /></div>}
                <div className={`group flex items-end gap-2.5 ${own ? 'flex-row-reverse' : ''} ${consecutive ? 'mt-0.5' : 'mt-4'}`}>
                  {!own && !consecutive ? (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden shadow-sm ${ROLE_COLORS[msg.senderRole] || 'bg-muted-foreground'}`}>
                      {msg.senderPhoto ? <img src={msg.senderPhoto} alt="" className="w-full h-full object-cover" /> : getInitials(msg.senderName)}
                    </div>
                  ) : !own ? <div className="w-8 shrink-0" /> : null}
                  <div className={`max-w-[78%] flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                    {!consecutive && !own && activeConversation.type === 'group' && <span className={`text-xs font-bold mb-1 ml-1 ${ROLE_TEXT_COLORS[msg.senderRole] || 'text-muted-foreground'}`}>{msg.senderName}</span>}
                    <div className="flex items-center gap-1.5">
                      {own && <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all" title="Supprimer"><Trash2 size={13} /></button>}
                      <div className={`px-4 py-2.5 text-sm leading-relaxed break-words shadow-sm ${own ? 'bg-gradient-to-br from-accent to-accent/90 text-accent-foreground rounded-2xl rounded-br-lg' : 'bg-card text-foreground rounded-2xl rounded-bl-lg border border-border'}`}>
                        {msg.imageUrl && <img src={msg.imageUrl} alt="Image" className="max-w-full rounded-xl mb-1 max-h-64 object-contain cursor-pointer" onClick={() => window.open(msg.imageUrl, '_blank')} />}
                        {msg.text && <span>{msg.text}</span>}
                      </div>
                      {!own && isAdmin && <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all" title="Supprimer"><Trash2 size={13} /></button>}
                    </div>
                    {!consecutive && <span className={`text-[10px] text-foreground/40 mt-1 ${own ? 'mr-1' : 'ml-1'}`}>{formatMessageTime(msg.createdAt)}</span>}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border px-4 py-3 bg-card shrink-0">
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2.5 rounded-xl text-foreground/50 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-40"><ImageIcon size={18} /></button>
            <input ref={inputRef} type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Écrivez un message..." className="flex-1 px-4 py-2.5 bg-background border border-border rounded-2xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-sm transition-all" style={{ fontSize: '16px' }} maxLength={1000} />
            <button onClick={handleSend} disabled={!newMessage.trim() || sending} className="p-2.5 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground rounded-2xl hover:shadow-md hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed"><Send size={18} /></button>
          </div>
          {uploading && <p className="text-xs text-accent mt-2 text-center animate-pulse font-medium">Envoi de l'image...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Messages</h2>
        <button onClick={() => setShowNewConvo(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground rounded-xl text-sm font-semibold hover:shadow-md transition-all"><Plus size={16} /><span className="hidden sm:inline">Nouveau</span></button>
      </div>
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center"><MessageCircle size={36} className="text-primary/40" /></div>
          <div className="text-center"><p className="text-sm font-semibold text-foreground">Aucune conversation</p><p className="text-xs mt-1 text-muted-foreground">Démarrez une conversation privée ou créez un groupe 💬</p></div>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map(convo => {
            const name = getConversationName(convo); const photo = getConversationPhoto(convo); const role = getConversationRole(convo); const unread = getUnreadCount(convo);
            return (
              <div key={convo.id} className={`relative flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-all text-left cursor-pointer border ${unread > 0 ? 'bg-accent/5 border-accent/20 hover:bg-accent/10' : 'bg-card border-border hover:bg-primary/5'}`} onClick={() => setActiveConversation(convo)}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden shadow-md ${convo.type === 'group' ? 'bg-accent' : (ROLE_COLORS[role || ''] || 'bg-primary/60')}`}>
                  {convo.type === 'group' ? <UsersIcon size={20} /> : photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${unread > 0 ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}>{name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {convo.lastMessageAt && <span className={`text-[11px] ${unread > 0 ? 'text-accent font-semibold' : 'text-foreground/40'}`}>{formatTime(convo.lastMessageAt)}</span>}
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteConversation(convo.id); }} className="p-1 rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all" title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-xs truncate ${unread > 0 ? 'text-foreground font-medium' : 'text-foreground/50'}`}>{convo.lastMessage || 'Pas encore de message'}</p>
                    {unread > 0 && <span className="bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 min-w-[20px] text-center shadow-sm">{unread}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MessagesTab;
