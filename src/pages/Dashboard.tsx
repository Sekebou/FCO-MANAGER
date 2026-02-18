import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  time?: string;
  location?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId?: string;
  date: string;
  likes?: string[];
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

// ---- Supabase helpers: map DB snake_case → app camelCase ----
const mapPlayer = (r: any): Player => ({ id: r.id, name: r.name, position: r.position || 'Non défini', matches: r.matches ?? 0, goals: r.goals ?? 0, assists: r.assists ?? 0, licenseExpiry: r.license_expiry || undefined });
const mapEvent = (r: any): Event => ({ id: r.id, title: r.title, date: r.date, type: r.type, team: r.team, reason: r.reason, recurrence: r.recurrence, presences: r.presences as any || {}, convocations: r.convocations as any || {}, convocationsPublished: r.convocations_published ?? false, createdBy: r.created_by, createdByName: r.created_by_name, createdAt: r.created_at, time: r.time, location: r.location });
const mapNews = (r: any): NewsItem => ({ id: r.id, title: r.title, content: r.content, author: r.author, authorId: r.author_id, date: r.date, likes: r.likes || [] });
const mapMember = (r: any): Member => ({ id: r.id, name: r.name, email: r.email, role: r.role, playerId: r.player_id, photoURL: r.photo_url, createdAt: r.created_at, username: r.username, licenseExpiry: r.license_expiry });
const mapCard = (r: any): Card => ({ id: r.id, playerId: r.player_id, type: r.type as any, reason: r.reason, date: r.date, suspendedUntil: r.suspended_until });
const mapAttendance = (r: any): AttendanceRecord => ({ id: r.id, playerId: r.player_id, eventId: r.event_id, eventType: r.event_type, eventDate: r.event_date, status: r.status, savedAt: r.saved_at });
const mapComment = (r: any): NewsComment => ({ id: r.id, newsId: r.news_id, authorName: r.author_name, authorUid: r.author_uid, content: r.content, createdAt: r.created_at });
const mapChamp = (r: any): Championship => ({ id: r.id, name: r.name, season: r.season, teams: r.teams || [], fffUrl: r.fff_url, fffStandings: r.fff_standings || [], teamLogos: r.team_logos || {}, team: r.team, createdAt: r.created_at });
const mapMatch = (r: any): Match => ({ id: r.id, championshipId: r.championship_id, homeTeam: r.home_team, awayTeam: r.away_team, homeScore: r.home_score, awayScore: r.away_score, date: r.date, journee: r.journee, played: r.played ?? false });
const mapAlbum = (r: any): Album => ({ id: r.id, name: r.name, description: r.description, createdAt: r.created_at, createdBy: r.created_by, coverUrl: r.cover_url });
const mapPhoto = (r: any): Photo => ({ id: r.id, albumId: r.album_id, url: r.url, storagePath: r.storage_path, title: r.title, uploadedAt: r.uploaded_at, uploadedBy: r.uploaded_by, uploaderName: r.uploader_name });

const Dashboard = () => {
  const { currentUser, logout, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  
  usePushNotifications(currentUser?.uid);
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || 'presences';
  });

  const handleTabChange = (tab: string) => setActiveTab(tab);
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

  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        if (currentY < 10) setHeaderVisible(true);
        else if (currentY > lastScrollY.current + 5) { setHeaderVisible(false); setMobileMenuOpen(false); }
        else if (currentY < lastScrollY.current - 5) setHeaderVisible(true);
        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const name = sessionStorage.getItem('showWelcome');
    if (name) { setWelcomeName(name); sessionStorage.removeItem('showWelcome'); }
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
  const canCreateNews = () => currentUser && (canManage() || currentUser.role === 'dirigeant');
  const canCreateEvent = () => currentUser && (canManage() || currentUser.role === 'dirigeant');

  const adminPlusPlayerIds = members.filter(m => m.role === 'admin+' && m.playerId).map(m => m.playerId);
  const dirigeantPlayerIds = members.filter(m => m.role === 'dirigeant' && m.playerId).map(m => m.playerId);
  const visiblePlayers = players.filter(p => !adminPlusPlayerIds.includes(p.id));
  const visiblePlayersForStats = players.filter(p => !adminPlusPlayerIds.includes(p.id) && !dirigeantPlayerIds.includes(p.id));
  const visibleMembers = members.filter(m => m.role !== 'admin+');

  // ===== DATA LOADING via Supabase =====
  useEffect(() => {
    if (!currentUser) { navigate('/auth'); return; }

    const fetchAll = async () => {
      try {
        const [
          { data: playersData }, { data: eventsData }, { data: newsData },
          { data: membersData }, { data: cardsData }, { data: attendanceData },
          { data: commentsData }, { data: champsData }, { data: matchesData },
          { data: albumsData }, { data: photosData }
        ] = await Promise.all([
          supabase.from('players').select('*'),
          supabase.from('events').select('*').order('date', { ascending: false }),
          supabase.from('news').select('*').order('date', { ascending: false }),
          supabase.from('profiles').select('*').order('created_at', { ascending: false }),
          supabase.from('cards').select('*').order('date', { ascending: false }),
          supabase.from('attendance_records').select('*'),
          supabase.from('news_comments').select('*').order('created_at', { ascending: true }),
          supabase.from('championships').select('*'),
          supabase.from('championship_matches').select('*'),
          supabase.from('albums').select('*').order('created_at', { ascending: false }),
          supabase.from('gallery_photos').select('*'),
        ]);

        setPlayers((playersData || []).map(mapPlayer));
        setEvents((eventsData || []).map(mapEvent));
        setNews((newsData || []).map(mapNews));
        setMembers((membersData || []).map(mapMember));
        setCards((cardsData || []).map(mapCard));
        setAttendanceRecords((attendanceData || []).map(mapAttendance));
        setNewsComments((commentsData || []).map(mapComment));
        setChampionships((champsData || []).map(mapChamp));
        setChampMatches((matchesData || []).map(mapMatch));
        setAlbums((albumsData || []).map(mapAlbum));
        setGalleryPhotos((photosData || []).map(mapPhoto));
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchAll();

    // Detect iOS Capacitor (Realtime WebSocket doesn't work reliably on iOS native)
    const isIOSNative = /iPad|iPhone|iPod/.test(navigator.userAgent) && (window as any).Capacitor?.isNativePlatform?.();

    if (isIOSNative) {
      // === iOS REST polling fallback: hot (2s) + cold (8s) ===
      const fetchHot = async () => {
        try {
          const [{ data: attData }, { data: newsData }, { data: commData }, { data: playersData }] = await Promise.all([
            supabase.from('attendance_records').select('*'),
            supabase.from('news').select('*').order('date', { ascending: false }),
            supabase.from('news_comments').select('*').order('created_at', { ascending: true }),
            supabase.from('players').select('*'),
          ]);
          if (attData) setAttendanceRecords(attData.map(mapAttendance));
          if (newsData) setNews(newsData.map(mapNews));
          if (commData) setNewsComments(commData.map(mapComment));
          if (playersData) setPlayers(playersData.map(mapPlayer));
        } catch (err) { console.warn('iOS hot poll error:', err); }
      };

      const fetchCold = async () => {
        try {
          const [{ data: evData }, { data: memData }, { data: cardsData }, { data: champsData }, { data: matchData }, { data: albData }, { data: photData }] = await Promise.all([
            supabase.from('events').select('*').order('date', { ascending: false }),
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('cards').select('*').order('date', { ascending: false }),
            supabase.from('championships').select('*'),
            supabase.from('championship_matches').select('*'),
            supabase.from('albums').select('*').order('created_at', { ascending: false }),
            supabase.from('gallery_photos').select('*'),
          ]);
          if (evData) setEvents(evData.map(mapEvent));
          if (memData) setMembers(memData.map(mapMember));
          if (cardsData) setCards(cardsData.map(mapCard));
          if (champsData) setChampionships(champsData.map(mapChamp));
          if (matchData) setChampMatches(matchData.map(mapMatch));
          if (albData) setAlbums(albData.map(mapAlbum));
          if (photData) setGalleryPhotos(photData.map(mapPhoto));
        } catch (err) { console.warn('iOS cold poll error:', err); }
      };

      const hotInterval = setInterval(fetchHot, 1000);
      const coldInterval = setInterval(fetchCold, 3000);

      return () => { clearInterval(hotInterval); clearInterval(coldInterval); };
    }

    // === Web/Android: Supabase Realtime subscriptions ===
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        supabase.from('players').select('*').then(({ data }) => data && setPlayers(data.map(mapPlayer)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        supabase.from('events').select('*').order('date', { ascending: false }).then(({ data }) => data && setEvents(data.map(mapEvent)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news' }, () => {
        supabase.from('news').select('*').order('date', { ascending: false }).then(({ data }) => data && setNews(data.map(mapNews)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setMembers(data.map(mapMember)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => {
        supabase.from('cards').select('*').order('date', { ascending: false }).then(({ data }) => data && setCards(data.map(mapCard)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
        supabase.from('attendance_records').select('*').then(({ data }) => data && setAttendanceRecords(data.map(mapAttendance)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news_comments' }, () => {
        supabase.from('news_comments').select('*').order('created_at', { ascending: true }).then(({ data }) => data && setNewsComments(data.map(mapComment)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'championships' }, () => {
        supabase.from('championships').select('*').then(({ data }) => data && setChampionships(data.map(mapChamp)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'championship_matches' }, () => {
        supabase.from('championship_matches').select('*').then(({ data }) => data && setChampMatches(data.map(mapMatch)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'albums' }, () => {
        supabase.from('albums').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setAlbums(data.map(mapAlbum)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_photos' }, () => {
        supabase.from('gallery_photos').select('*').then(({ data }) => data && setGalleryPhotos(data.map(mapPhoto)));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
        const alreadyExists = events.some(e => e.title === event.title && e.recurrence === 'recurring' && e.date.startsWith(nextDateStr));
        if (!alreadyExists) {
          try {
            const timeStr = event.date.includes('T') ? event.date.split('T')[1] : '';
            const newDate = timeStr ? `${nextDateStr}T${timeStr}` : nextDateStr;
            await supabase.from('events').insert({
              title: event.title, date: newDate, type: event.type, recurrence: 'recurring',
              presences: {}, created_by: event.createdBy || '', created_by_name: event.createdByName || '',
            });
          } catch (err) { console.error('Error creating recurring event:', err); }
        }
        recurringProcessed.current.add(event.id);
      }
    };
    processRecurring();
  }, [events, currentUser]);

  // License check
  useEffect(() => {
    if (!currentUser || ['photographe', 'admin', 'admin+'].includes(currentUser.role)) return;
    const checkLicense = async () => {
      try {
        const { data: profile } = await supabase.from('profiles').select('license_expiry').eq('id', currentUser.uid).single();
        let playerLicense: string | null = null;
        if (currentUser.playerId) {
          const { data: player } = await supabase.from('players').select('license_expiry').eq('id', currentUser.playerId).single();
          playerLicense = player?.license_expiry || null;
        }
        if (!(profile?.license_expiry || playerLicense)) setShowLicenseReminder(true);
      } catch (err) { console.warn('License check error:', err); }
    };
    checkLicense();
  }, [currentUser]);

  const handleLogout = async () => { await logout(); navigate('/auth'); };

  // CRUD functions — all Supabase
  const togglePresence = async (eventId: string, playerId: string, status: string) => {
    if (!canManageOwnPresence(playerId)) { toast.warning('Vous ne pouvez gérer que votre propre présence'); return; }
    const event = events.find(e => e.id === eventId);
    const currentPresences = { ...(event?.presences || {}) };
    if (currentPresences[playerId] === status) delete currentPresences[playerId];
    else currentPresences[playerId] = status;
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, presences: currentPresences } : e));
    const { error } = await supabase.from('events').update({ presences: currentPresences }).eq('id', eventId);
    if (error) toast.error('Erreur: ' + error.message);
  };

  const addPlayer = async (playerData: any) => {
    if (!canManage()) return;
    if (currentUser?.role === 'entraineur') playerData.role = 'joueur';
    if (playerData.role === 'admin+' && currentUser?.role !== 'admin+') { toast.error("Seul l'Admin+ peut attribuer ce rôle"); return; }

    try {
      let createdUid: string | null = null;
      if (playerData.createAccount && playerData.email && playerData.password) {
        // Use edge function to create user
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: { email: playerData.email, password: playerData.password, name: playerData.name, role: playerData.role || 'joueur', position: playerData.position || 'Attaquant', licenseExpiry: playerData.licenseExpiry || null },
        });
        if (error) throw error;
        createdUid = data?.uid;
        setPlayerCreatedResult({ name: playerData.name, email: playerData.email, password: playerData.password, withAccount: true });
      } else {
        // Create player only (no account)
        const isNonPlayer = playerData.role === 'photographe';
        if (!isNonPlayer) {
          await supabase.from('players').insert({
            name: playerData.name, position: playerData.position || 'Non défini',
            matches: 0, goals: 0, assists: 0, license_expiry: playerData.licenseExpiry || null, team: playerData.team || null,
          });
        }
        setPlayerCreatedResult({ name: playerData.name, withAccount: false });
      }
      setShowAddPlayer(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création');
    }
  };

  const deletePlayer = async (playerId: string) => {
    if (!canManage()) return;
    setConfirmModal({
      title: 'Supprimer ce joueur ?',
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try {
          // Find and delete linked profile
          const { data: linked } = await supabase.from('profiles').select('id').eq('player_id', playerId);
          if (linked && linked.length > 0) {
            await supabase.from('profiles').delete().eq('id', linked[0].id);
          }
          await supabase.from('players').delete().eq('id', playerId);
        } catch (err: any) { toast.error('Erreur: ' + err.message); }
      }
    });
  };

  const deleteMember = async (memberId: string, playerId?: string) => {
    if (!canManage()) return;
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember) return;
    if (targetMember.role === 'admin+') { toast.error("Le compte Admin+ ne peut pas être supprimé"); return; }
    if (targetMember.role === 'admin' && currentUser?.role !== 'admin+') { toast.error("Seul l'Admin+ peut supprimer un compte Administrateur"); return; }
    setConfirmModal({
      title: 'Supprimer ce membre ?',
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try {
          if (playerId) await supabase.from('players').delete().eq('id', playerId);
          await supabase.from('profiles').delete().eq('id', memberId);
        } catch (err: any) { toast.error('Erreur: ' + err.message); }
      }
    });
  };

  const addEvent = async (eventData: any) => {
    if (!canCreateEvent()) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(eventData.date) < today) { toast.error("Impossible de créer un événement à une date passée"); return; }
    if (currentUser?.role === 'dirigeant' && eventData.type === 'match') { toast.error("Les dirigeants ne peuvent créer que des entraînements"); return; }
    try {
      const sendEmail = eventData.sendNotification;
      delete eventData.sendNotification;

      const typeLabels: Record<string, string> = { match: 'Match', training: 'Entraînement', other: 'Événement' };
      const notifiableRoles = ['admin+', 'admin', 'entraineur', 'dirigeant', 'joueur'];
      const targetMembers = members.filter(m => notifiableRoles.includes(m.role));
      const memberEmails = [...new Set(targetMembers.map(m => m.email).filter(Boolean))];

      setShowAddEvent(false);
      setEventCreatedResult({ title: eventData.title, date: eventData.date, type: eventData.type, notified: sendEmail, notifCount: sendEmail ? memberEmails.length : 0 });

      const tempId = `temp-${Date.now()}`;
      const tempEvent: Event = { ...eventData, id: tempId, presences: {}, createdBy: currentUser?.uid, createdByName: currentUser?.name, createdAt: new Date().toISOString() };
      setEvents(prev => [tempEvent, ...prev]);

      (async () => {
        try {
          await supabase.from('events').insert({
            title: eventData.title, date: eventData.date, type: eventData.type,
            recurrence: eventData.recurrence || 'ponctuel', presences: {},
            created_by: currentUser?.uid || '', created_by_name: currentUser?.name || '',
            time: eventData.time || null, location: eventData.location || null,
            team: eventData.team || null, reason: eventData.reason || null,
          });

          const typeIcons: Record<string, string> = { match: '🏟️', training: '🏋️', other: '📅' };
          const dateFormatted = new Date(eventData.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          const timeFormatted = eventData.time ? ` à ${eventData.time}` : '';
          const locationInfo = eventData.location ? `\n📍 ${eventData.location}` : '';
          const pushTitle = `${typeIcons[eventData.type] || '📅'} Nouveau ${(typeLabels[eventData.type] || 'événement').toLowerCase()} disponible !`;
          const pushBody = `${eventData.title}\n📅 ${dateFormatted}${timeFormatted}${locationInfo}\n\nN'oublie pas de répondre présent ou absent ! 💪`;

          const { data: tokenRows } = await supabase.from('fcm_tokens').select('token');
          const fcmTokens = [...new Set((tokenRows || []).map((r: any) => r.token).filter(Boolean))];
          const tasks: Promise<any>[] = [];
          if (fcmTokens.length > 0) {
            tasks.push(
              fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                body: JSON.stringify({ title: pushTitle, body: pushBody, data: { tab: 'presences' }, tokens: fcmTokens }),
              }).catch(e => console.error('Push error:', e))
            );
          }
          if (sendEmail) {
            tasks.push(...memberEmails.map(email =>
              supabase.functions.invoke('send-email', {
                body: { to: email, subject: pushTitle, html: `<p>${pushBody.replace(/\n/g, '<br>')}</p>` },
              }).catch(e => console.error('Email error:', e))
            ));
          }
          await Promise.allSettled(tasks);
        } catch (err) { console.error('Background event save error:', err); toast.error('Erreur lors de la sauvegarde'); }
      })();
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
  };

  const canDeleteEvent = (event: Event) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin+' || currentUser.role === 'admin') return true;
    if (currentUser.role === 'entraineur' || currentUser.role === 'dirigeant') return event.createdBy === currentUser.uid;
    return false;
  };

  const deleteEvent = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event && !canDeleteEvent(event)) { toast.warning('Vous ne pouvez supprimer que les événements que vous avez créés'); return; }
    setConfirmModal({
      title: 'Supprimer cet événement ?',
      message: 'Les données de présence seront archivées avant la suppression.',
      onConfirm: async () => {
        try {
          if (event && event.presences) {
            const records = Object.entries(event.presences)
              .filter(([, status]) => status === 'present' || status === 'absent')
              .map(([playerId, status]) => ({
                player_id: playerId, event_id: eventId, event_type: event.type,
                event_date: event.date, status,
              }));
            if (records.length > 0) await supabase.from('attendance_records').insert(records);
          }
          await supabase.from('events').delete().eq('id', eventId);
        } catch (err: any) { toast.error('Erreur: ' + err.message); }
      }
    });
  };

  const addNews = async (newsData: any) => {
    if (!canCreateNews()) return;
    try {
      await supabase.from('news').insert({
        title: newsData.title, content: newsData.content,
        author: currentUser?.name || '', author_id: currentUser?.uid || '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowAddNews(false);
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
  };

  const deleteNews = async (newsId: string) => {
    setConfirmModal({
      title: 'Supprimer cette publication ?',
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try { await supabase.from('news').delete().eq('id', newsId); } catch (err: any) { toast.error('Erreur: ' + err.message); }
      }
    });
  };

  const toggleLike = async (newsId: string) => {
    if (!currentUser) return;
    const newsItem = news.find(n => n.id === newsId);
    if (!newsItem) return;
    const likes = newsItem.likes || [];
    const isLiked = likes.includes(currentUser.uid);
    const newLikes = isLiked ? likes.filter(id => id !== currentUser.uid) : [...likes, currentUser.uid];
    setNews(prev => prev.map(n => n.id === newsId ? { ...n, likes: newLikes } : n));
    const { error } = await supabase.from('news').update({ likes: newLikes }).eq('id', newsId);
    if (error) console.error('Error toggling like:', error);
  };

  const addComment = async (newsId: string, content: string) => {
    if (!currentUser || !content.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const newComment: NewsComment = { id: tempId, newsId, authorName: currentUser.name, authorUid: currentUser.uid, content: content.trim(), createdAt: new Date().toISOString() };
    setNewsComments(prev => [...prev, newComment]);
    const { error } = await supabase.from('news_comments').insert({
      news_id: newsId, author_name: currentUser.name, author_uid: currentUser.uid, content: content.trim(),
    });
    if (error) { setNewsComments(prev => prev.filter(c => c.id !== tempId)); console.error('Error adding comment:', error); }
  };

  const deleteComment = async (commentId: string) => {
    try { await supabase.from('news_comments').delete().eq('id', commentId); } catch (err: any) { console.error('Error deleting comment:', err); }
  };

  const addCard = async (cardData: any) => {
    if (!canManage()) return;
    try {
      await supabase.from('cards').insert({
        player_id: cardData.playerId, type: cardData.type, reason: cardData.reason,
        date: cardData.date, suspended_until: cardData.suspendedUntil || null,
      });
      setShowAddCard(false); setSelectedPlayerForCard(null);
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
  };

  const deleteCard = async (cardId: string) => {
    if (!canManage()) return;
    setConfirmModal({
      title: 'Supprimer ce carton ?', message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try { await supabase.from('cards').delete().eq('id', cardId); } catch (err: any) { toast.error('Erreur: ' + err.message); }
      }
    });
  };

  const updatePlayerStats = async (playerId: string, field: string, value: string) => {
    if (!canManage()) return;
    const numVal = parseInt(value) || 0;
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, [field]: numVal } : p));
    const { error } = await supabase.from('players').update({ [field]: numVal }).eq('id', playerId);
    if (error) console.error('Error updating stats:', error);
  };

  const getPlayerCards = (playerId: string) => cards.filter(c => c.playerId === playerId);

  // Championship CRUD
  const addChampionship = async (data: { name: string; season: string; teams: string[]; fffUrl?: string; matches?: Array<{ homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null; date: string; journee: number; played: boolean }>; standings?: Array<any>; teamLogos?: Record<string, string> }) => {
    if (!canManage()) return;
    try {
      const { matches: importedMatches, standings, teamLogos, ...champData } = data;
      const { data: inserted, error } = await supabase.from('championships').insert({
        name: champData.name, season: champData.season, teams: champData.teams,
        fff_url: champData.fffUrl || null, fff_standings: standings || [], team_logos: teamLogos || {},
      }).select('id').single();
      if (error) throw error;
      if (importedMatches && importedMatches.length > 0) {
        const rows = importedMatches.map(m => ({
          championship_id: inserted.id, home_team: m.homeTeam, away_team: m.awayTeam,
          home_score: m.homeScore, away_score: m.awayScore, date: m.date, journee: m.journee, played: m.played,
        }));
        await supabase.from('championship_matches').insert(rows);
      }
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
  };

  const canUpdateChampionnat = () => currentUser && (currentUser.role === 'admin' || currentUser.role === 'admin+' || currentUser.role === 'entraineur' || currentUser.role === 'joueur');

  const refreshFromFFF = async (championshipId: string, fffUrl: string): Promise<{ success: boolean; updated: number; added: number; standingsCount: number; error?: string }> => {
    if (!canUpdateChampionnat()) return { success: false, updated: 0, added: 0, standingsCount: 0, error: 'Non autorisé' };
    try {
      const { scrapeFFFTeams } = await import('@/lib/api/scrape-fff');
      const result = await scrapeFFFTeams(fffUrl);
      if (!result.success || !result.matches) return { success: false, updated: 0, added: 0, standingsCount: 0, error: result.error || 'Impossible de récupérer les données' };

      const updateData: Record<string, any> = {};
      if (result.standings && result.standings.length > 0) updateData.fff_standings = result.standings;
      if (result.teamLogos && Object.keys(result.teamLogos).length > 0) updateData.team_logos = result.teamLogos;
      if (Object.keys(updateData).length > 0) await supabase.from('championships').update(updateData).eq('id', championshipId);

      const existingMatches = champMatches.filter(m => m.championshipId === championshipId);
      let updated = 0, added = 0;

      for (const scraped of result.matches) {
        const existing = existingMatches.find(m => m.homeTeam.toUpperCase() === scraped.homeTeam.toUpperCase() && m.awayTeam.toUpperCase() === scraped.awayTeam.toUpperCase() && m.date === scraped.date);
        if (existing) {
          if (scraped.played && !existing.played && scraped.homeScore !== null && scraped.awayScore !== null) {
            await supabase.from('championship_matches').update({ home_score: scraped.homeScore, away_score: scraped.awayScore, played: true }).eq('id', existing.id);
            updated++;
          }
        } else {
          await supabase.from('championship_matches').insert({
            championship_id: championshipId, home_team: scraped.homeTeam, away_team: scraped.awayTeam,
            home_score: scraped.homeScore, away_score: scraped.awayScore, date: scraped.date, journee: scraped.journee, played: scraped.played,
          });
          added++;
        }
      }
      return { success: true, updated, added, standingsCount: result.standings?.length || 0 };
    } catch (err: any) { return { success: false, updated: 0, added: 0, standingsCount: 0, error: err.message }; }
  };

  const deleteChampionship = async (id: string) => {
    if (!canManage()) return;
    setConfirmModal({
      title: 'Supprimer ce championnat ?', message: 'Tous les matchs associés seront également supprimés.',
      onConfirm: async () => {
        try {
          await supabase.from('championship_matches').delete().eq('championship_id', id);
          await supabase.from('championships').delete().eq('id', id);
        } catch (err: any) { toast.error('Erreur: ' + err.message); }
      }
    });
  };

  const addChampMatch = async (data: Omit<Match, 'id'>) => {
    if (!canManage()) return;
    try {
      await supabase.from('championship_matches').insert({
        championship_id: data.championshipId, home_team: data.homeTeam, away_team: data.awayTeam,
        home_score: data.homeScore, away_score: data.awayScore, date: data.date, journee: data.journee, played: data.played,
      });
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
  };

  const updateMatchScore = async (matchId: string, homeScore: number, awayScore: number) => {
    if (!canUpdateChampionnat()) return;
    try { await supabase.from('championship_matches').update({ home_score: homeScore, away_score: awayScore, played: true }).eq('id', matchId); } catch (err: any) { toast.error('Erreur: ' + err.message); }
  };

  const deleteChampMatch = async (matchId: string) => {
    if (!canManage()) return;
    setConfirmModal({
      title: 'Supprimer ce match ?', message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try { await supabase.from('championship_matches').delete().eq('id', matchId); } catch (err: any) { toast.error('Erreur: ' + err.message); }
      }
    });
  };

  // Gallery
  const createAlbum = async (data: { name: string; description?: string }) => {
    if (!canManagePhotos()) return;
    try {
      await supabase.from('albums').insert({ name: data.name, description: data.description || '', created_by: currentUser!.uid });
      toast.success(`Album "${data.name}" créé`);
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
  };

  const deleteAlbum = async (albumId: string) => {
    if (!canManagePhotos()) return;
    setConfirmModal({
      title: 'Supprimer cet album ?', message: 'Toutes les photos de cet album seront supprimées.',
      onConfirm: async () => {
        try {
          const albumPhotosToDelete = galleryPhotos.filter(p => p.albumId === albumId);
          for (const photo of albumPhotosToDelete) {
            try {
              await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-photos`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                body: JSON.stringify({ path: photo.storagePath }),
              });
            } catch {}
            await supabase.from('gallery_photos').delete().eq('id', photo.id);
          }
          await supabase.from('albums').delete().eq('id', albumId);
          toast.success('Album supprimé');
        } catch (err: any) { toast.error('Erreur: ' + err.message); }
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
      const { publicUrl, storagePath } = await res.json();
      await supabase.from('gallery_photos').insert({
        album_id: albumId, url: publicUrl, storage_path: storagePath,
        title: file.name.replace(/\.[^/.]+$/, ''), uploaded_by: currentUser!.uid, uploader_name: currentUser!.name,
      });
    }
  };

  const deletePhoto = (photo: { id: string; storagePath: string }) => {
    if (!canManagePhotos()) return;
    setConfirmModal({
      title: 'Supprimer cette photo ?', message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-photos`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ path: photo.storagePath }),
          });
          await supabase.from('gallery_photos').delete().eq('id', photo.id);
          toast.success('Photo supprimée');
        } catch (err: any) { toast.error('Erreur: ' + err.message); }
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">Chargement...</p>
          <p className="text-sm text-muted-foreground mt-1">Connexion au serveur</p>
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
      {/* Header */}
      <header className={`bg-primary border-b border-primary/80 sticky z-50 pt-[env(safe-area-inset-top)] transition-transform duration-300 ease-in-out lg:translate-y-0 lg:top-0 ${headerVisible ? 'top-0 translate-y-0' : 'top-0 -translate-y-full'}`}>
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
              <button onClick={() => setShowAvatarModal(true)} className="flex items-center gap-2.5 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:bg-white/10 transition-all group">
                <div className="relative">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 flex items-center justify-center overflow-hidden ring-2 ring-white/20 group-hover:ring-accent transition-all">
                    {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-[10px] sm:text-xs font-bold text-primary-foreground">{currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-success rounded-full border-2 border-primary" />
                </div>
                <div className="hidden min-[414px]:block text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-semibold text-primary-foreground leading-tight">
                      <span className="sm:hidden">{currentUser?.name?.split(' ')[0]}</span>
                      <span className="hidden sm:inline">{currentUser?.name}</span>
                    </span>
                    {currentUser?.role === 'admin+' && <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-primary-foreground/50 uppercase tracking-wider">
                    {currentUser?.role === 'admin+' ? <><Shield size={10} className="text-accent" /><span>Super Admin</span></> :
                     currentUser?.role === 'admin' ? <><Shield size={10} /><span>Administrateur</span></> :
                     currentUser?.role === 'entraineur' ? <><Dumbbell size={10} /><span>Entraîneur</span></> :
                     currentUser?.role === 'photographe' ? <><Camera size={10} /><span>Photographe</span></> :
                     currentUser?.role === 'dirigeant' ? <><Briefcase size={10} /><span>Dirigeant</span></> :
                     <><UserCircle size={10} /><span>Joueur</span></>}
                  </div>
                </div>
              </button>
              <NotificationBell />
              <button onClick={() => setShowChangePassword(true)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-all" title="Changer mot de passe">
                <Lock size={14} className="sm:hidden" /><Lock size={16} className="hidden sm:block" />
              </button>
              <button onClick={handleLogout} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-destructive/20 flex items-center justify-center text-primary-foreground/50 hover:text-destructive transition-all" title="Déconnexion">
                <LogOut size={14} className="sm:hidden" /><LogOut size={16} className="hidden sm:block" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className={`bg-card border-b border-border sticky z-40 transition-all duration-300 ease-in-out lg:top-[calc(5rem+env(safe-area-inset-top))] ${headerVisible ? 'top-[calc(4rem+env(safe-area-inset-top))]' : 'top-0'}`}>
        <div className="mx-auto">
          <div className="lg:hidden flex items-center px-3 py-2.5">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex items-center gap-3 text-base font-semibold text-foreground py-1">
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              {(() => { const current = tabs.find(t => t.id === activeTab); const Icon = current?.icon || Users; return <span className="flex items-center gap-2.5"><Icon size={20} className="text-accent" />{current?.label}</span>; })()}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-border bg-card animate-fade-in pb-1">
              {tabs.map(tab => { const Icon = tab.icon; return (
                <button key={tab.id} onClick={() => { handleTabChange(tab.id); setMobileMenuOpen(false); }} className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
                  <Icon size={18} />{tab.label}
                </button>
              ); })}
            </div>
          )}
          <div className="hidden lg:flex overflow-x-auto scrollbar-hide">
            {tabs.map(tab => { const Icon = tab.icon; return (
              <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`flex items-center gap-2 px-5 py-3.5 border-b-2 transition-all whitespace-nowrap text-sm font-medium shrink-0 ${activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}>
                <Icon size={18} />{tab.label}
              </button>
            ); })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:p-6 lg:px-10 flex-1">
        <div key={activeTab} className="animate-fade-in">
          {activeTab === 'presences' && (
            <PresencesTab events={events} players={visiblePlayers} members={visibleMembers} currentUser={currentUser} canManage={canManage} canCreateEvent={canCreateEvent} canManageOwnPresence={canManageOwnPresence} togglePresence={togglePresence} deleteEvent={deleteEvent} canDeleteEvent={canDeleteEvent} onAddEvent={() => setShowAddEvent(true)}
              onUpdateConvocations={async (eventId, convocations) => {
                try { await supabase.from('events').update({ convocations: convocations as any, convocations_published: true }).eq('id', eventId); toast.success('Convocations publiées !'); } catch (err: any) { toast.error('Erreur: ' + err.message); }
              }} />
          )}
          {activeTab === 'stats' && <StatsTab players={visiblePlayersForStats} events={events} cards={cards} attendanceRecords={attendanceRecords} members={visibleMembers} currentUser={currentUser} canManage={canManage} updatePlayerStats={updatePlayerStats} deletePlayer={deletePlayer} getPlayerCards={getPlayerCards} deleteCard={deleteCard} onAddCard={(playerId) => { setSelectedPlayerForCard(playerId); setShowAddCard(true); }} />}
          {activeTab === 'championnat' && <ChampionnatTab championships={championships} matches={champMatches} currentUserRole={currentUser?.role} canManage={canManage} canUpdateChampionnat={canUpdateChampionnat} onAddChampionship={addChampionship} onDeleteChampionship={deleteChampionship} onAddMatch={addChampMatch} onUpdateMatchScore={updateMatchScore} onDeleteMatch={deleteChampMatch} onRefreshFromFFF={refreshFromFFF} />}
          {activeTab === 'news' && <NewsTab news={news} comments={newsComments} members={members} currentUser={currentUser} canManage={canManage} canCreateNews={canCreateNews} deleteNews={deleteNews} toggleLike={toggleLike} addComment={addComment} deleteComment={deleteComment} onAddNews={() => setShowAddNews(true)} />}
          {activeTab === 'calendar' && <CalendarTab events={events} members={members} currentUser={currentUser} />}
          {activeTab === 'gallery' && <GalleryTab albums={albums} photos={galleryPhotos} currentUser={currentUser} canManagePhotos={canManagePhotos} onCreateAlbum={createAlbum} onDeleteAlbum={deleteAlbum} onUploadPhotos={uploadPhotos} onDeletePhoto={deletePhoto} />}
          {activeTab === 'members' && (
            <MembersTab members={visibleMembers} players={visiblePlayers} cards={cards} currentUser={currentUser} canManage={canManage} getPlayerCards={getPlayerCards} deletePlayer={deletePlayer} deleteMember={deleteMember}
              onResetPassword={(member) => { setSelectedMemberForReset(member); setShowAdminResetPassword(true); }}
              onInvitePlayer={() => setShowInvitePlayer(true)}
              onChangeRole={async (memberId, newRole, password) => {
                try {
                  const targetMember = members.find(m => m.id === memberId);
                  if (targetMember?.role === 'admin+') { toast.error("Le rôle Admin+ ne peut pas être modifié"); throw new Error('forbidden'); }
                  if ((targetMember?.role === 'admin' || newRole === 'admin' || newRole === 'admin+') && currentUser?.role !== 'admin+') { toast.error("Seul l'Admin+ peut modifier le rôle Administrateur"); throw new Error('forbidden'); }
                  // Re-auth with Supabase
                  const { error: authError } = await supabase.auth.signInWithPassword({ email: currentUser!.email, password });
                  if (authError) { toast.error('Mot de passe incorrect'); throw authError; }
                  await supabase.from('profiles').update({ role: newRole }).eq('id', memberId);
                  toast.success('Rôle mis à jour avec succès');
                } catch (err: any) {
                  if (err.message !== 'forbidden') toast.error('Erreur: ' + err.message);
                  throw err;
                }
              }}
              onChangePosition={async (playerId, newPosition) => {
                try { await supabase.from('players').update({ position: newPosition }).eq('id', playerId); toast.success('Poste mis à jour'); } catch (err: any) { toast.error('Erreur: ' + err.message); }
              }}
            />
          )}
        </div>
      </main>

      <ChatBubble currentUser={currentUser} members={members} chatOpen={chatOpen} setChatOpen={setChatOpen} />

      <footer className="border-t border-border bg-card px-3 py-3 sm:p-4 text-center mt-auto">
        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse shrink-0" />
          <span className="hidden sm:inline">Connecté au serveur — Synchro auto</span>
          <span className="sm:hidden">Connecté · Synchro auto</span>
        </div>
      </footer>

      {/* Modals */}
      {showAddPlayer && <AddPlayerForm onSubmit={addPlayer} onClose={() => setShowAddPlayer(false)} currentUser={currentUser} />}
      {showInvitePlayer && (
        <InvitePlayerForm currentUser={currentUser} onClose={() => setShowInvitePlayer(false)}
          onSubmit={async (data) => {
            try {
              if (currentUser?.role === 'entraineur') data.role = 'joueur';
              if (data.role === 'admin+' && currentUser?.role !== 'admin+') { toast.error("Seul l'Admin+ peut attribuer ce rôle"); return; }
              const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
              const { data: inv, error } = await supabase.from('invitations').insert({
                email: data.email || null, role: data.role, position: data.position || null,
                license_expiry: data.licenseExpiry || null, expires_at: expiresAt, invited_by: currentUser?.uid || '',
              }).select('id').single();
              if (error) throw error;
              const link = `${window.location.origin}/register?token=${inv.id}`;
              if (data.mode === 'email' && data.email) {
                try {
                  await supabase.functions.invoke('send-email', {
                    body: { to: data.email, subject: `Invitation à rejoindre FCO Manager`, html: `<p>${currentUser?.name || 'Un administrateur'} vous invite à rejoindre FCO Manager.<br><a href="${link}">Cliquer ici pour s'inscrire</a></p>` },
                  });
                  toast.success('Invitation envoyée par email !');
                } catch { toast.warning("Email non envoyé, mais le lien a été généré"); }
              } else { toast.success('Lien d\'invitation généré !'); }
              setShowInvitePlayer(false);
              setInviteResult({ email: data.email || '', link });
            } catch (err: any) { toast.error('Erreur: ' + err.message); }
          }}
        />
      )}
      {inviteResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setInviteResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4"><CheckCircle2 size={32} className="text-accent" /></div>
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
                <button onClick={() => { navigator.clipboard.writeText(inviteResult.link); toast.success('Lien copié !'); }} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Copier"><Copy size={14} className="text-muted-foreground" /></button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-2 px-2">📋 Vous pouvez aussi partager ce lien directement. Il expire dans 48h.</p>
            </div>
            <div className="p-4 border-t border-border">
              <button onClick={() => setInviteResult(null)} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all text-sm">Fermer</button>
            </div>
          </div>
        </div>
      )}
      {showAddEvent && <AddEventForm onSubmit={addEvent} onClose={() => setShowAddEvent(false)} isDirigeant={currentUser?.role === 'dirigeant'} />}
      {showAddNews && <AddNewsForm onSubmit={addNews} onClose={() => setShowAddNews(false)} />}
      {showAddCard && <AddCardForm players={visiblePlayers} selectedPlayerId={selectedPlayerForCard} onSubmit={addCard} onClose={() => { setShowAddCard(false); setSelectedPlayerForCard(null); }} />}
      {showChangePassword && <ChangePasswordForm onClose={() => setShowChangePassword(false)} />}
      {showAdminResetPassword && selectedMemberForReset && <AdminResetPasswordForm member={selectedMemberForReset} onClose={() => { setShowAdminResetPassword(false); setSelectedMemberForReset(null); }} />}
      {showAvatarModal && currentUser && <AvatarModal currentUser={currentUser} onClose={() => { setShowAvatarModal(false); setAvatarFocusLicense(false); }} onAvatarUpdated={(photoURL) => setCurrentUser({ ...currentUser, photoURL })} focusLicense={avatarFocusLicense} />}
      {showLicenseReminder && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowLicenseReminder(false)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-warning/10 rounded-2xl flex items-center justify-center mb-4"><Shield size={32} className="text-warning" /></div>
              <h3 className="text-lg font-bold text-foreground">Licence non renseignée</h3>
              <p className="text-sm text-muted-foreground mt-2 text-center">Votre date d'expiration de licence FFF n'est pas encore renseignée. Merci de la mettre à jour dans votre profil.</p>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowLicenseReminder(false)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">Plus tard</button>
              <button onClick={() => { setShowLicenseReminder(false); setAvatarFocusLicense(true); setShowAvatarModal(true); }} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-primary/20">Mettre à jour</button>
            </div>
          </div>
        </div>
      )}
      {confirmModal && <ConfirmModal title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onClose={() => setConfirmModal(null)} />}
      {playerCreatedResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setPlayerCreatedResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4"><CheckCircle2 size={32} className="text-accent" /></div>
              <h3 className="text-lg font-bold text-foreground">Joueur ajouté avec succès</h3>
              <p className="text-sm text-muted-foreground mt-1">{playerCreatedResult.name}</p>
            </div>
            {playerCreatedResult.withAccount && playerCreatedResult.email && (
              <div className="mx-6 mb-4 space-y-2">
                <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                  <Mail size={16} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</p><p className="text-sm font-medium text-foreground truncate">{playerCreatedResult.email}</p></div>
                  <button onClick={() => navigator.clipboard.writeText(playerCreatedResult.email || '')} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Copier"><Copy size={14} className="text-muted-foreground" /></button>
                </div>
                <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                  <KeyRound size={16} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mot de passe</p><p className="text-sm font-medium text-foreground font-mono">{playerCreatedResult.password}</p></div>
                  <button onClick={() => navigator.clipboard.writeText(playerCreatedResult.password || '')} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Copier"><Copy size={14} className="text-muted-foreground" /></button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-2 px-2">📋 Communique ces identifiants au joueur pour qu'il puisse se connecter</p>
              </div>
            )}
            <div className="p-4 border-t border-border"><button onClick={() => setPlayerCreatedResult(null)} className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20">Parfait !</button></div>
          </div>
        </div>
      )}
      {eventCreatedResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setEventCreatedResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4"><CalendarDays size={32} className="text-accent" /></div>
              <h3 className="text-lg font-bold text-foreground">Événement créé avec succès</h3>
              <p className="text-sm text-muted-foreground mt-1">{eventCreatedResult.title}</p>
            </div>
            <div className="mx-6 mb-4 space-y-2">
              <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50"><Calendar size={16} className="text-accent shrink-0" /><div className="flex-1"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</p><p className="text-sm font-medium text-foreground">{new Date(eventCreatedResult.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div></div>
              <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50"><Trophy size={16} className="text-accent shrink-0" /><div className="flex-1"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Type</p><p className="text-sm font-medium text-foreground">{eventCreatedResult.type === 'match' ? '⚽ Match' : eventCreatedResult.type === 'training' ? '🏃 Entraînement' : '📌 Autre'}</p></div></div>
              {eventCreatedResult.notified ? (
                <div className="flex items-center gap-3 p-3 bg-accent/5 rounded-xl border border-accent/20"><Bell size={16} className="text-accent shrink-0" /><div className="flex-1"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notifications</p><p className="text-sm font-medium text-accent">{eventCreatedResult.notifCount} joueur{eventCreatedResult.notifCount > 1 ? 's' : ''} notifié{eventCreatedResult.notifCount > 1 ? 's' : ''} par email</p></div></div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50"><Bell size={16} className="text-muted-foreground shrink-0" /><div className="flex-1"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notifications</p><p className="text-sm text-muted-foreground">Aucune notification envoyée</p></div></div>
              )}
            </div>
            <div className="p-4 border-t border-border"><button onClick={() => setEventCreatedResult(null)} className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20">Parfait !</button></div>
          </div>
        </div>
      )}

      {/* Welcome modal */}
      {welcomeName && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-4">
          <div className="relative max-w-sm w-full animate-[fadeSlideUp_0.6s_ease-out_both] overflow-hidden rounded-[2rem] bg-gradient-to-b from-card to-card/95 border border-border/50 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-60 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-primary/10 rounded-full blur-[60px] pointer-events-none" />
            <div className="relative z-10 px-8 pt-10 pb-8 text-center">
              <div className="relative inline-flex items-center justify-center mb-7">
                <div className="absolute w-24 h-24 rounded-full border border-primary/20 animate-[pulse_3s_ease-in-out_infinite]" />
                <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-primary/10"><img src={clubLogo} alt="FCO" className="w-13 h-13 object-contain drop-shadow-md" /></div>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary/60 mb-3">FCO Manager</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight">Bienvenue{' '}<span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{welcomeName}</span></h2>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">Ton espace est prêt !</p>
              <button onClick={() => setWelcomeName(null)} className="mt-8 w-full py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-primary/30">C'est parti ! 🚀</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
