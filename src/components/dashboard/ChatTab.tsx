import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Smile } from 'lucide-react';
import { db, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, firestoreLimit } from '@/lib/firebase';
import type { AppUser } from '@/contexts/AuthContext';

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
  'admin+': 'text-red-500',
  'admin': 'text-orange-500',
  'entraineur': 'text-accent',
  'joueur': 'text-emerald-500',
  'photographe': 'text-purple-500',
  'dirigeant': 'text-amber-600',
};

const ChatTab: React.FC<Props> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUser || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'chat_messages'), {
        text: newMessage.trim(),
        userId: currentUser.uid,
        userName: currentUser.name,
        userRole: currentUser.role,
        userPhoto: currentUser.photoURL || null,
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isOwnMessage = (msg: ChatMessage) => msg.userId === currentUser?.uid;

  // Group consecutive messages from the same user
  const isConsecutive = (idx: number) => {
    if (idx === 0) return false;
    const prev = messages[idx - 1];
    const curr = messages[idx];
    if (prev.userId !== curr.userId) return false;
    if (!prev.createdAt?.toDate || !curr.createdAt?.toDate) return false;
    const diff = curr.createdAt.toDate().getTime() - prev.createdAt.toDate().getTime();
    return diff < 120000; // 2 min
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-h-[700px]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border mb-0">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <MessageCircle size={20} className="text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Discussion</h2>
          <p className="text-sm text-muted-foreground">{messages.length} message(s)</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <MessageCircle size={48} className="opacity-30" />
            <p className="text-sm">Aucun message. Lancez la conversation !</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const own = isOwnMessage(msg);
          const consecutive = isConsecutive(idx);
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${own ? 'flex-row-reverse' : ''} ${consecutive ? 'mt-0.5' : 'mt-3'}`}
            >
              {/* Avatar */}
              {!own && !consecutive ? (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 overflow-hidden">
                  {msg.userPhoto ? (
                    <img src={msg.userPhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(msg.userName)
                  )}
                </div>
              ) : !own ? (
                <div className="w-8 shrink-0" />
              ) : null}

              {/* Bubble */}
              <div className={`max-w-[75%] ${own ? 'items-end' : 'items-start'} flex flex-col`}>
                {!consecutive && !own && (
                  <span className={`text-xs font-semibold mb-0.5 ml-1 ${ROLE_COLORS[msg.userRole] || 'text-muted-foreground'}`}>
                    {msg.userName}
                  </span>
                )}
                <div
                  className={`px-3.5 py-2 text-sm leading-relaxed break-words ${
                    own
                      ? 'bg-accent text-accent-foreground rounded-2xl rounded-br-md'
                      : 'bg-secondary text-foreground rounded-2xl rounded-bl-md'
                  }`}
                >
                  {msg.text}
                </div>
                {!consecutive && (
                  <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                    {formatTime(msg.createdAt)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      {currentUser ? (
        <div className="border-t border-border pt-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez un message..."
            className="flex-1 px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all"
            maxLength={1000}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-accent text-accent-foreground rounded-xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
      ) : (
        <div className="border-t border-border pt-3 text-center text-sm text-muted-foreground">
          Connectez-vous pour envoyer des messages
        </div>
      )}
    </div>
  );
};

export default ChatTab;
