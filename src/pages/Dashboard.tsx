import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import emailjs from '@emailjs/browser';
import { db, collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, getDocs, where, setDoc, auth as firebaseAuth, sendPasswordResetEmail, arrayUnion, arrayRemove, createUserWithoutSignIn, EmailAuthProvider, reauthenticateWithCredential } from '@/lib/firebase';
import { 
  Users, TrendingUp, Bell, Calendar, CalendarDays, LogOut, Shield, Trophy, Lock, Menu, X, CheckCircle2, Mail, KeyRound, UserCheck, Copy, Camera, Dumbbell, UserCircle, Briefcase
} from 'lucide-react';
import clubLogo from '@/assets/logo.svg';
import { toast } from 'sonner';
import PresencesTab from '@/components/dashboard/PresencesTab';
import StatsTab from '@/components/dashboard/StatsTab';
import NewsTab from '@/components/dashboard/NewsTab';
import CalendarTab from '@/components/dashboard/CalendarTab';
import MembersTab from '@/components/dashboard/MembersTab';
import ChampionnatTab, { type Championship, type Match } from '@/components/dashboard/ChampionnatTab';
import GalleryTab, { type Album, type Photo } from '@/components/dashboard/GalleryTab';
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

export interface Convocation {
  status: 'convoque' | 'non_convoque';
  position?: string;
  number?: number;
}

export const POSITIONS = [
  'Gardien',
  'Défenseur central',
  'Latéral droit',
  'Latéral gauche',
  'Milieu défensif',
  'Milieu central',
  'Milieu offensif',
  'Ailier droit',
  'Ailier gauche',
  'Attaquant',
] as const;

export interface Event {
  id: string;
  title: string;
  date: string;
  type: string;
  team?: string;
  presences?: Record<string, string>;
  convocations?: Record<string, Convocation>;
  convocationsPublished?: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId?: string;
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
  { id: 'championnat', label: 'Championnat', icon: Trophy },
  { id: 'news', label: 'Actualités', icon: Bell },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'gallery', label: 'Galerie', icon: Camera },
  { id: 'members', label: 'Membres', icon: Users },
];

const Dashboard = () => {
  const { currentUser, logout, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('fco-active-tab') || 'presences');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem('fco-active-tab', tab);
  };
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [newsComments, setNewsComments] = useState<NewsComment[]>([]);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [champMatches, setChampMatches] = useState<Match[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([]);
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
  const [playerCreatedResult, setPlayerCreatedResult] = useState<{ name: string; email?: string; password?: string; withAccount: boolean } | null>(null);
  const [eventCreatedResult, setEventCreatedResult] = useState<{ title: string; date: string; type: string; notified: boolean; notifCount: number } | null>(null);

  const canManage = () => currentUser && (currentUser.role === 'admin+' || currentUser.role === 'admin' || currentUser.role === 'entraineur');
  const canManagePhotos = () => !!(currentUser && (currentUser.role === 'admin+' || currentUser.role === 'admin' || currentUser.role === 'photographe'));
  const canManageOwnPresence = (playerId: string) => {
    if (canManage()) return true;
    return currentUser && (currentUser.role === 'joueur' || currentUser.role === 'dirigeant') && currentUser.playerId === playerId;
  };
  // Dirigeant can create news and training events
  const canCreateNews = () => currentUser && (canManage() || currentUser.role === 'dirigeant');
  const canCreateEvent = () => currentUser && (canManage() || currentUser.role === 'dirigeant');

  // Filter out players linked to admin+ and dirigeant accounts (ghost mode for stats)
  const adminPlusPlayerIds = members.filter(m => m.role === 'admin+' && m.playerId).map(m => m.playerId);
  const dirigeantPlayerIds = members.filter(m => m.role === 'dirigeant' && m.playerId).map(m => m.playerId);
  const visiblePlayers = players.filter(p => !adminPlusPlayerIds.includes(p.id));
  const visiblePlayersForStats = players.filter(p => !adminPlusPlayerIds.includes(p.id) && !dirigeantPlayerIds.includes(p.id));
  const visibleMembers = members.filter(m => m.role !== 'admin+');

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

      unsubs.push(onSnapshot(collection(db, 'championships'), (snapshot) => {
        const data: Championship[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Championship));
        setChampionships(data);
      }, (err) => setError(err.message)));

      unsubs.push(onSnapshot(collection(db, 'championship_matches'), (snapshot) => {
        const data: Match[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Match));
        setChampMatches(data);
      }, (err) => setError(err.message)));

      const albumsQ = query(collection(db, 'albums'), orderBy('createdAt', 'desc'));
      unsubs.push(onSnapshot(albumsQ, (snapshot) => {
        const data: Album[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Album));
        setAlbums(data);
      }, (err) => console.warn('Albums permission error:', err.message)));

      unsubs.push(onSnapshot(collection(db, 'gallery_photos'), (snapshot) => {
        const data: Photo[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Photo));
        setGalleryPhotos(data);
      }, (err) => console.warn('Gallery photos permission error:', err.message)));

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
      toast.warning('Vous ne pouvez gérer que votre propre présence');
      return;
    }
    try {
      const event = events.find(e => e.id === eventId);
      const currentPresences = { ...(event?.presences || {}) };
      // If already this status, remove it (deselect)
      if (currentPresences[playerId] === status) {
        delete currentPresences[playerId];
      } else {
        currentPresences[playerId] = status;
      }
      await updateDoc(doc(db, 'events', eventId), { presences: currentPresences });
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const addPlayer = async (playerData: any) => {
    if (!canManage()) return;

    // Coaches can only create joueur accounts
    if (currentUser?.role === 'entraineur') {
      playerData.role = 'joueur';
    }
    // Only admin+ can create admin accounts
    if (playerData.role === 'admin' && currentUser?.role !== 'admin+') {
      // admin can still create admin via the form, keep existing behavior
    }
    // Nobody except admin+ can assign admin+ role
    if (playerData.role === 'admin+' && currentUser?.role !== 'admin+') {
      toast.error("Seul l'Admin+ peut attribuer ce rôle");
      return;
    }

    try {
      // Create auth account FIRST — if it fails, no player is created
      let userCredential: any = null;
      if (playerData.createAccount && playerData.email && playerData.password) {
        userCredential = await createUserWithoutSignIn(playerData.email, playerData.password);
      }

      // For photographe, don't create a player document (dirigeant gets one for attendance)
      const isNonPlayer = playerData.role === 'photographe';
      let playerRefId: string | undefined;

      if (!isNonPlayer) {
        const playerRef = await addDoc(collection(db, 'players'), {
          name: playerData.name,
          position: playerData.position,
          matches: 0,
          goals: 0,
          assists: 0,
          licenseExpiry: playerData.licenseExpiry || null,
          team: playerData.team || null,
          createdAt: new Date().toISOString(),
        });
        playerRefId = playerRef.id;
      }

      if (userCredential) {
        const user = userCredential.user;
        const username = playerData.email.split('@')[0];
        const userData: any = {
          email: playerData.email,
          username,
          role: playerData.role || 'joueur',
          name: playerData.name,
          team: playerData.team || null,
          createdAt: new Date().toISOString(),
        };
        if (playerRefId) userData.playerId = playerRefId;
        await setDoc(doc(db, 'users', user.uid), userData);
        setPlayerCreatedResult({ name: playerData.name, email: playerData.email, password: playerData.password, withAccount: true });
      } else {
        setPlayerCreatedResult({ name: playerData.name, withAccount: false });
      }
      setShowAddPlayer(false);
    } catch (err: any) {
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') msg = 'Ce nom d\'utilisateur existe déjà.';
      toast.error(msg);
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
          toast.error('Erreur: ' + err.message);
        }
      }
    });
  };

  const deleteMember = async (memberId: string, playerId?: string) => {
    if (!canManage()) return;
    
    // Find the target member
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember) return;

    // Nobody can delete an admin+
    if (targetMember.role === 'admin+') {
      toast.error("Le compte Admin+ ne peut pas être supprimé");
      return;
    }

    // Only admin+ can delete admin accounts
    if (targetMember.role === 'admin' && currentUser?.role !== 'admin+') {
      toast.error("Seul l'Admin+ peut supprimer un compte Administrateur");
      return;
    }

    setConfirmModal({
      title: 'Supprimer ce membre ?',
      message: 'Cette action est irréversible. Le membre et ses données associées seront supprimés.',
      onConfirm: async () => {
        try {
          if (playerId) {
            await deleteDoc(doc(db, 'players', playerId));
          }
          await deleteDoc(doc(db, 'users', memberId));
        } catch (err: any) {
          toast.error('Erreur: ' + err.message);
        }
      }
    });
  };

  const addEvent = async (eventData: any) => {
    if (!canCreateEvent()) return;
    // Dirigeant can only create training events
    if (currentUser?.role === 'dirigeant' && eventData.type === 'match') {
      toast.error("Les dirigeants ne peuvent créer que des entraînements");
      return;
    }
    try {
      const sendEmail = eventData.sendNotification;
      delete eventData.sendNotification;
      
      const eventToSave: any = {
        ...eventData,
        presences: {},
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.name || '',
        createdAt: new Date().toISOString(),
      };
      
      await addDoc(collection(db, 'events'), eventToSave);

      // Envoyer les notifications par email via EmailJS
      if (sendEmail) {
        const targetMembers = members.filter(m => m.role === 'joueur');
        const memberEmails = targetMembers.map(m => m.email);
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
        setEventCreatedResult({ title: eventData.title, date: eventData.date, type: eventData.type, notified: true, notifCount: memberEmails.length });
      } else {
        setEventCreatedResult({ title: eventData.title, date: eventData.date, type: eventData.type, notified: false, notifCount: 0 });
      }

      setShowAddEvent(false);
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const canDeleteEvent = (event: Event) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin+' || currentUser.role === 'admin') return true;
    if (currentUser.role === 'entraineur') return event.createdBy === currentUser.uid;
    if (currentUser.role === 'dirigeant') return event.createdBy === currentUser.uid;
    return false;
  };

  const deleteEvent = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event && !canDeleteEvent(event)) {
      toast.warning('Vous ne pouvez supprimer que les événements que vous avez créés');
      return;
    }
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
          toast.error('Erreur: ' + err.message);
        }
      }
    });
  };

  const addNews = async (newsData: any) => {
    if (!canCreateNews()) return;
    try {
      await addDoc(collection(db, 'news'), {
        ...newsData,
        author: currentUser?.name || '',
        authorId: currentUser?.uid || '',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      });
      setShowAddNews(false);
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
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
          toast.error('Erreur: ' + err.message);
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
    if (!canManage()) return;
    try {
      await addDoc(collection(db, 'cards'), {
        ...cardData,
        createdAt: new Date().toISOString(),
      });
      setShowAddCard(false);
      setSelectedPlayerForCard(null);
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const deleteCard = async (cardId: string) => {
    if (!canManage()) return;
    setConfirmModal({
      title: 'Supprimer ce carton ?',
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'cards', cardId));
        } catch (err: any) {
          toast.error('Erreur: ' + err.message);
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

  // Championship CRUD
  const addChampionship = async (data: { name: string; season: string; teams: string[]; fffUrl?: string; matches?: Array<{ homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null; date: string; journee: number; played: boolean }>; standings?: Array<any>; teamLogos?: Record<string, string> }) => {
    if (!canManage()) return;
    try {
      const { matches: importedMatches, standings: importedStandings, teamLogos: importedLogos, ...champData } = data;
      const champRef = await addDoc(collection(db, 'championships'), { ...champData, fffStandings: importedStandings || [], teamLogos: importedLogos || {}, createdAt: new Date().toISOString() });
      
      if (importedMatches && importedMatches.length > 0) {
        for (const m of importedMatches) {
          await addDoc(collection(db, 'championship_matches'), {
            championshipId: champRef.id,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            date: m.date,
            journee: m.journee,
            played: m.played,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
  };

  const canUpdateChampionnat = () => currentUser && (currentUser.role === 'admin' || currentUser.role === 'admin+' || currentUser.role === 'entraineur' || currentUser.role === 'joueur');

  const refreshFromFFF = async (championshipId: string, fffUrl: string): Promise<{ success: boolean; updated: number; added: number; standingsCount: number; error?: string }> => {
    if (!canUpdateChampionnat()) return { success: false, updated: 0, added: 0, standingsCount: 0, error: 'Non autorisé' };
    try {
      const { scrapeFFFTeams } = await import('@/lib/api/scrape-fff');
      const result = await scrapeFFFTeams(fffUrl);
      if (!result.success || !result.matches) {
        return { success: false, updated: 0, added: 0, standingsCount: 0, error: result.error || 'Impossible de récupérer les données' };
      }

      const updateData: Record<string, any> = {};
      if (result.standings && result.standings.length > 0) {
        updateData.fffStandings = result.standings;
      }
      if (result.teamLogos && Object.keys(result.teamLogos).length > 0) {
        updateData.teamLogos = result.teamLogos;
      }
      if (Object.keys(updateData).length > 0) {
        await updateDoc(doc(db, 'championships', championshipId), updateData);
      }

      const existingMatches = champMatches.filter(m => m.championshipId === championshipId);
      let updated = 0;
      let added = 0;

      for (const scraped of result.matches) {
        const existing = existingMatches.find(m =>
          m.homeTeam.toUpperCase() === scraped.homeTeam.toUpperCase() &&
          m.awayTeam.toUpperCase() === scraped.awayTeam.toUpperCase() &&
          m.date === scraped.date
        );

        if (existing) {
          if (scraped.played && !existing.played && scraped.homeScore !== null && scraped.awayScore !== null) {
            await updateDoc(doc(db, 'championship_matches', existing.id), {
              homeScore: scraped.homeScore,
              awayScore: scraped.awayScore,
              played: true,
            });
            updated++;
          }
        } else {
          await addDoc(collection(db, 'championship_matches'), {
            championshipId,
            homeTeam: scraped.homeTeam,
            awayTeam: scraped.awayTeam,
            homeScore: scraped.homeScore,
            awayScore: scraped.awayScore,
            date: scraped.date,
            journee: scraped.journee,
            played: scraped.played,
            createdAt: new Date().toISOString(),
          });
          added++;
        }
      }

      const standingsCount = result.standings?.length || 0;
      return { success: true, updated, added, standingsCount };
    } catch (err: any) { return { success: false, updated: 0, added: 0, standingsCount: 0, error: err.message }; }
  };

  const deleteChampionship = async (id: string) => {
    if (!canManage()) return;
    setConfirmModal({
      title: 'Supprimer ce championnat ?',
      message: 'Tous les matchs associés seront également supprimés.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'championships', id));
          const q = query(collection(db, 'championship_matches'), where('championshipId', '==', id));
          const snapshot = await getDocs(q);
          for (const d of snapshot.docs) { await deleteDoc(doc(db, 'championship_matches', d.id)); }
        } catch (err: any) { toast.error('Erreur: ' + err.message); }
      }
    });
  };

  const addChampMatch = async (data: Omit<Match, 'id'>) => {
    if (!canManage()) return;
    try {
      await addDoc(collection(db, 'championship_matches'), { ...data, createdAt: new Date().toISOString() });
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
  };

  const updateMatchScore = async (matchId: string, homeScore: number, awayScore: number) => {
    if (!canUpdateChampionnat()) return;
    try {
      await updateDoc(doc(db, 'championship_matches', matchId), { homeScore, awayScore, played: true });
    } catch (err: any) {
      if (err.code === 'permission-denied' || err.message?.includes('Missing or insufficient permissions')) {
        toast.error('Permissions insuffisantes pour modifier les scores. Vérifiez les règles Firestore pour le rôle "' + (currentUser?.role || 'inconnu') + '".');
      } else {
        toast.error('Erreur: ' + err.message);
      }
    }
  };

  const deleteChampMatch = async (id: string) => {
    if (!canManage()) return;
    setConfirmModal({
      title: 'Supprimer ce match ?',
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try { await deleteDoc(doc(db, 'championship_matches', id)); }
        catch (err: any) { toast.error('Erreur: ' + err.message); }
      }
    });
  };

  // Gallery CRUD
  const createAlbum = async (data: { name: string; description?: string }) => {
    if (!canManagePhotos()) return;
    await addDoc(collection(db, 'albums'), {
      ...data,
      createdBy: currentUser!.uid,
      createdAt: new Date().toISOString(),
    });
  };

  const deleteAlbum = (albumId: string) => {
    if (!canManagePhotos()) return;
    setConfirmModal({
      title: 'Supprimer cet album ?',
      message: 'Toutes les photos de cet album seront supprimées.',
      onConfirm: async () => {
        try {
          // Delete all photos in album
          const albumPhotos = galleryPhotos.filter(p => p.albumId === albumId);
          for (const photo of albumPhotos) {
            try {
              await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-photos`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                body: JSON.stringify({ path: photo.storagePath }),
              });
            } catch {}
            await deleteDoc(doc(db, 'gallery_photos', photo.id));
          }
          await deleteDoc(doc(db, 'albums', albumId));
          toast.success('Album supprimé');
        } catch (err: any) {
          toast.error('Erreur: ' + err.message);
        }
      }
    });
  };

  const uploadPhotos = async (albumId: string, files: File[]) => {
    if (!canManagePhotos()) return;
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('albumId', albumId);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      const { url, path } = await res.json();
      await addDoc(collection(db, 'gallery_photos'), {
        albumId,
        url,
        storagePath: path,
        title: file.name.replace(/\.[^/.]+$/, ''),
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser!.uid,
        uploaderName: currentUser!.name,
      });
    }
  };

  const deletePhoto = (photo: { id: string; storagePath: string }) => {
    if (!canManagePhotos()) return;
    setConfirmModal({
      title: 'Supprimer cette photo ?',
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-photos`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ path: photo.storagePath }),
          });
          await deleteDoc(doc(db, 'gallery_photos', photo.id));
          toast.success('Photo supprimée');
        } catch (err: any) {
          toast.error('Erreur: ' + err.message);
        }
      }
    });
  };

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
                <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center shadow-sm border border-white/10">
                  <img src={clubLogo} alt="FCO Logo" className="w-7 h-7 object-contain" />
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-primary-foreground leading-tight">{currentUser?.name}</span>
                    {currentUser?.role === 'admin+' && (
                      <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-primary-foreground/50 uppercase tracking-wider">
                    {currentUser?.role === 'admin+' ? (
                      <>
                        <Shield size={10} className="text-accent" />
                        <span>Super Admin</span>
                      </>
                    ) : currentUser?.role === 'admin' ? (
                      <>
                        <Shield size={10} />
                        <span>Administrateur</span>
                      </>
                    ) : currentUser?.role === 'entraineur' ? (
                      <>
                        <Dumbbell size={10} />
                        <span>Entraîneur</span>
                      </>
                    ) : currentUser?.role === 'photographe' ? (
                      <>
                        <Camera size={10} />
                        <span>Photographe</span>
                      </>
                    ) : currentUser?.role === 'dirigeant' ? (
                      <>
                        <Briefcase size={10} />
                        <span>Dirigeant</span>
                      </>
                    ) : (
                      <>
                        <UserCircle size={10} />
                        <span>Joueur</span>
                      </>
                    )}
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
          <div className="flex items-center justify-between">
            <div className={`${mobileMenuOpen ? 'flex flex-col' : 'hidden'} md:flex md:flex-row overflow-x-auto flex-1`}>
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { handleTabChange(tab.id); setMobileMenuOpen(false); }}
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
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div key={activeTab} className="animate-fade-in">
          {activeTab === 'presences' && (
            <PresencesTab
              events={events}
              players={visiblePlayers}
              members={visibleMembers}
              currentUser={currentUser}
              canManage={canManage}
              canCreateEvent={canCreateEvent}
              canManageOwnPresence={canManageOwnPresence}
              togglePresence={togglePresence}
              deleteEvent={deleteEvent}
              canDeleteEvent={canDeleteEvent}
              onAddEvent={() => setShowAddEvent(true)}
              onUpdateConvocations={async (eventId, convocations) => {
                try {
                  await updateDoc(doc(db, 'events', eventId), { convocations, convocationsPublished: true });
                  toast.success('Convocations publiées !');
                } catch (err: any) {
                  toast.error('Erreur: ' + err.message);
                }
              }}
              onSendConvocationEmails={async (eventId) => {
                const event = events.find(e => e.id === eventId);
                if (!event?.convocations) return;
                const dateFormatted = new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                let sent = 0;
                for (const [playerId, conv] of Object.entries(event.convocations)) {
                  const player = players.find(p => p.id === playerId);
                  const member = members.find(m => m.playerId === playerId);
                  if (!member?.email || !player) continue;
                  const statusLabel = conv.status === 'convoque' ? 'Convoqué' : 'Non convoqué';
                  const teamLabel = '';
                  try {
                    await emailjs.send('service_7wmhc61', 'template_p3ig9nv', {
                      to_email: member.email,
                      player_name: player.name,
                      match_title: event.title,
                      match_date: dateFormatted,
                      team_name: teamLabel,
                      convocation_status: statusLabel,
                      position: conv.position || '—',
                      jersey_number: conv.number ? `#${conv.number}` : '—',
                    }, 'YAIU3poHgOd6cG6PI');
                    sent++;
                  } catch (emailErr) {
                    console.error('Erreur envoi convocation à', member.email, emailErr);
                  }
                }
                toast.success(`${sent} joueur${sent > 1 ? 's' : ''} notifié${sent > 1 ? 's' : ''} par email`);
              }}
            />
          )}
          {activeTab === 'stats' && (
            <StatsTab
              players={visiblePlayersForStats}
              events={events}
              cards={cards}
              attendanceRecords={attendanceRecords}
              members={visibleMembers}
              currentUser={currentUser}
              canManage={canManage}
              updatePlayerStats={updatePlayerStats}
              deletePlayer={deletePlayer}
              getPlayerCards={getPlayerCards}
              deleteCard={deleteCard}
               onAddCard={(playerId) => { setSelectedPlayerForCard(playerId); setShowAddCard(true); }}
            />
          )}
          {activeTab === 'championnat' && (
            <ChampionnatTab
              championships={championships}
              matches={champMatches}
              currentUserRole={currentUser?.role}
              canManage={canManage}
              canUpdateChampionnat={canUpdateChampionnat}
              onAddChampionship={addChampionship}
              onDeleteChampionship={deleteChampionship}
              onAddMatch={addChampMatch}
              onUpdateMatchScore={updateMatchScore}
              onDeleteMatch={deleteChampMatch}
              onRefreshFromFFF={refreshFromFFF}
            />
          )}
          {activeTab === 'news' && (
            <NewsTab
              news={news}
              comments={newsComments}
              members={members}
              currentUser={currentUser}
              canManage={canManage}
              canCreateNews={canCreateNews}
              deleteNews={deleteNews}
              toggleLike={toggleLike}
              addComment={addComment}
              deleteComment={deleteComment}
              onAddNews={() => setShowAddNews(true)}
            />
          )}
          {activeTab === 'calendar' && <CalendarTab events={events} members={members} currentUser={currentUser} />}
          {activeTab === 'gallery' && (
            <GalleryTab
              albums={albums}
              photos={galleryPhotos}
              currentUser={currentUser}
              canManagePhotos={canManagePhotos}
              onCreateAlbum={createAlbum}
              onDeleteAlbum={deleteAlbum}
              onUploadPhotos={uploadPhotos}
              onDeletePhoto={deletePhoto}
            />
          )}
          {activeTab === 'members' && (
            <MembersTab
              members={visibleMembers}
              players={visiblePlayers}
              cards={cards}
              currentUser={currentUser}
              canManage={canManage}
              getPlayerCards={getPlayerCards}
              deletePlayer={deletePlayer}
              deleteMember={deleteMember}
               onResetPassword={(member) => { setSelectedMemberForReset(member); setShowAdminResetPassword(true); }}
               onAddPlayer={() => setShowAddPlayer(true)}
                onChangeRole={async (memberId, newRole, password) => {
                  try {
                    const targetMember = members.find(m => m.id === memberId);
                    // Cannot change admin+'s role
                    if (targetMember?.role === 'admin+') {
                      toast.error("Le rôle Admin+ ne peut pas être modifié");
                      throw new Error('forbidden');
                    }
                    // Only admin+ can change admin roles or assign admin/admin+
                    if ((targetMember?.role === 'admin' || newRole === 'admin' || newRole === 'admin+') && currentUser?.role !== 'admin+') {
                      toast.error("Seul l'Admin+ peut modifier le rôle Administrateur");
                      throw new Error('forbidden');
                    }
                    // Re-authenticate before changing role
                    const user = firebaseAuth.currentUser;
                    if (!user || !user.email) throw new Error('Non authentifié');
                    const credential = EmailAuthProvider.credential(user.email, password);
                    await reauthenticateWithCredential(user, credential);
                    
                    await updateDoc(doc(db, 'users', memberId), { role: newRole });
                    toast.success('Rôle mis à jour avec succès');
                  } catch (err: any) {
                    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                      toast.error('Mot de passe incorrect');
                    } else if (err.message !== 'forbidden') {
                      toast.error('Erreur: ' + err.message);
                    }
                    throw err;
                  }
                }}
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
      {showAddPlayer && <AddPlayerForm onSubmit={addPlayer} onClose={() => setShowAddPlayer(false)} currentUser={currentUser} />}
      {showAddEvent && <AddEventForm onSubmit={addEvent} onClose={() => setShowAddEvent(false)} isDirigeant={currentUser?.role === 'dirigeant'} />}
      {showAddNews && <AddNewsForm onSubmit={addNews} onClose={() => setShowAddNews(false)} />}
      {showAddCard && <AddCardForm players={visiblePlayers} selectedPlayerId={selectedPlayerForCard} onSubmit={addCard} onClose={() => { setShowAddCard(false); setSelectedPlayerForCard(null); }} />}
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
      {playerCreatedResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setPlayerCreatedResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header with success icon */}
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-accent" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {playerCreatedResult.withAccount ? 'Joueur ajouté avec succès' : 'Joueur ajouté avec succès'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{playerCreatedResult.name}</p>
            </div>

            {/* Account details */}
            {playerCreatedResult.withAccount && playerCreatedResult.email && (
              <div className="mx-6 mb-4 space-y-2">
                <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                  <Mail size={16} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</p>
                    <p className="text-sm font-medium text-foreground truncate">{playerCreatedResult.email}</p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(playerCreatedResult.email || '')}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                    title="Copier"
                  >
                    <Copy size={14} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                  <KeyRound size={16} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mot de passe</p>
                    <p className="text-sm font-medium text-foreground font-mono">{playerCreatedResult.password}</p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(playerCreatedResult.password || '')}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                    title="Copier"
                  >
                    <Copy size={14} className="text-muted-foreground" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-2 px-2">
                  📋 Communique ces identifiants au joueur pour qu'il puisse se connecter
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <button
                onClick={() => setPlayerCreatedResult(null)}
                className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20"
              >
                Parfait !
              </button>
            </div>
          </div>
        </div>
      )}
      {eventCreatedResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setEventCreatedResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                <CalendarDays size={32} className="text-accent" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Événement créé avec succès</h3>
              <p className="text-sm text-muted-foreground mt-1">{eventCreatedResult.title}</p>
            </div>

            {/* Details */}
            <div className="mx-6 mb-4 space-y-2">
              <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                <Calendar size={16} className="text-accent shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(eventCreatedResult.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                <Trophy size={16} className="text-accent shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Type</p>
                  <p className="text-sm font-medium text-foreground">
                    {eventCreatedResult.type === 'match' ? '⚽ Match' : eventCreatedResult.type === 'training' ? '🏃 Entraînement' : '📌 Autre'}
                  </p>
                </div>
              </div>
              {eventCreatedResult.notified ? (
                <div className="flex items-center gap-3 p-3 bg-accent/5 rounded-xl border border-accent/20">
                  <Bell size={16} className="text-accent shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notifications</p>
                    <p className="text-sm font-medium text-accent">{eventCreatedResult.notifCount} joueur{eventCreatedResult.notifCount > 1 ? 's' : ''} notifié{eventCreatedResult.notifCount > 1 ? 's' : ''} par email</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                  <Bell size={16} className="text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notifications</p>
                    <p className="text-sm text-muted-foreground">Aucune notification envoyée</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <button
                onClick={() => setEventCreatedResult(null)}
                className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20"
              >
                Parfait !
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
