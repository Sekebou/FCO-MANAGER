import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import emailjs from '@emailjs/browser';
import { db, collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, getDocs, where, setDoc, createUserWithEmailAndPassword, auth as firebaseAuth, sendPasswordResetEmail, arrayUnion, arrayRemove } from '@/lib/firebase';
import { 
  Users, TrendingUp, Bell, Calendar, LogOut, Shield, Trophy, Lock, Menu, X 
} from 'lucide-react';
import PresencesTab from '@/components/dashboard/PresencesTab';
import StatsTab from '@/components/dashboard/StatsTab';
import NewsTab from '@/components/dashboard/NewsTab';
import CalendarTab from '@/components/dashboard/CalendarTab';
import MembersTab from '@/components/dashboard/MembersTab';
import AddPlayerForm from '@/components/modals/AddPlayerForm';
import AddEventForm from '@/components/modals/AddEventForm';
import AddNewsForm from '@/components/modals/AddNewsForm';
import AddCardForm from '@/components/modals/AddCardForm';
import ChangePasswordForm from '@/components/modals/ChangePasswordForm';
import AdminResetPasswordForm from '@/components/modals/AdminResetPasswordForm';
import AvatarModal from '@/components/modals/AvatarModal';
import ConfirmModal from '@/components/modals/ConfirmModal';

export interface Player {
  id: string;
  name: string;
  position: string;
  matches?: number;
  goals?: number;
  assists?: number;
  licenseExpiry?: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  type: string;
  presences?: Record<string, string>;
  createdAt?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  likes?: string[]; // array of user UIDs
}

export interface NewsComment {
  id: string;
  newsId: string;
  authorName: string;
  authorUid: string;
  content: string;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  playerId?: string;
  photoURL?: string | null;
  createdAt: string;
  username?: string;
}

export interface Card {
  id: string;
  playerId: string;
  type: 'yellow' | 'red';
  reason: string;
  date: string;
  suspendedUntil?: string;
}

export interface AttendanceRecord {
  id: string;
  playerId: string;
  eventId: string;
  eventType: string;
  eventDate: string;
  status: string;
  savedAt: string;
}

const tabs = [
  { id: 'presences', label: 'Présences', icon: Users },
  { id: 'stats', label: 'Statistiques', icon: TrendingUp },
  { id: 'news', label: 'Actualités', icon: Bell },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'members', label: 'Membres', icon: Users },
];

const Dashboard = () => {
  const { currentUser, logout, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('presences');
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [newsComments, setNewsComments] = useState<NewsComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddNews, setShowAddNews] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [selectedPlayerForCard, setSelectedPlayerForCard] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAdminResetPassword, setShowAdminResetPassword] = useState(false);
  const [selectedMemberForReset, setSelectedMemberForReset] = useState<Member | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const canManage = () => currentUser && (currentUser.role === 'admin' || currentUser.role === 'entraineur');
  const canManageOwnPresence = (playerId: string) => {
    if (canManage()) return true;
    return currentUser && currentUser.role === 'joueur' && currentUser.playerId === playerId;
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/auth');
      return;
    }

    const unsubs: (() => void)[] = [];

    try {
      unsubs.push(onSnapshot(collection(db, 'players'), (snapshot) => {
        const data: Player[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Player));
        setPlayers(data);
      }, (err) => setError(err.message)));

      const eventsQ = query(collection(db, 'events'), orderBy('date', 'desc'));
      unsubs.push(onSnapshot(eventsQ, (snapshot) => {
        const data: Event[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Event));
        setEvents(data);
      }, (err) => setError(err.message)));

      const newsQ = query(collection(db, 'news'), orderBy('date', 'desc'));
      unsubs.push(onSnapshot(newsQ, (snapshot) => {
        const data: NewsItem[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as NewsItem));
        setNews(data);
      }, (err) => setError(err.message)));

      const membersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      unsubs.push(onSnapshot(membersQ, (snapshot) => {
        const data: Member[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Member));
        setMembers(data);
      }, (err) => setError(err.message)));

      const cardsQ = query(collection(db, 'cards'), orderBy('date', 'desc'));
      unsubs.push(onSnapshot(cardsQ, (snapshot) => {
        const data: Card[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Card));
        setCards(data);
      }, (err) => setError(err.message)));

      unsubs.push(onSnapshot(collection(db, 'attendance_records'), (snapshot) => {
        const data: AttendanceRecord[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as AttendanceRecord));
        setAttendanceRecords(data);
      }, (err) => setError(err.message)));

      const commentsQ = query(collection(db, 'news_comments'), orderBy('createdAt', 'asc'));
      unsubs.push(onSnapshot(commentsQ, (snapshot) => {
        const data: NewsComment[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as NewsComment));
        setNewsComments(data);
      }, (err) => setError(err.message)));

      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }

    return () => unsubs.forEach(u => u());
  }, [currentUser, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  // CRUD functions
  const togglePresence = async (eventId: string, playerId: string, status: string) => {
    if (!canManageOwnPresence(playerId)) {
      alert('Vous ne pouvez gérer que votre propre présence');
      return;
    }
    try {
      const event = events.find(e => e.id === eventId);
      const updatedPresences = { ...(event?.presences || {}), [playerId]: status };
      await updateDoc(doc(db, 'events', eventId), { presences: updatedPresences });
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const addPlayer = async (playerData: any) => {
    if (!canManage()) return;
    try {
      const playerRef = await addDoc(collection(db, 'players'), {
        name: playerData.name,
        position: playerData.position,
        matches: 0,
        goals: 0,
        assists: 0,
        licenseExpiry: playerData.licenseExpiry || null,
        createdAt: new Date().toISOString(),
      });

      if (playerData.createAccount && playerData.email && playerData.password) {
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, playerData.email, playerData.password);
        const user = userCredential.user;
        const username = playerData.email.split('@')[0];
        await setDoc(doc(db, 'users', user.uid), {
          email: playerData.email,
          username,
          role: 'joueur',
          name: playerData.name,
          playerId: playerRef.id,
          createdAt: new Date().toISOString(),
        });
        alert(`✅ Joueur et compte créés !\nEmail: ${playerData.email}\nMot de passe: ${playerData.password}`);
      } else {
        alert('✅ Joueur créé !');
      }
      setShowAddPlayer(false);
    } catch (err: any) {
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') msg = 'Ce nom d\'utilisateur existe déjà.';
      alert('❌ Erreur: ' + msg);
    }
  };

  const deletePlayer = async (playerId: string) => {
    if (!canManage()) return;
    setConfirmModal({
      title: 'Supprimer ce joueur ?',
      message: 'Cette action est irréversible. Le joueur et son compte associé seront supprimés.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'players', playerId));
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('playerId', '==', playerId));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            await deleteDoc(doc(db, 'users', snapshot.docs[0].id));
          }
        } catch (err: any) {
          alert('Erreur: ' + err.message);
        }
      }
    });
  };

  const addEvent = async (eventData: any) => {
    if (!canManage()) return;
    try {
      const sendEmail = eventData.sendNotification;
      delete eventData.sendNotification;
      await addDoc(collection(db, 'events'), {
        ...eventData,
        presences: {},
        createdAt: new Date().toISOString(),
      });

      // Envoyer les notifications par email via EmailJS
      if (sendEmail) {
        const memberEmails = members.filter(m => m.role === 'joueur').map(m => m.email);
        const typeLabel = eventData.type === 'match' ? 'Match' : eventData.type === 'training' ? 'Entraînement' : 'Événement';
        const dateFormatted = new Date(eventData.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        for (const email of memberEmails) {
          try {
            await emailjs.send('service_7wmhc61', 'template_m28qlzo', {
              to_email: email,
              event_title: eventData.title,
              event_type: typeLabel,
              event_date: dateFormatted,
            }, 'YAIU3poHgOd6cG6PI');
          } catch (emailErr) {
            console.error('Erreur envoi email à', email, emailErr);
          }
        }
        alert(`✅ Événement créé et ${memberEmails.length} notification(s) envoyée(s)`);
      } else {
        alert('✅ Événement créé');
      }

      setShowAddEvent(false);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const deleteEvent = async (eventId: string) => {
    setConfirmModal({
      title: 'Supprimer cet événement ?',
      message: 'Les données de présence seront archivées avant la suppression.',
      onConfirm: async () => {
        try {
          const event = events.find(e => e.id === eventId);
          if (event && event.presences) {
            for (const [playerId, status] of Object.entries(event.presences)) {
              if (status === 'present' || status === 'absent') {
                await addDoc(collection(db, 'attendance_records'), {
                  playerId,
                  eventId,
                  eventType: event.type,
                  eventDate: event.date,
                  status,
                  savedAt: new Date().toISOString(),
                });
              }
            }
          }
          await deleteDoc(doc(db, 'events', eventId));
        } catch (err: any) {
          alert('Erreur: ' + err.message);
        }
      }
    });
  };

  const addNews = async (newsData: any) => {
    if (!canManage()) return;
    try {
      await addDoc(collection(db, 'news'), {
        ...newsData,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      });
      setShowAddNews(false);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const deleteNews = async (newsId: string) => {
    setConfirmModal({
      title: 'Supprimer cette actualité ?',
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'news', newsId));
        } catch (err: any) {
          alert('Erreur: ' + err.message);
        }
      }
    });
  };

  const toggleLike = async (newsId: string) => {
    if (!currentUser) return;
    try {
      const newsRef = doc(db, 'news', newsId);
      const newsItem = news.find(n => n.id === newsId);
      if (!newsItem) return;
      const likes = newsItem.likes || [];
      const isLiked = likes.includes(currentUser.uid);
      await updateDoc(newsRef, {
        likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
      });
    } catch (err: any) {
      console.error('Error toggling like:', err);
    }
  };

  const addComment = async (newsId: string, content: string) => {
    if (!currentUser || !content.trim()) return;
    try {
      await addDoc(collection(db, 'news_comments'), {
        newsId,
        authorName: currentUser.name,
        authorUid: currentUser.uid,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Error adding comment:', err);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'news_comments', commentId));
    } catch (err: any) {
      console.error('Error deleting comment:', err);
    }
  };

  const addCard = async (cardData: any) => {
    if (currentUser?.role !== 'admin') return;
    try {
      await addDoc(collection(db, 'cards'), {
        ...cardData,
        createdAt: new Date().toISOString(),
      });
      setShowAddCard(false);
      setSelectedPlayerForCard(null);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const deleteCard = async (cardId: string) => {
    if (currentUser?.role !== 'admin') return;
    setConfirmModal({
      title: 'Supprimer ce carton ?',
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'cards', cardId));
        } catch (err: any) {
          alert('Erreur: ' + err.message);
        }
      }
    });
  };

  const updatePlayerStats = async (playerId: string, field: string, value: string) => {
    if (!canManage()) return;
    try {
      await updateDoc(doc(db, 'players', playerId), { [field]: parseInt(value) || 0 });
    } catch (err: any) {
      console.error('Error updating stats:', err);
    }
  };

  const getPlayerCards = (playerId: string) => cards.filter(c => c.playerId === playerId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">Chargement...</p>
          <p className="text-sm text-muted-foreground mt-1">Connexion à Firebase</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-lg p-8 max-w-md border border-border">
          <div className="text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-destructive mb-3">Erreur de connexion</h2>
            <p className="text-muted-foreground mb-4 text-sm">{error}</p>
            <button onClick={() => window.location.reload()} className="bg-accent text-accent-foreground px-6 py-2.5 rounded-xl font-medium hover:bg-accent/90 transition-all">
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/50">
      {/* Header */}
      <header className="bg-primary border-b border-primary/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-primary-foreground">
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-lg">⚽</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-primary-foreground leading-tight">FCO Manager</h1>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Profile group */}
              <button
                onClick={() => setShowAvatarModal(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-all group"
              >
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center overflow-hidden ring-2 ring-white/20 group-hover:ring-accent transition-all">
                    {currentUser?.photoURL ? (
                      <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-primary-foreground">
                        {currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-primary" />
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-primary-foreground leading-tight">{currentUser?.name}</div>
                  <div className="text-[10px] font-medium text-primary-foreground/50 uppercase tracking-wider">
                    {currentUser?.role === 'admin' ? 'Administrateur' : currentUser?.role === 'entraineur' ? 'Entraîneur' : 'Joueur'}
                  </div>
                </div>
              </button>

              {/* Actions */}
              <button onClick={() => setShowChangePassword(true)} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-all" title="Changer mot de passe">
                <Lock size={16} />
              </button>
              <button onClick={handleLogout} className="w-8 h-8 rounded-lg hover:bg-destructive/20 flex items-center justify-center text-primary-foreground/50 hover:text-destructive transition-all" title="Déconnexion">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-card border-b border-border sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className={`${mobileMenuOpen ? 'flex flex-col' : 'hidden'} md:flex md:flex-row overflow-x-auto`}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-2 px-5 py-3.5 border-b-2 transition-all whitespace-nowrap text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div key={activeTab} className="animate-fade-in">
          {activeTab === 'presences' && (
            <PresencesTab
              events={events}
              players={players}
              canManage={canManage}
              canManageOwnPresence={canManageOwnPresence}
              togglePresence={togglePresence}
              deleteEvent={deleteEvent}
              onAddPlayer={() => setShowAddPlayer(true)}
              onAddEvent={() => setShowAddEvent(true)}
            />
          )}
          {activeTab === 'stats' && (
            <StatsTab
              players={players}
              events={events}
              cards={cards}
              attendanceRecords={attendanceRecords}
              currentUser={currentUser}
              canManage={canManage}
              updatePlayerStats={updatePlayerStats}
              deletePlayer={deletePlayer}
              getPlayerCards={getPlayerCards}
              deleteCard={deleteCard}
              onAddPlayer={() => setShowAddPlayer(true)}
              onAddCard={(playerId) => { setSelectedPlayerForCard(playerId); setShowAddCard(true); }}
            />
          )}
          {activeTab === 'news' && (
            <NewsTab
              news={news}
              comments={newsComments}
              currentUser={currentUser}
              canManage={canManage}
              deleteNews={deleteNews}
              toggleLike={toggleLike}
              addComment={addComment}
              deleteComment={deleteComment}
              onAddNews={() => setShowAddNews(true)}
            />
          )}
          {activeTab === 'calendar' && <CalendarTab events={events} />}
          {activeTab === 'members' && (
            <MembersTab
              members={members}
              players={players}
              cards={cards}
              currentUser={currentUser}
              getPlayerCards={getPlayerCards}
              onResetPassword={(member) => { setSelectedMemberForReset(member); setShowAdminResetPassword(true); }}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-8 p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          <span>Connecté au serveur — Données synchronisées en temps réel</span>
        </div>
      </footer>

      {/* Modals */}
      {showAddPlayer && <AddPlayerForm onSubmit={addPlayer} onClose={() => setShowAddPlayer(false)} />}
      {showAddEvent && <AddEventForm onSubmit={addEvent} onClose={() => setShowAddEvent(false)} />}
      {showAddNews && <AddNewsForm onSubmit={addNews} onClose={() => setShowAddNews(false)} />}
      {showAddCard && <AddCardForm players={players} selectedPlayerId={selectedPlayerForCard} onSubmit={addCard} onClose={() => { setShowAddCard(false); setSelectedPlayerForCard(null); }} />}
      {showChangePassword && <ChangePasswordForm onClose={() => setShowChangePassword(false)} />}
      {showAdminResetPassword && selectedMemberForReset && (
        <AdminResetPasswordForm member={selectedMemberForReset} onClose={() => { setShowAdminResetPassword(false); setSelectedMemberForReset(null); }} />
      )}
      {showAvatarModal && currentUser && (
        <AvatarModal
          currentUser={currentUser}
          onClose={() => setShowAvatarModal(false)}
          onAvatarUpdated={(photoURL) => {
            setCurrentUser({ ...currentUser, photoURL });
          }}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
