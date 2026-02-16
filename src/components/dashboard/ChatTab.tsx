import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Trash2, AlertTriangle } from 'lucide-react';
import { db, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, firestoreLimit, deleteDoc, doc, getDocs } from '@/lib/firebase';
import type { AppUser } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userRole: string;
  userPhoto?: string | null;
  createdAt: any;
}

interface Props {
  currentUser: AppUser | null;
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

const ChatTab: React.FC<Props> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'admin+';

  useEffect(() => {
    const q = query(
      collection(db, 'chat_messages'),
      orderBy('createdAt', 'asc'),
      firestoreLimit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ChatMessage));
      setMessages(msgs);
    }, (error) => {
      console.warn('Chat listener error:', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUser || sending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      await addDoc(collection(db, 'chat_messages'), {
        text,
        userId: currentUser.uid,
        userName: currentUser.name,
        userRole: currentUser.role,
        userPhoto: currentUser.photoURL || null,
        createdAt: serverTimestamp(),
      });
      inputRef.current?.focus();
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await deleteDoc(doc(db, 'chat_messages', msgId));
    } catch (err) {
      console.error('Error deleting message:', err);
      toast.error('Impossible de supprimer ce message');
    }
  };

  const handleResetChat = async () => {
    if (!isAdmin) return;
    setResetting(true);
    try {
      const snapshot = await getDocs(collection(db, 'chat_messages'));
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'chat_messages', d.id)));
      await Promise.all(deletePromises);
      toast.success(`${snapshot.docs.length} message(s) supprimé(s)`);
      setShowResetConfirm(false);
    } catch (err) {
      console.error('Error resetting chat:', err);
      toast.error('Erreur lors de la suppression');
    } finally {
      setResetting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
    if (isYesterday) return `Hier ${time}`;
    return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${time}`;
  };

  const formatDateSeparator = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isToday) return "Aujourd'hui";
    if (isYesterday) return 'Hier';
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isOwnMessage = (msg: ChatMessage) => msg.userId === currentUser?.uid;

  const isConsecutive = (idx: number) => {
    if (idx === 0) return false;
    const prev = messages[idx - 1];
    const curr = messages[idx];
    if (prev.userId !== curr.userId) return false;
    if (!prev.createdAt?.toDate || !curr.createdAt?.toDate) return false;
    const diff = curr.createdAt.toDate().getTime() - prev.createdAt.toDate().getTime();
    return diff < 120000;
  };

  const isDifferentDay = (idx: number) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    const curr = messages[idx];
    if (!prev.createdAt?.toDate || !curr.createdAt?.toDate) return false;
    return prev.createdAt.toDate().toDateString() !== curr.createdAt.toDate().toDateString();
  };

  const recentUsers = new Set(
    messages
      .filter(m => m.createdAt?.toDate && (Date.now() - m.createdAt.toDate().getTime()) < 300000)
      .map(m => m.userId)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Admin reset button - compact inline */}
      {isAdmin && messages.length > 0 && (
        <div className="flex items-center justify-end px-3 py-1.5 border-b border-border">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-all"
            title="Supprimer tous les messages"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}

      {/* Reset confirmation modal */}
      {showResetConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl">
          <div className="bg-card border border-border rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-destructive" />
              </div>
              <h3 className="text-base font-bold text-foreground">Vider la discussion ?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Tous les messages ({messages.length}) seront définitivement supprimés. Cette action est irréversible.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="flex-1 px-4 py-2.5 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleResetChat}
                disabled={resetting}
                className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm disabled:opacity-50"
              >
                {resetting ? 'Suppression...' : 'Tout supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 relative" style={{ scrollbarWidth: 'thin' }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4 py-12">
            <div className="w-20 h-20 rounded-3xl bg-secondary/80 flex items-center justify-center">
              <MessageCircle size={36} className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Aucun message pour l'instant</p>
              <p className="text-xs mt-1 opacity-70">Soyez le premier à lancer la conversation ! 💬</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const own = isOwnMessage(msg);
          const consecutive = isConsecutive(idx);
          const showDateSep = isDifferentDay(idx);
          const canDelete = own || isAdmin;

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
                {/* Avatar */}
                {!own && !consecutive ? (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 overflow-hidden shadow-sm ${ROLE_COLORS[msg.userRole] || 'bg-muted-foreground'}`}>
                    {msg.userPhoto ? (
                      <img src={msg.userPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(msg.userName)
                    )}
                  </div>
                ) : !own ? (
                  <div className="w-9 shrink-0" />
                ) : null}

                {/* Bubble */}
                <div className={`max-w-[78%] flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                  {!consecutive && !own && (
                    <div className="flex items-center gap-1.5 mb-1 ml-1">
                      <span className={`text-xs font-bold ${ROLE_TEXT_COLORS[msg.userRole] || 'text-muted-foreground'}`}>
                        {msg.userName}
                      </span>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${ROLE_COLORS[msg.userRole] || 'bg-muted-foreground'} text-white opacity-80`}>
                        {ROLE_LABELS[msg.userRole] || msg.userRole}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {own && canDelete && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <div
                      className={`px-4 py-2.5 text-sm leading-relaxed break-words shadow-sm ${
                        own
                          ? 'bg-gradient-to-br from-accent to-accent/90 text-accent-foreground rounded-2xl rounded-br-lg'
                          : 'bg-secondary text-foreground rounded-2xl rounded-bl-lg border border-border/50'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {!own && canDelete && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  {!consecutive && (
                    <span className={`text-[10px] text-muted-foreground/70 mt-1 ${own ? 'mr-1' : 'ml-1'}`}>
                      {formatTime(msg.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      {currentUser ? (
        <div className="border-t border-border px-4 py-3 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden ${ROLE_COLORS[currentUser.role] || 'bg-muted-foreground'}`}>
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(currentUser.name)
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrivez un message..."
              className="flex-1 px-4 py-2.5 bg-secondary border border-border rounded-2xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 text-sm transition-all"
              maxLength={1000}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="p-2.5 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground rounded-2xl hover:shadow-md hover:scale-105 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-4 text-center text-sm text-muted-foreground bg-secondary/50">
          🔒 Connectez-vous pour participer à la discussion
        </div>
      )}
    </div>
  );
};

export default ChatTab;
