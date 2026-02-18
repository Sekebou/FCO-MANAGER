import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { sendInvitationEmail, sendNotificationEmail } from '@/lib/emailjs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { db, collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, where, setDoc, auth as firebaseAuth, sendPasswordResetEmail, arrayUnion, arrayRemove, createUserWithoutSignIn, EmailAuthProvider, reauthenticateWithCredential } from '@/lib/firebase';
import { 
  Users, TrendingUp, Bell, Calendar, CalendarDays, LogOut, Shield, Trophy, Lock, Menu, X, CheckCircle2, Mail, KeyRound, UserCheck, Copy, Camera, Dumbbell, UserCircle, Briefcase, MessageCircle
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
import ChatBubble from '@/components/dashboard/ChatBubble';
import NotificationBell from '@/components/dashboard/NotificationBell';
import AddPlayerForm from '@/components/modals/AddPlayerForm';
import AddEventForm from '@/components/modals/AddEventForm';
import AddNewsForm from '@/components/modals/AddNewsForm';
import AddCardForm from '@/components/modals/AddCardForm';
import ChangePasswordForm from '@/components/modals/ChangePasswordForm';
import AdminResetPasswordForm from '@/components/modals/AdminResetPasswordForm';
import AvatarModal from '@/components/modals/AvatarModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import InvitePlayerForm from '@/components/modals/InvitePlayerForm';


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
  reason?: string;
  recurrence?: 'recurring' | 'ponctuel';
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
  licenseExpiry?: string;
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
  { id: 'news', label: 'Au cœur du club', icon: Bell },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'gallery', label: 'Galerie', icon: Camera },
  { id: 'members', label: 'Membres', icon: Users },
];

const Dashboard = () => {
  const { currentUser, logout, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  
  // Register for push notifications on native platforms
  usePushNotifications(currentUser?.uid);
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabFromUrl = urlParams.get('tab');
    return tabFromUrl || 'presences';
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
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
  const [chatOpen, setChatOpen] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  // Auto-hide header on scroll (mobile only)
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        if (currentY < 10) {
          setHeaderVisible(true);
        } else if (currentY > lastScrollY.current + 5) {
          setHeaderVisible(false);
          setMobileMenuOpen(false);
        } else if (currentY < lastScrollY.current - 5) {
          setHeaderVisible(true);
        }
        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Check for first-login welcome flag
  useEffect(() => {
    const name = sessionStorage.getItem('showWelcome');
    if (name) {
      setWelcomeName(name);
      sessionStorage.removeItem('showWelcome');
    }
  }, []);

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
  const [avatarFocusLicense, setAvatarFocusLicense] = useState(false);
  const [showLicenseReminder, setShowLicenseReminder] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [showInvitePlayer, setShowInvitePlayer] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; link: string } | null>(null);
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

  // Auto-generate next occurrence for recurring events
  const recurringProcessed = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUser || events.length === 0) return;
    
    const processRecurring = async () => {
      const now = new Date();
      const recurringEvents = events.filter(e => e.recurrence === 'recurring');
      
      for (const event of recurringEvents) {
        const eventDate = new Date(event.date);
        if (eventDate >= now) continue;
        if (recurringProcessed.current.has(event.id)) continue;
        
        const nextDate = new Date(eventDate);
        nextDate.setDate(nextDate.getDate() + 7);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        
        const alreadyExists = events.some(e => 
          e.title === event.title && 
          e.recurrence === 'recurring' &&
          e.date.startsWith(nextDateStr)
        );
        
        if (!alreadyExists) {
          try {
            const timeStr = event.date.includes('T') ? event.date.split('T')[1] : '';
            const newDate = timeStr ? `${nextDateStr}T${timeStr}` : nextDateStr;
            
            await addDoc(collection(db, 'events'), {
              title: event.title,
              date: newDate,
              type: event.type,
              recurrence: 'recurring',
              presences: {},
              createdBy: event.createdBy || '',
              createdByName: event.createdByName || '',
              createdAt: new Date().toISOString(),
            });
          } catch (err) {
            console.error('Error creating recurring event:', err);
          }
        }
        recurringProcessed.current.add(event.id);
      }
    };
    
    processRecurring();
  }, [events, currentUser]);


  useEffect(() => {
    if (!currentUser || ['photographe', 'admin', 'admin+'].includes(currentUser.role)) return;
    const checkLicense = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;
        const userLicense = userData?.licenseExpiry;
        
        // Also check player doc
        let playerLicense: string | null = null;
        if (currentUser.playerId) {
          try {
            const playerDoc = await getDoc(doc(db, 'players', currentUser.playerId));
            playerLicense = playerDoc.exists() ? playerDoc.data()?.licenseExpiry || null : null;
          } catch {}
        }
        
        const hasLicense = !!(userLicense || playerLicense);
        if (!hasLicense) {
          setShowLicenseReminder(true);
        }
      } catch (err) {
        console.warn('License check error:', err);
      }
    };
    checkLicense();
  }, [currentUser]);

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
          position: playerData.position || 'Non défini',
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
    // Bloquer les dates passées
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(eventData.date) < today) {
      toast.error("Impossible de créer un événement à une date passée");
      return;
    }
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

      const typeLabels: Record<string, string> = { match: 'Match', training: 'Entraînement', other: 'Événement' };
      const typeIcons: Record<string, string> = { match: '🏟️', training: '🏋️', other: '📅' };
      const dateFormatted = new Date(eventData.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const pushTitle = `${typeIcons[eventData.type] || '📅'} ${typeLabels[eventData.type] || 'Événement'} : ${eventData.title}`;
      const pushBody = `📅 ${dateFormatted}${eventData.type === 'other' && eventData.reason ? ` — ${eventData.reason}` : ''}`;

      // Envoyer notification push native
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({ title: pushTitle, body: pushBody, data: { tab: 'presences' } }),
        });
      } catch (pushErr) {
        console.error('Erreur envoi push:', pushErr);
      }

      // Envoyer les notifications par email
      if (sendEmail) {
        const targetMembers = members.filter(m => m.role === 'joueur');
        const memberEmails = targetMembers.map(m => m.email);
        for (const email of memberEmails) {
          try {
            await sendNotificationEmail({
              to_email: email,
              event_title: eventData.title,
              event_type_label: typeLabels[eventData.type] || 'Événement',
              type_icon: typeIcons[eventData.type] || '📅',
              event_date: dateFormatted,
              response_link: 'https://blue-pitch-dash.lovable.app/?tab=presences',
            });
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
      title: 'Supprimer cette publication ?',
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
    <div className="min-h-screen bg-secondary/30 flex flex-col">
      {/* Header — auto-hides on scroll down on mobile */}
      <header
        className={`bg-primary border-b border-primary/80 sticky z-50 pt-[env(safe-area-inset-top)] transition-transform duration-300 ease-in-out lg:translate-y-0 lg:top-0 ${
          headerVisible ? 'top-0 translate-y-0' : 'top-0 -translate-y-full'
        }`}
      >
        <div className="mx-auto px-3 sm:px-6 lg:px-10">
          <div className="flex justify-between items-center h-16 lg:h-20">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-white/20 rounded-xl flex items-center justify-center shadow-md border border-white/15">
                  <img src={clubLogo} alt="FCO Logo" className="w-8 h-8 sm:w-9 sm:h-9 lg:w-11 lg:h-11 object-contain drop-shadow-md" />
                </div>
                <h1 className="text-base sm:text-lg lg:text-xl font-bold text-primary-foreground leading-tight">FCO Manager</h1>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Profile group */}
              <button
                onClick={() => setShowAvatarModal(true)}
                className="flex items-center gap-2.5 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:bg-white/10 transition-all group"
              >
                <div className="relative">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 flex items-center justify-center overflow-hidden ring-2 ring-white/20 group-hover:ring-accent transition-all">
                    {currentUser?.photoURL ? (
                      <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] sm:text-xs font-bold text-primary-foreground">
                        {currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-success rounded-full border-2 border-primary" />
                </div>
                <div className="hidden min-[414px]:block text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-semibold text-primary-foreground leading-tight">
                      <span className="sm:hidden">{currentUser?.name?.split(' ')[0]}</span>
                      <span className="hidden sm:inline">{currentUser?.name}</span>
                    </span>
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

              {/* Notifications */}
              <NotificationBell />
              {/* Actions */}
              <button onClick={() => setShowChangePassword(true)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-all" title="Changer mot de passe">
                <Lock size={14} className="sm:hidden" />
                <Lock size={16} className="hidden sm:block" />
              </button>
              <button onClick={handleLogout} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-destructive/20 flex items-center justify-center text-primary-foreground/50 hover:text-destructive transition-all" title="Déconnexion">
                <LogOut size={14} className="sm:hidden" />
                <LogOut size={16} className="hidden sm:block" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation — hamburger on mobile, horizontal tabs on desktop */}
      <nav className={`bg-card border-b border-border sticky z-40 transition-all duration-300 ease-in-out lg:top-[calc(5rem+env(safe-area-inset-top))] ${
        headerVisible 
          ? 'top-[calc(4rem+env(safe-area-inset-top))]' 
          : 'top-0'
      }`}>
        <div className="mx-auto">
          {/* Mobile + Tablet: hamburger button */}
          <div className="lg:hidden flex items-center px-3 py-2.5">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center gap-3 text-base font-semibold text-foreground py-1"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              {(() => {
                const current = tabs.find(t => t.id === activeTab);
                const Icon = current?.icon || Users;
                return (
                  <span className="flex items-center gap-2.5">
                    <Icon size={20} className="text-accent" />
                    {current?.label}
                  </span>
                );
              })()}
            </button>
          </div>
          {/* Mobile: dropdown menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-border bg-card animate-fade-in pb-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { handleTabChange(tab.id); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-accent/10 text-accent'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                    }`}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
          {/* Desktop: horizontal tabs */}
          <div className="hidden lg:flex overflow-x-auto scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 border-b-2 transition-all whitespace-nowrap text-sm font-medium shrink-0 ${
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
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:p-6 lg:px-10 flex-1">
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
          {/* Chat removed from tabs, now a floating bubble */}
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
               
               onInvitePlayer={() => setShowInvitePlayer(true)}
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
                onChangePosition={async (playerId, newPosition) => {
                  try {
                    await updateDoc(doc(db, 'players', playerId), { position: newPosition });
                    toast.success('Poste mis à jour');
                  } catch (err: any) {
                    toast.error('Erreur: ' + err.message);
                  }
                }}
            />
          )}
        </div>
      </main>

      {/* Floating Chat Bubble */}
      <ChatBubble currentUser={currentUser} members={members} chatOpen={chatOpen} setChatOpen={setChatOpen} />

      {/* Footer */}
      <footer className="border-t border-border bg-card px-3 py-3 sm:p-4 text-center mt-auto">
        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse shrink-0" />
          <span className="hidden sm:inline">Connecté au serveur — Données synchronisées en temps réel</span>
          <span className="sm:hidden">Connecté · Synchro en temps réel</span>
        </div>
      </footer>

      {/* Modals */}
      {showAddPlayer && <AddPlayerForm onSubmit={addPlayer} onClose={() => setShowAddPlayer(false)} currentUser={currentUser} />}
      {showInvitePlayer && (
        <InvitePlayerForm
          currentUser={currentUser}
          onClose={() => setShowInvitePlayer(false)}
          onSubmit={async (data) => {
            try {
              // Coaches can only invite joueur
              if (currentUser?.role === 'entraineur') data.role = 'joueur';
              if (data.role === 'admin+' && currentUser?.role !== 'admin+') {
                toast.error("Seul l'Admin+ peut attribuer ce rôle");
                return;
              }

              // Generate a unique token
              const token = crypto.randomUUID();
              const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

              // Store invitation in Firestore
              await setDoc(doc(db, 'invitations', token), {
                email: data.email || null,
                role: data.role,
                position: data.position || null,
                licenseExpiry: data.licenseExpiry || null,
                status: 'pending',
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.uid || '',
                createdByName: currentUser?.name || '',
                expiresAt,
              });

              // Generate the invitation link
              const link = `${window.location.origin}/register?token=${token}`;

              if (data.mode === 'email' && data.email) {
                // Send email
                const roleLabels: Record<string, string> = { joueur: 'Joueur', entraineur: 'Entraîneur', dirigeant: 'Dirigeant', photographe: 'Photographe', admin: 'Administrateur', 'admin+': 'Admin+' };
                try {
                  await sendInvitationEmail({
                    to_email: data.email,
                    invite_link: link,
                    role_label: roleLabels[data.role] || data.role,
                    inviter_name: currentUser?.name || 'Un administrateur',
                  });
                  toast.success('Invitation envoyée par email !');
                } catch (emailErr) {
                  console.error('Erreur envoi email:', emailErr);
                  toast.warning("Email non envoyé, mais le lien a été généré");
                }
              } else {
                toast.success('Lien d\'invitation généré !');
              }

              setShowInvitePlayer(false);
              setInviteResult({ email: data.email || '', link });
            } catch (err: any) {
              toast.error('Erreur: ' + err.message);
            }
          }}
        />
      )}
      {inviteResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setInviteResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-accent" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{inviteResult.email ? 'Invitation envoyée' : 'Lien généré'}</h3>
              {inviteResult.email && <p className="text-sm text-muted-foreground mt-1">{inviteResult.email}</p>}
            </div>
            <div className="mx-6 mb-4 space-y-2">
              <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                <Mail size={16} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lien d'inscription</p>
                  <p className="text-xs font-medium text-foreground truncate">{inviteResult.link}</p>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteResult.link); toast.success('Lien copié !'); }}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  title="Copier"
                >
                  <Copy size={14} className="text-muted-foreground" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-2 px-2">
                📋 Vous pouvez aussi partager ce lien directement. Il expire dans 48h.
              </p>
            </div>
            <div className="p-4 border-t border-border">
              <button onClick={() => setInviteResult(null)} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all text-sm">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
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
          onClose={() => { setShowAvatarModal(false); setAvatarFocusLicense(false); }}
          onAvatarUpdated={(photoURL) => {
            setCurrentUser({ ...currentUser, photoURL });
          }}
          focusLicense={avatarFocusLicense}
        />
      )}
      {showLicenseReminder && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowLicenseReminder(false)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-warning/10 rounded-2xl flex items-center justify-center mb-4">
                <Shield size={32} className="text-warning" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Licence non renseignée</h3>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Votre date d'expiration de licence FFF n'est pas encore renseignée. Merci de la mettre à jour dans votre profil.
              </p>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button
                onClick={() => setShowLicenseReminder(false)}
                className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm"
              >
                Plus tard
              </button>
              <button
                onClick={() => { setShowLicenseReminder(false); setAvatarFocusLicense(true); setShowAvatarModal(true); }}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-primary/20"
              >
                Mettre à jour
              </button>
            </div>
          </div>
        </div>
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

      {/* Welcome modal - first login only */}
      {welcomeName && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-4">
          <div className="relative max-w-sm w-full animate-[fadeSlideUp_0.6s_ease-out_both] overflow-hidden rounded-[2rem] bg-gradient-to-b from-card to-card/95 border border-border/50 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]">
            {/* Decorative glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-60 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-primary/10 rounded-full blur-[60px] pointer-events-none" />

            <div className="relative z-10 px-8 pt-10 pb-8 text-center">
              {/* Logo with animated ring */}
              <div className="relative inline-flex items-center justify-center mb-7">
                <div className="absolute w-24 h-24 rounded-full border border-primary/20 animate-[pulse_3s_ease-in-out_infinite]" />
                <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-primary/10">
                  <img src={clubLogo} alt="FCO" className="w-13 h-13 object-contain drop-shadow-md" />
                </div>
              </div>

              {/* Title */}
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary/60 mb-3">FCO Manager</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight">
                Bienvenue{' '}
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {welcomeName.split(' ')[0]?.charAt(0).toUpperCase() + (welcomeName.split(' ')[0]?.slice(1).toLowerCase() || '')}
                </span>
              </h2>

              {/* Separator */}
              <div className="mt-5 mb-5 mx-auto w-12 h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

              {/* Description */}
              <p className="text-muted-foreground text-sm leading-relaxed max-w-[260px] mx-auto">
                L'application pensée et conçue exclusivement pour le club de Oisemont.
              </p>

              {/* CTA */}
              <button
                onClick={() => setWelcomeName(null)}
                className="mt-8 w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-primary/90 active:scale-[0.97] transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
              >
                C'est parti →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
