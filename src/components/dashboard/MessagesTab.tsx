import React, { useState, useEffect, useRef } from 'react';
import {
  Send, MessageCircle, Plus, ArrowLeft, Users as UsersIcon, Search,
  Trash2, Image as ImageIcon, X, UserPlus
} from 'lucide-react';
import {
  db, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  where, doc, updateDoc, deleteDoc, getDocs, getDoc, setDoc, Timestamp
} from '@/lib/firebase';
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
  lastMessageAt?: any;
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
  createdAt: any;
}

interface Props {
  currentUser: AppUser | null;
  members: Member[];
}

const ROLE_COLORS: Record<string, string> = {
  'admin+': 'bg-red-500',
  'admin': 'bg-orange-500',
  'entraineur': 'bg-accent',
  'joueur': 'bg-emerald-500',
  'photographe': 'bg-purple-500',
  'dirigeant': 'bg-amber-600',
};

const ROLE_TEXT_COLORS: Record<string, string> = {
  'admin+': 'text-red-500',
  'admin': 'text-orange-500',
  'entraineur': 'text-accent',
  'joueur': 'text-emerald-500',
  'photographe': 'text-purple-500',
  'dirigeant': 'text-amber-600',
};

const ROLE_LABELS: Record<string, string> = {
  'admin+': 'Super Admin',
  'admin': 'Admin',
  'entraineur': 'Entraîneur',
  'joueur': 'Joueur',
  'photographe': 'Photo',
  'dirigeant': 'Dirigeant',
};

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleMembers = members.filter(m => m.role !== 'admin+' || m.id === currentUser?.uid);

  // Listen to conversations
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'private_conversations'),
      where('participants', 'array-contains', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const convos: Conversation[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as Conversation));
      convos.sort((a, b) => {
        const aTime = a.lastMessageAt?.toDate?.()?.getTime() || 0;
        const bTime = b.lastMessageAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      setConversations(convos);
    }, (err) => console.warn('Conversations listener error:', err));
    return () => unsub();
  }, [currentUser]);

  // Listen to messages of active conversation
  useEffect(() => {
    if (!activeConversation) { setMessages([]); return; }
    const q = query(
      collection(db, 'private_conversations', activeConversation.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    }, (err) => console.warn('Messages listener error:', err));

    // Mark as read
    if (currentUser) {
      updateDoc(doc(db, 'private_conversations', activeConversation.id), {
        [`unreadCount.${currentUser.uid}`]: 0,
      }).catch(() => {});
    }

    return () => unsub();
  }, [activeConversation?.id, currentUser]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getConversationName = (convo: Conversation) => {
    if (convo.type === 'group') return convo.name || 'Groupe';
    const otherId = convo.participants.find(id => id !== currentUser?.uid);
    return otherId ? (convo.participantNames?.[otherId] || 'Utilisateur') : 'Conversation';
  };

  const getConversationPhoto = (convo: Conversation) => {
    if (convo.type === 'group') return null;
    const otherId = convo.participants.find(id => id !== currentUser?.uid);
    return otherId ? convo.participantPhotos?.[otherId] : null;
  };

  const getConversationRole = (convo: Conversation) => {
    if (convo.type === 'group') return null;
    const otherId = convo.participants.find(id => id !== currentUser?.uid);
    return otherId ? convo.participantRoles?.[otherId] : null;
  };

  const getUnreadCount = (convo: Conversation) => {
    if (!currentUser) return 0;
    return convo.unreadCount?.[currentUser.uid] || 0;
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUser || !activeConversation || sending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      await addDoc(collection(db, 'private_conversations', activeConversation.id, 'messages'), {
        text,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        senderPhoto: currentUser.photoURL || null,
        createdAt: serverTimestamp(),
      });
      // Update last message and unread counts
      const unreadUpdates: Record<string, number> = {};
      activeConversation.participants.forEach(pid => {
        if (pid !== currentUser.uid) {
          unreadUpdates[`unreadCount.${pid}`] = (activeConversation.unreadCount?.[pid] || 0) + 1;
        }
      });
      await updateDoc(doc(db, 'private_conversations', activeConversation.id), {
        lastMessage: text.length > 60 ? text.slice(0, 60) + '…' : text,
        lastMessageAt: serverTimestamp(),
        ...unreadUpdates,
      });
      inputRef.current?.focus();
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !activeConversation) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop lourde (max 5 Mo)');
      return;
    }
    setUploading(true);
    try {
      const fileName = `messages/${activeConversation.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('photos').upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(data.path);
      
      await addDoc(collection(db, 'private_conversations', activeConversation.id, 'messages'), {
        text: '',
        imageUrl: urlData.publicUrl,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        senderPhoto: currentUser.photoURL || null,
        createdAt: serverTimestamp(),
      });
      const unreadUpdates: Record<string, number> = {};
      activeConversation.participants.forEach(pid => {
        if (pid !== currentUser.uid) {
          unreadUpdates[`unreadCount.${pid}`] = (activeConversation.unreadCount?.[pid] || 0) + 1;
        }
      });
      await updateDoc(doc(db, 'private_conversations', activeConversation.id), {
        lastMessage: '📷 Photo',
        lastMessageAt: serverTimestamp(),
        ...unreadUpdates,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error("Erreur lors de l'envoi de l'image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const createConversation = async () => {
    if (!currentUser || selectedMembers.length === 0) return;
    const isGroup = selectedMembers.length > 1;
    if (isGroup && !groupName.trim()) {
      toast.error('Donne un nom au groupe');
      return;
    }

    // For 1-to-1, check if conversation already exists
    if (!isGroup) {
      const existing = conversations.find(c =>
        c.type === 'private' &&
        c.participants.length === 2 &&
        c.participants.includes(selectedMembers[0])
      );
      if (existing) {
        setActiveConversation(existing);
        setShowNewConvo(false);
        setSelectedMembers([]);
        setGroupName('');
        setSearchMember('');
        return;
      }
    }

    const allParticipants = [currentUser.uid, ...selectedMembers];
    const participantNames: Record<string, string> = { [currentUser.uid]: currentUser.name };
    const participantPhotos: Record<string, string | null> = { [currentUser.uid]: currentUser.photoURL || null };
    const participantRoles: Record<string, string> = { [currentUser.uid]: currentUser.role };
    const unreadCount: Record<string, number> = {};

    selectedMembers.forEach(mid => {
      const member = members.find(m => m.id === mid);
      if (member) {
        participantNames[mid] = member.name;
        participantPhotos[mid] = member.photoURL || null;
        participantRoles[mid] = member.role;
      }
      unreadCount[mid] = 0;
    });
    unreadCount[currentUser.uid] = 0;

    try {
      const docRef = await addDoc(collection(db, 'private_conversations'), {
        participants: allParticipants,
        participantNames,
        participantPhotos,
        participantRoles,
        type: isGroup ? 'group' : 'private',
        name: isGroup ? groupName.trim() : null,
        lastMessage: null,
        lastMessageAt: serverTimestamp(),
        createdBy: currentUser.uid,
        unreadCount,
      });
      const newConvo: Conversation = {
        id: docRef.id,
        participants: allParticipants,
        participantNames,
        participantPhotos,
        participantRoles,
        type: isGroup ? 'group' : 'private',
        name: isGroup ? groupName.trim() : undefined,
        unreadCount,
      };
      setActiveConversation(newConvo);
      setShowNewConvo(false);
      setSelectedMembers([]);
      setGroupName('');
      setSearchMember('');
    } catch (err) {
      console.error('Error creating conversation:', err);
      toast.error('Erreur lors de la création de la conversation');
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    if (isYesterday) return `Hier`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const isConsecutive = (idx: number) => {
    if (idx === 0) return false;
    const prev = messages[idx - 1];
    const curr = messages[idx];
    if (prev.senderId !== curr.senderId) return false;
    if (!prev.createdAt?.toDate || !curr.createdAt?.toDate) return false;
    return curr.createdAt.toDate().getTime() - prev.createdAt.toDate().getTime() < 120000;
  };

  const isDifferentDay = (idx: number) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    const curr = messages[idx];
    if (!prev.createdAt?.toDate || !curr.createdAt?.toDate) return false;
    return prev.createdAt.toDate().toDateString() !== curr.createdAt.toDate().toDateString();
  };

  const formatDateSeparator = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Hier';
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const filteredMembers = visibleMembers.filter(m =>
    m.id !== currentUser?.uid &&
    m.name.toLowerCase().includes(searchMember.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + getUnreadCount(c), 0);

  // --- RENDER ---

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        🔒 Connectez-vous pour accéder aux messages
      </div>
    );
  }

  // New conversation modal
  if (showNewConvo) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={() => { setShowNewConvo(false); setSelectedMembers([]); setGroupName(''); setSearchMember(''); }}
            className="p-2 rounded-xl hover:bg-secondary transition-all">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-base font-bold text-foreground">Nouvelle conversation</h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchMember}
              onChange={e => setSearchMember(e.target.value)}
              placeholder="Rechercher un membre..."
              className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-sm"
            />
          </div>

          {/* Selected chips */}
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedMembers.map(mid => {
                const member = members.find(m => m.id === mid);
                return (
                  <span key={mid}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent rounded-full text-xs font-medium">
                    {member?.name}
                    <button onClick={() => toggleMemberSelection(mid)}
                      className="hover:text-destructive transition-colors">
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Group name */}
          {selectedMembers.length > 1 && (
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Nom du groupe..."
              className="w-full px-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-sm"
            />
          )}

          {/* Members list */}
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            {filteredMembers.map(member => (
              <button
                key={member.id}
                onClick={() => toggleMemberSelection(member.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all text-left ${
                  selectedMembers.includes(member.id)
                    ? 'bg-accent/10 ring-1 ring-accent/30'
                    : 'hover:bg-secondary'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden ${ROLE_COLORS[member.role] || 'bg-muted-foreground'}`}>
                  {member.photoURL ? (
                    <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(member.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
                  <span className={`text-[10px] font-semibold uppercase ${ROLE_TEXT_COLORS[member.role] || 'text-muted-foreground'}`}>
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                </div>
                {selectedMembers.includes(member.id) && (
                  <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Create button */}
          <button
            onClick={createConversation}
            disabled={selectedMembers.length === 0}
            className="w-full py-3 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground rounded-xl font-semibold text-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selectedMembers.length > 1 ? 'Créer le groupe' : 'Démarrer la conversation'}
          </button>
        </div>
      </div>
    );
  }

  // Active conversation: message view
  if (activeConversation) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <button onClick={() => setActiveConversation(null)}
            className="p-2 rounded-xl hover:bg-secondary transition-all">
            <ArrowLeft size={20} />
          </button>
          {(() => {
            const photo = getConversationPhoto(activeConversation);
            const role = getConversationRole(activeConversation);
            const name = getConversationName(activeConversation);
            return (
              <>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden ${
                  activeConversation.type === 'group' ? 'bg-accent' : (ROLE_COLORS[role || ''] || 'bg-muted-foreground')
                }`}>
                  {activeConversation.type === 'group' ? (
                    <UsersIcon size={18} />
                  ) : photo ? (
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{name}</p>
                  {activeConversation.type === 'group' && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {activeConversation.participants.length} membres
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-12">
              <div className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center">
                <MessageCircle size={28} className="opacity-40" />
              </div>
              <p className="text-sm">Aucun message. Commencez la conversation ! 💬</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const own = msg.senderId === currentUser.uid;
            const consecutive = isConsecutive(idx);
            const showDateSep = isDifferentDay(idx);

            return (
              <React.Fragment key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] font-medium text-muted-foreground bg-card px-3 py-1 rounded-full border border-border shadow-sm">
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <div className={`group flex items-end gap-2.5 ${own ? 'flex-row-reverse' : ''} ${consecutive ? 'mt-0.5' : 'mt-4'}`}>
                  {!own && !consecutive ? (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden ${ROLE_COLORS[msg.senderRole] || 'bg-muted-foreground'}`}>
                      {msg.senderPhoto ? (
                        <img src={msg.senderPhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(msg.senderName)
                      )}
                    </div>
                  ) : !own ? (
                    <div className="w-8 shrink-0" />
                  ) : null}

                  <div className={`max-w-[78%] flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                    {!consecutive && !own && activeConversation.type === 'group' && (
                      <span className={`text-xs font-bold mb-1 ml-1 ${ROLE_TEXT_COLORS[msg.senderRole] || 'text-muted-foreground'}`}>
                        {msg.senderName}
                      </span>
                    )}
                    <div
                      className={`px-4 py-2.5 text-sm leading-relaxed break-words shadow-sm ${
                        own
                          ? 'bg-gradient-to-br from-accent to-accent/90 text-accent-foreground rounded-2xl rounded-br-lg'
                          : 'bg-secondary text-foreground rounded-2xl rounded-bl-lg border border-border/50'
                      }`}
                    >
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="Image" className="max-w-full rounded-xl mb-1 max-h-64 object-contain cursor-pointer"
                          onClick={() => window.open(msg.imageUrl, '_blank')} />
                      )}
                      {msg.text && <span>{msg.text}</span>}
                    </div>
                    {!consecutive && (
                      <span className={`text-[10px] text-muted-foreground/70 mt-1 ${own ? 'mr-1' : 'ml-1'}`}>
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3 bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2.5 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-all disabled:opacity-40">
              <ImageIcon size={18} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Écrivez un message..."
              className="flex-1 px-4 py-2.5 bg-secondary border border-border rounded-2xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 text-sm transition-all"
              style={{ fontSize: '16px' }}
              maxLength={1000}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="p-2.5 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground rounded-2xl hover:shadow-md hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
          {uploading && (
            <p className="text-xs text-muted-foreground mt-2 text-center animate-pulse">Envoi de l'image...</p>
          )}
        </div>
      </div>
    );
  }

  // Conversations list
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Messages</h2>
        <button
          onClick={() => setShowNewConvo(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground rounded-xl text-sm font-semibold hover:shadow-md transition-all"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nouveau</span>
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
          <div className="w-20 h-20 rounded-3xl bg-secondary/80 flex items-center justify-center">
            <MessageCircle size={36} className="opacity-40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Aucune conversation</p>
            <p className="text-xs mt-1 opacity-70">Démarrez une conversation privée ou créez un groupe 💬</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map(convo => {
            const name = getConversationName(convo);
            const photo = getConversationPhoto(convo);
            const role = getConversationRole(convo);
            const unread = getUnreadCount(convo);

            return (
              <button
                key={convo.id}
                onClick={() => setActiveConversation(convo)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all text-left hover:bg-secondary/70 ${
                  unread > 0 ? 'bg-accent/5' : ''
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden ${
                  convo.type === 'group' ? 'bg-accent' : (ROLE_COLORS[role || ''] || 'bg-muted-foreground')
                }`}>
                  {convo.type === 'group' ? (
                    <UsersIcon size={20} />
                  ) : photo ? (
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${unread > 0 ? 'font-bold text-foreground' : 'font-semibold text-foreground'}`}>
                      {name}
                    </p>
                    {convo.lastMessageAt && (
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatTime(convo.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-xs truncate ${unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {convo.lastMessage || 'Pas encore de message'}
                    </p>
                    {unread > 0 && (
                      <span className="bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 min-w-[20px] text-center">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MessagesTab;
