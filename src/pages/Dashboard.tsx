import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getWebOrigin } from '@/lib/getWebOrigin';
import { sendInvitationEmail, sendEventEmail } from '@/lib/emailjs';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, TrendingUp, Bell, Calendar, CalendarDays, LogOut, Shield, Trophy, Lock, Menu, X, CheckCircle2, Mail, KeyRound, UserCheck, Copy, Camera, Dumbbell, UserCircle, Briefcase, MessageCircle, Coins, Hand, Send, Ticket, Smartphone
} from 'lucide-react';
import clubLogo from '@/assets/logo.png';
import { toast } from 'sonner';
import PresencesTab from '@/components/dashboard/PresencesTab';
import StatsTab from '@/components/dashboard/StatsTab';
import NewsTab from '@/components/dashboard/NewsTab';
import CalendarTab from '@/components/dashboard/CalendarTab';
import MembersTab from '@/components/dashboard/MembersTab';
import ChampionnatTab, { type Championship, type Match } from '@/components/dashboard/ChampionnatTab';
import GalleryTab, { type Album, type Photo } from '@/components/dashboard/GalleryTab';
import ChatTab from '@/components/dashboard/ChatTab';
import ParisTab from '@/components/dashboard/ParisTab';
// FloatingChatBubble removed — discussions is now a tab
import BottomTabBar from '@/components/dashboard/BottomTabBar';
import OnboardingTutorial from '@/components/dashboard/OnboardingTutorial';
import WinCelebration from '@/components/dashboard/WinCelebration';
import HomeTab from '@/components/dashboard/HomeTab';
import MatchSheetsTab, { type MatchSheet } from '@/components/dashboard/MatchSheetsTab';
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
import SendPushNotifForm from '@/components/modals/SendPushNotifForm';
import VersionManagerModal from '@/components/modals/VersionManagerModal';


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
  customX?: number;
  customY?: number;
  virtualName?: string; // For replacement players without an account
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
  absenceReasons?: Record<string, string>;
  convocations?: Record<string, Convocation>;
  convocationsPublished?: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  time?: string;
  location?: string;
  duration?: number;
  homeLogo?: string;
  awayLogo?: string;
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
  displayRole?: string;
  playerId?: string;
  photoURL?: string | null;
  createdAt: string;
  username?: string;
  licenseExpiry?: string;
  isGhost?: boolean;
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
  { id: 'chat', label: 'Discussions', icon: MessageCircle },
  { id: 'paris', label: 'Paris', icon: Ticket },
];

// ---- Supabase helpers: map DB snake_case → app camelCase ----
const mapPlayer = (r: any): Player => ({ id: r.id, name: r.name, position: r.position || 'Non défini', matches: r.matches ?? 0, goals: r.goals ?? 0, assists: r.assists ?? 0, licenseExpiry: r.license_expiry || undefined });
const sortPlayersStable = (list: Player[]) => [...list].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
const mapEvent = (r: any): Event => ({ id: r.id, title: r.title, date: r.date, type: r.type, team: r.team, reason: r.reason, recurrence: r.recurrence, presences: r.presences as any || {}, absenceReasons: r.absence_reasons as any || {}, convocations: r.convocations as any || {}, convocationsPublished: r.convocations_published ?? false, createdBy: r.created_by, createdByName: r.created_by_name, createdAt: r.created_at, time: r.time, location: r.location, duration: r.duration ?? undefined, homeLogo: r.home_logo || undefined, awayLogo: r.away_logo || undefined });
const filterGhostEvents = (events: Event[], userId?: string) => events.filter(e => e.reason !== '__ghost__' || e.createdBy === userId);
const mapNews = (r: any): NewsItem => ({ id: r.id, title: r.title, content: r.content, author: r.author, authorId: r.author_id, date: r.date, likes: r.likes || [] });
const mapMember = (r: any): Member => ({ id: r.id, name: r.name, email: r.email, role: r.role, displayRole: r.display_role || undefined, playerId: r.player_id, photoURL: r.photo_url, createdAt: r.created_at, username: r.username, licenseExpiry: r.license_expiry, isGhost: r.is_ghost ?? false });
const mapCard = (r: any): Card => ({ id: r.id, playerId: r.player_id, type: r.type as any, reason: r.reason, date: r.date, suspendedUntil: r.suspended_until });
const mapAttendance = (r: any): AttendanceRecord => ({ id: r.id, playerId: r.player_id, eventId: r.event_id, eventType: r.event_type, eventDate: r.event_date, status: r.status, savedAt: r.saved_at });
const mapComment = (r: any): NewsComment => ({ id: r.id, newsId: r.news_id, authorName: r.author_name, authorUid: r.author_uid, content: r.content, createdAt: r.created_at });
const mapChamp = (r: any): Championship => ({ id: r.id, name: r.name, season: r.season, teams: r.teams || [], fffUrl: r.fff_url, fffStandings: r.fff_standings || [], teamLogos: r.team_logos || {}, team: r.team, createdAt: r.created_at, fffLiveCache: r.fff_live_cache, fffRefreshedAt: r.fff_refreshed_at });
const mapMatch = (r: any): Match => ({ id: r.id, championshipId: r.championship_id, homeTeam: r.home_team, awayTeam: r.away_team, homeScore: r.home_score, awayScore: r.away_score, date: r.date, journee: r.journee, played: r.played ?? false });
const mapAlbum = (r: any): Album => ({ id: r.id, name: r.name, description: r.description, createdAt: r.created_at, createdBy: r.created_by, coverUrl: r.cover_url });
const mapPhoto = (r: any): Photo => ({ id: r.id, albumId: r.album_id, url: r.url, storagePath: r.storage_path, title: r.title, uploadedAt: r.uploaded_at, uploadedBy: r.uploaded_by, uploaderName: r.uploader_name });
const mapMatchSheet = (r: any): MatchSheet => ({ id: r.id, eventId: r.event_id, title: r.title, date: r.date, time: r.time, location: r.location, team: r.team, homeTeam: r.home_team, awayTeam: r.away_team, homeLogo: r.home_logo, awayLogo: r.away_logo, homeScore: r.home_score, awayScore: r.away_score, convocations: r.convocations || {}, createdAt: r.created_at, createdBy: r.created_by });

// Generate public URLs for photos (bucket is now public)
const getPublicPhotoUrls = (photos: Photo[]): Photo[] => {
  if (photos.length === 0) return photos;
  return photos.map(p => {
    const { data } = supabase.storage.from('photos').getPublicUrl(p.storagePath);
    return { ...p, url: data?.publicUrl || p.url };
  });
};

// ── Stale-While-Revalidate cache helpers ──
const CACHE_PREFIX = 'fco_cache_';
const CACHE_TTL = 10 * 60 * 1000; // 10 min — data older than this won't be shown from cache
const CACHE_FRESH = 2 * 60 * 1000; // 2 min — data younger than this skips background re-fetch

const writeCache = (key: string, data: any) => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota exceeded — ignore */ }
};

const readCache = <T,>(key: string, ignoreExpiry = false): T | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (!ignoreExpiry && Date.now() - ts > CACHE_TTL) return null; // stale
    return data as T;
  } catch { return null; }
};

/** Returns true if ALL core caches are younger than CACHE_FRESH */
const isCacheFresh = (): boolean => {
  try {
    const keys = ['players', 'events', 'news'];
    return keys.every(k => {
      const raw = localStorage.getItem(CACHE_PREFIX + k);
      if (!raw) return false;
      const { ts } = JSON.parse(raw);
      return Date.now() - ts < CACHE_FRESH;
    });
  } catch { return false; }
};
// Small component showing points in header
const HeaderPoints: React.FC<{ userId?: string }> = ({ userId }) => {
  const [pts, setPts] = useState<number | null>(() => {
    // Restore from cache instantly
    try { const c = localStorage.getItem(`fco_pts_${userId}`); if (c) return parseInt(c, 10); } catch {} return null;
  });
  const [showInfo, setShowInfo] = useState(false);
  useEffect(() => {
    if (!userId) return;
    supabase.from('user_points').select('balance').eq('user_id', userId).maybeSingle().then(({ data }) => {
      const b = data?.balance ?? 100;
      setPts(b);
      try { localStorage.setItem(`fco_pts_${userId}`, String(b)); } catch {}
    });
    // Subscribe to realtime updates for this user's points
    const channel = supabase
      .channel(`user_points_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_points', filter: `user_id=eq.${userId}` }, (payload: any) => {
        const newBalance = payload.new?.balance;
        if (typeof newBalance === 'number') { setPts(newBalance); try { localStorage.setItem(`fco_pts_${userId}`, String(newBalance)); } catch {} }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);
  if (pts === null) return null;
  return (
    <>
      <button onClick={() => setShowInfo(true)} className="inline-flex items-center gap-0.5 bg-amber-500/15 border border-amber-500/25 rounded-lg px-1.5 py-1 hover:bg-amber-500/25 transition-all">
        <Coins size={12} className="text-amber-400" />
        <span className="text-[10px] font-bold text-amber-400">{pts}</span>
      </button>
      {showInfo && createPortal(
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[70]" onClick={() => setShowInfo(false)}>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm border border-border shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center">
                  <Coins size={20} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Tes Points</h3>
                  <p className="text-xs text-muted-foreground">{pts} pts disponibles</p>
                </div>
              </div>
              <button onClick={() => setShowInfo(false)} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-secondary/60 rounded-xl p-4 border border-border">
                <p className="text-sm text-foreground font-semibold mb-2">À quoi servent les points ?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Les points sont une monnaie virtuelle du club. Tu peux les utiliser pour <b className="text-foreground">parier sur les matchs</b> du championnat et tenter de grimper au classement des parieurs !
                </p>
              </div>
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-foreground uppercase tracking-wider">Comment en gagner ?</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span><b className="text-foreground">+5 pts</b> — Répondre présent ou absent</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageCircle size={13} className="text-blue-400 shrink-0" />
                  <span><b className="text-foreground">+5 pts</b> — Commenter une actualité</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bell size={13} className="text-pink-400 shrink-0" />
                  <span><b className="text-foreground">+1 pt</b> — Liker une actualité</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Coins size={13} className="text-amber-400 shrink-0" />
                  <span><b className="text-foreground">Paris gagnés</b> — Remporte tes paris pour gagner plus !</span>
                </div>
              </div>
              <div className="bg-accent/10 rounded-xl p-3 border border-accent/20">
                <p className="text-xs text-accent font-semibold">💡 Astuce : Sois actif dans le club pour accumuler des points et parier gros sur les matchs !</p>
              </div>
            </div>
            <div className="p-5 pt-0">
              <button onClick={() => setShowInfo(false)} className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20">
                Compris !
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </>
  );
};

const Dashboard = () => {
  const { currentUser, logout, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  
  usePushNotifications(currentUser?.uid);
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || 'home';
  });
  const [hasOpenedParisTab, setHasOpenedParisTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') === 'paris';
  });

  useEffect(() => {
    if (activeTab === 'paris') setHasOpenedParisTab(true);
  }, [activeTab]);

  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const handleTabChange = (tab: string, eventId?: string) => { window.scrollTo(0, 0); setHeaderVisible(true); lastDirection.current = null; directionChangeY.current = 0; lastScrollY.current = 0; setPendingEventId(eventId || null); setActiveTab(tab); };
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
  const [unreadDiscussions, setUnreadDiscussions] = useState(0);
  const [matchSheets, setMatchSheets] = useState<MatchSheet[]>([]);
  // Track ghost event IDs from raw fetches (before filtering) to hide their match sheets for non-owners
  const [ghostEventIds, setGhostEventIds] = useState<Set<string>>(new Set());

  // Fetch unread discussions count
  useEffect(() => {
    if (!currentUser) return;
    const fetchUnread = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('unread_count')
        .contains('participants', [currentUser.uid]);
      if (data) {
        const total = data.reduce((sum: number, c: any) => {
          const uc = (c.unread_count as Record<string, number>) || {};
          return sum + (uc[currentUser.uid] || 0);
        }, 0);
        setUnreadDiscussions(total);
      }
    };
    fetchUnread();

    const channel = supabase
      .channel('discussions-unread')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Reset unread when viewing discussions
  useEffect(() => {
    if (activeTab === 'discussions') setUnreadDiscussions(0);
  }, [activeTab]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialMandatory, setTutorialMandatory] = useState(false);
  const [licenseNeedsReminder, setLicenseNeedsReminder] = useState(false);

  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const lastDirection = useRef<'up' | 'down' | null>(null);
  const directionChangeY = useRef(0);

  useEffect(() => {
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const currentY = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

        // Ignore bounce/elastic overscroll at top or bottom
        if (currentY < 0 || currentY > maxScroll) {
          lastScrollY.current = currentY;
          return;
        }
        // Near bottom — ignore small movements (elastic bounce)
        if (currentY >= maxScroll - 5) {
          lastScrollY.current = currentY;
          return;
        }

        if (currentY < 10) { setHeaderVisible(true); lastDirection.current = null; }
        else {
          const dir = currentY > lastScrollY.current ? 'down' : currentY < lastScrollY.current ? 'up' : lastDirection.current;
          if (dir !== lastDirection.current) {
            directionChangeY.current = lastScrollY.current;
            lastDirection.current = dir;
          }
          const delta = Math.abs(currentY - directionChangeY.current);
          if (delta > 50) {
            if (dir === 'down') { setHeaderVisible(false); setMobileMenuOpen(false); }
            else if (dir === 'up') setHeaderVisible(true);
          }
        }
        lastScrollY.current = currentY;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (rafId) cancelAnimationFrame(rafId); };
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
  const [showPushTest, setShowPushTest] = useState(false);
  const [showVersionManager, setShowVersionManager] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFocusLicense, setAvatarFocusLicense] = useState(false);
  const [showLicenseReminder, setShowLicenseReminder] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
   const [showInvitePlayer, setShowInvitePlayer] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; link: string } | null>(null);
  const [playerCreatedResult, setPlayerCreatedResult] = useState<{ name: string; email?: string; password?: string; withAccount: boolean } | null>(null);
  const [eventCreatedResult, setEventCreatedResult] = useState<{ title: string; date: string; type: string; notified: boolean; notifCount: number } | null>(null);

  // ═══ WIN CELEBRATION ═══
  const [winCelebration, setWinCelebration] = useState<{ totalWon: number; matchCount: number; seenAt: string } | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const checkUnseenWins = async () => {
      // Read last_win_seen_at from DB (persists across rebuilds, unlike localStorage)
      const { data: pointsRow } = await supabase
        .from('user_points')
        .select('last_win_seen_at')
        .eq('user_id', currentUser.uid)
        .maybeSingle();
      const lastSeen = (pointsRow as any)?.last_win_seen_at || '1970-01-01T00:00:00Z';

      const { data: wonBets } = await supabase
        .from('bets')
        .select('payout, settled_at')
        .eq('user_id', currentUser.uid)
        .eq('status', 'won')
        .gt('settled_at', lastSeen)
        .order('settled_at', { ascending: false });

      if (wonBets && wonBets.length > 0) {
        const settledWins = wonBets.filter(b => !!b.settled_at);
        const totalWon = settledWins.reduce((sum, b) => sum + (b.payout || 0), 0);
        const seenAt = settledWins[0]?.settled_at;
        if (totalWon > 0 && seenAt) {
          setWinCelebration({ totalWon, matchCount: settledWins.length, seenAt });
        }
      }
    };

    // Check after a small delay to let the app load first
    const timer = setTimeout(checkUnseenWins, 1500);

    // Also listen for realtime bet updates (in case user is on the app when settlement happens)
    const channel = supabase
      .channel(`win-celebration-${currentUser.uid}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bets',
        filter: `user_id=eq.${currentUser.uid}`,
      }, (payload: any) => {
        if (payload.new?.status === 'won' && payload.old?.status === 'pending') {
          // Delay slightly to batch multiple settlements
          setTimeout(checkUnseenWins, 2000);
        }
      })
      .subscribe();

    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [currentUser]);

  const handleCloseWinCelebration = async () => {
    const seenAt = winCelebration?.seenAt ?? new Date().toISOString();

    if (currentUser) {
      try {
        const { data: pointsRow, error: readError } = await supabase
          .from('user_points')
          .select('id')
          .eq('user_id', currentUser.uid)
          .maybeSingle();

        if (readError) throw readError;

        if (pointsRow?.id) {
          const { error: updateError } = await supabase
            .from('user_points')
            .update({ last_win_seen_at: seenAt, updated_at: new Date().toISOString() })
            .eq('id', pointsRow.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('user_points')
            .insert({
              user_id: currentUser.uid,
              balance: 100,
              total_bet: 0,
              total_won: 0,
              last_win_seen_at: seenAt,
            });
          if (insertError) throw insertError;
        }
      } catch (error) {
        console.error('Failed to persist win celebration state:', error);
      }
    }

    setWinCelebration(null);
  };

  const canManage = () => currentUser && (currentUser.role === 'admin+' || currentUser.role === 'admin' || currentUser.role === 'entraineur');
  const canManagePhotos = () => !!(currentUser && (currentUser.role === 'admin+' || currentUser.role === 'admin' || currentUser.role === 'photographe'));
  const canManageOwnPresence = (playerId: string) => {
    if (canManage()) return true;
    return currentUser && (currentUser.role === 'joueur' || currentUser.role === 'dirigeant') && currentUser.playerId === playerId;
  };
  const canCreateNews = () => currentUser && (canManage() || currentUser.role === 'dirigeant');
  const canCreateEvent = () => currentUser && (canManage() || currentUser.role === 'dirigeant');

  // Ghost filtering: hide ghost accounts from non-ghost users
  const isCurrentUserGhost = members.find(m => m.id === currentUser?.uid)?.isGhost;
  const ghostPlayerIds = members.filter(m => m.isGhost && m.playerId).map(m => m.playerId);

  const nonPlayerRoleIds = members.filter(m => (m.role === 'dirigeant' || m.role === 'photographe') && m.playerId).map(m => m.playerId);
  const visiblePlayers = isCurrentUserGhost ? players : players.filter(p => !ghostPlayerIds.includes(p.id));
  const visiblePlayersForStats = (isCurrentUserGhost ? players : players.filter(p => !ghostPlayerIds.includes(p.id))).filter(p => !nonPlayerRoleIds.includes(p.id));
  const visibleMembers = isCurrentUserGhost ? members : members.filter(m => !m.isGhost);
  const visibleMatchSheets = matchSheets.filter(ms => !ms.eventId || !ghostEventIds.has(ms.eventId));

  // ===== DATA LOADING via Supabase =====
  useEffect(() => {
    if (!currentUser) { navigate('/auth'); return; }

    // ── 1. Restore from cache instantly ──
    const cachedPlayers = readCache<Player[]>('players');
    const cachedEvents = readCache<Event[]>('events');
    const cachedNews = readCache<NewsItem[]>('news');
    const cachedMembers = readCache<Member[]>('members');
    const cachedCards = readCache<Card[]>('cards');
    const cachedAttendance = readCache<AttendanceRecord[]>('attendance');
    const cachedComments = readCache<NewsComment[]>('comments');
    const cachedChamps = readCache<Championship[]>('champs');
    const cachedMatches = readCache<Match[]>('matches');
    const cachedAlbums = readCache<Album[]>('albums');
    const cachedMatchSheets = readCache<MatchSheet[]>('matchSheets');

    if (cachedPlayers) setPlayers(cachedPlayers);
    if (cachedEvents) setEvents(cachedEvents);
    if (cachedNews) setNews(cachedNews);
    if (cachedMembers) setMembers(cachedMembers);
    if (cachedCards) setCards(cachedCards);
    if (cachedAttendance) setAttendanceRecords(cachedAttendance);
    if (cachedComments) setNewsComments(cachedComments);
    if (cachedChamps) setChampionships(cachedChamps);
    if (cachedMatches) setChampMatches(cachedMatches);
    if (cachedAlbums) setAlbums(cachedAlbums);
    if (cachedMatchSheets) setMatchSheets(cachedMatchSheets);

    const hasCache = cachedPlayers || cachedEvents || cachedNews;
    if (hasCache) setLoading(false); // show cached data immediately

    // ── 2. Skip background fetch if cache is very fresh (< 2 min) ──
    const skipFetch = hasCache && isCacheFresh();

    const fetchAll = async () => {
      try {
        const [
          { data: playersData }, { data: eventsData }, { data: newsData },
          { data: membersData }, { data: cardsData }, { data: attendanceData },
          { data: commentsData }, { data: champsData }, { data: matchesData },
          { data: albumsData }, { data: matchSheetsData }
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
          supabase.from('match_sheets').select('*').order('date', { ascending: false }),
        ]);

        const allEvents = (eventsData || []).map(mapEvent);
        setGhostEventIds(new Set(allEvents.filter(e => e.reason === '__ghost__' && e.createdBy !== currentUser?.uid).map(e => e.id)));
        const freshPlayers = sortPlayersStable((playersData || []).map(mapPlayer));
        const freshEvents = filterGhostEvents(allEvents, currentUser?.uid);
        const freshNews = (newsData || []).map(mapNews);
        const freshMembers = (membersData || []).map(mapMember);
        const freshCards = (cardsData || []).map(mapCard);
        const freshAttendance = (attendanceData || []).map(mapAttendance);
        const freshComments = (commentsData || []).map(mapComment);
        const freshChamps = (champsData || []).map(mapChamp);
        const freshMatches = (matchesData || []).map(mapMatch);
        const freshAlbums = (albumsData || []).map(mapAlbum);
        const freshMatchSheets = (matchSheetsData || []).map(mapMatchSheet);
        setPlayers(freshPlayers);
        setEvents(freshEvents);
        setNews(freshNews);
        setMembers(freshMembers);
        setCards(freshCards);
        setAttendanceRecords(freshAttendance);
        setNewsComments(freshComments);
        setChampionships(freshChamps);
        setChampMatches(freshMatches);
        setAlbums(freshAlbums);
        setMatchSheets(freshMatchSheets);
        // Write to cache for next visit
        writeCache('players', freshPlayers);
        writeCache('events', freshEvents);
        writeCache('news', freshNews);
        writeCache('members', freshMembers);
        writeCache('cards', freshCards);
        writeCache('attendance', freshAttendance);
        writeCache('comments', freshComments);
        writeCache('champs', freshChamps);
        writeCache('matches', freshMatches);
        writeCache('albums', freshAlbums);
        writeCache('matchSheets', freshMatchSheets);

        setLoading(false);
      } catch (err: any) {
        // Network error: fall back to ANY cached data (ignore expiry)
        if (!hasCache) {
          const fallback = (k: string) => {
            try {
              const raw = localStorage.getItem(CACHE_PREFIX + k);
              if (!raw) return null;
              return JSON.parse(raw).data;
            } catch { return null; }
          };
          const fp = fallback('players'); if (fp) setPlayers(fp);
          const fe = fallback('events'); if (fe) setEvents(fe);
          const fn = fallback('news'); if (fn) setNews(fn);
          const fm = fallback('members'); if (fm) setMembers(fm);
          const fc = fallback('cards'); if (fc) setCards(fc);
          const fa = fallback('attendance'); if (fa) setAttendanceRecords(fa);
          const fco = fallback('comments'); if (fco) setNewsComments(fco);
          const fch = fallback('champs'); if (fch) setChampionships(fch);
          const fma = fallback('matches'); if (fma) setChampMatches(fma);
          const fal = fallback('albums'); if (fal) setAlbums(fal);
          const fms = fallback('matchSheets'); if (fms) setMatchSheets(fms);
        }
        setLoading(false);
        // Don't set error — show stale data silently
      }
    };

    if (!skipFetch) {
      fetchAll();
    } else {
      setLoading(false);
    }

    // Re-fetch when network comes back online
    const handleOnline = () => { fetchAll(); };
    window.addEventListener('online', handleOnline);

    // Trigger cleanup max 1x/hour (deduplicated via localStorage)
    const CLEANUP_KEY = 'fco_cleanup_ts';
    const CLEANUP_TTL = 60 * 60 * 1000; // 1 hour
    try {
      const lastCleanup = parseInt(localStorage.getItem(CLEANUP_KEY) || '0', 10);
      if (Date.now() - lastCleanup > CLEANUP_TTL) {
        localStorage.setItem(CLEANUP_KEY, String(Date.now()));
        supabase.functions.invoke('cleanup-old-events').catch(() => {});
      }
    } catch { supabase.functions.invoke('cleanup-old-events').catch(() => {}); }

    // Daily bonus removed — was generating too many DB rows

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
          if (playersData) setPlayers(sortPlayersStable(playersData.map(mapPlayer)));
        } catch (err) { console.warn('iOS hot poll error:', err); }
      };

      const fetchCold = async () => {
        try {
          const [{ data: evData }, { data: memData }, { data: cardsData }, { data: champsData }, { data: matchData }, { data: albData }] = await Promise.all([
            supabase.from('events').select('*').order('date', { ascending: false }),
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('cards').select('*').order('date', { ascending: false }),
            supabase.from('championships').select('*'),
            supabase.from('championship_matches').select('*'),
            supabase.from('albums').select('*').order('created_at', { ascending: false }),
          ]);
          if (evData) {
            const allEv = evData.map(mapEvent);
            setGhostEventIds(new Set(allEv.filter(e => e.reason === '__ghost__' && e.createdBy !== currentUser?.uid).map(e => e.id)));
            setEvents(filterGhostEvents(allEv, currentUser?.uid));
          }
          if (memData) setMembers(memData.map(mapMember));
          if (cardsData) setCards(cardsData.map(mapCard));
          if (champsData) setChampionships(champsData.map(mapChamp));
          if (matchData) setChampMatches(matchData.map(mapMatch));
          if (albData) setAlbums(albData.map(mapAlbum));
        } catch (err) { console.warn('iOS cold poll error:', err); }
      };

      const hotInterval = setInterval(fetchHot, 15000);   // was 5s → now 15s
      const coldInterval = setInterval(fetchCold, 60000);  // was 30s → now 60s

      return () => { clearInterval(hotInterval); clearInterval(coldInterval); window.removeEventListener('online', handleOnline); };
    }

    // === Web/Android: Supabase Realtime subscriptions ===
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        // Skip realtime refetch if we just did an optimistic stat update (avoid race condition)
        if (Date.now() - statsUpdateLock.current < 3000) return;
        supabase.from('players').select('*').then(({ data }) => data && setPlayers(sortPlayersStable(data.map(mapPlayer))));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        supabase.from('events').select('*').order('date', { ascending: false }).then(({ data }) => {
          if (!data) return;
          const allEv = data.map(mapEvent);
          setGhostEventIds(new Set(allEv.filter(e => e.reason === '__ghost__' && e.createdBy !== currentUser?.uid).map(e => e.id)));
          setEvents(filterGhostEvents(allEv, currentUser?.uid));
        });
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
        if (galleryLoadedRef.current) {
          supabase.from('gallery_photos').select('*').then(({ data }) => data && setGalleryPhotos(getPublicPhotoUrls(data.map(mapPhoto))));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_sheets' }, () => {
        supabase.from('match_sheets').select('*').order('date', { ascending: false }).then(({ data }) => data && setMatchSheets(data.map(mapMatchSheet)));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); window.removeEventListener('online', handleOnline); };
  }, [currentUser, navigate]);

  // ── Lazy-load gallery photos only when gallery tab is opened ──
  const galleryLoadedRef = useRef(false);
  useEffect(() => {
    if (activeTab !== 'gallery' || galleryLoadedRef.current) return;
    galleryLoadedRef.current = true;
    const loadPhotos = async () => {
      const { data: photosData } = await supabase.from('gallery_photos').select('*');
      if (photosData) {
        setGalleryPhotos(getPublicPhotoUrls(photosData.map(mapPhoto)));
      }
    };
    loadPhotos();
  }, [activeTab]);


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

  // License check — throttled to once per month
  useEffect(() => {
    if (!currentUser || ['photographe', 'admin', 'admin+'].includes(currentUser.role)) return;
    const LICENSE_REMINDER_KEY = 'fco_license_reminder_ts';
    const LICENSE_REMINDER_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
    try {
      const lastReminder = parseInt(localStorage.getItem(LICENSE_REMINDER_KEY) || '0', 10);
      if (Date.now() - lastReminder < LICENSE_REMINDER_TTL) return;
    } catch {}
    const checkLicense = async () => {
      try {
        const { data: profile } = await supabase.from('profiles').select('license_expiry').eq('id', currentUser.uid).single();
        let playerLicense: string | null = null;
        if (currentUser.playerId) {
          const { data: player } = await supabase.from('players').select('license_expiry').eq('id', currentUser.playerId).single();
          playerLicense = player?.license_expiry || null;
        }
        if (!(profile?.license_expiry || playerLicense)) {
          try { localStorage.setItem(LICENSE_REMINDER_KEY, String(Date.now())); } catch {}
          if (!showTutorial) {
            setShowLicenseReminder(true);
          } else {
            setLicenseNeedsReminder(true);
          }
        }
      } catch (err) { console.warn('License check error:', err); }
    };
    checkLicense();
  }, [currentUser]);

  const handleLogout = async () => { await logout(); navigate('/auth'); };

  // CRUD functions — all Supabase
  const togglePresence = async (eventId: string, playerId: string, status: string, absenceReason?: string) => {
    if (!canManageOwnPresence(playerId) && !canManage()) { toast.warning('Vous ne pouvez gérer que votre propre présence'); return; }
    const event = events.find(e => e.id === eventId);
    const currentPresences = { ...(event?.presences || {}) };
    const currentReasons = { ...(event?.absenceReasons || {}) };
    const isToggleOff = currentPresences[playerId] === status;
    if (isToggleOff) { delete currentPresences[playerId]; delete currentReasons[playerId]; }
    else {
      currentPresences[playerId] = status;
      if (status === 'absent' && absenceReason?.trim()) {
        currentReasons[playerId] = absenceReason.trim();
      } else {
        delete currentReasons[playerId];
      }
    }
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, presences: currentPresences, absenceReasons: currentReasons } : e));

    // Use RPC for own presence (players), direct update for managers
    let error: any = null;
    const isOwnPresence = currentUser?.playerId === playerId;
    if (isOwnPresence && !canManage()) {
      const newStatus = isToggleOff ? '' : status;
      const { error: rpcErr } = await supabase.rpc('update_event_presence', {
        p_event_id: eventId,
        p_status: newStatus || 'absent',
        p_absence_reason: (status === 'absent' && !isToggleOff && absenceReason?.trim()) ? absenceReason.trim() : null,
      });
      error = rpcErr;
    } else {
      const { error: updateErr } = await supabase.from('events').update({ presences: currentPresences, absence_reasons: currentReasons }).eq('id', eventId);
      error = updateErr;
    }
    if (error) { toast.error('Erreur: ' + error.message); return; }

    // Points logic for presence (match or training only)
    if (isOwnPresence && currentUser && (event?.type === 'match' || event?.type === 'training')) {
      const txDesc = `Présence:${eventId}`;
      try {
        if (isToggleOff) {
          // Remove points if toggling off
          const { data: existingTx } = await supabase.from('points_transactions').select('id').eq('user_id', currentUser.uid).eq('type', 'presence').eq('description', txDesc).maybeSingle();
          if (existingTx) {
            const { data: pts } = await supabase.from('user_points').select('id, balance').eq('user_id', currentUser.uid).maybeSingle();
            if (pts) await supabase.from('user_points').update({ balance: Math.max(0, pts.balance - 5), updated_at: new Date().toISOString() }).eq('id', pts.id);
            await supabase.from('points_transactions').delete().eq('id', existingTx.id);
            // Points removed silently
          }
        } else {
          // Award points only if not already rewarded for this event
          const { data: alreadyRewarded } = await supabase.from('points_transactions').select('id').eq('user_id', currentUser.uid).eq('type', 'presence').eq('description', txDesc).maybeSingle();
          if (!alreadyRewarded) {
            const { data: existing } = await supabase.from('user_points').select('id, balance').eq('user_id', currentUser.uid).maybeSingle();
            if (existing) {
              await supabase.from('user_points').update({ balance: existing.balance + 5, updated_at: new Date().toISOString() }).eq('id', existing.id);
            } else {
              await supabase.from('user_points').insert({ user_id: currentUser.uid, balance: 105 });
            }
            await supabase.from('points_transactions').insert({ user_id: currentUser.uid, amount: 5, type: 'presence', description: txDesc });
            // Points awarded silently
          }
        }
      } catch (err) { console.warn('Points award error:', err); }
    }
  };

  const addPlayer = async (playerData: any) => {
    if (!canManage()) return;
    if (currentUser?.role === 'entraineur') playerData.role = 'joueur';
    if (playerData.role === 'admin+' && currentUser?.role !== 'admin+') { toast.error("Seul l'Admin+ peut attribuer ce rôle"); return; }

    // Anti-doublon : vérifier si un joueur avec le même nom existe déjà (ignorer accents + casse)
    const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const normalizedName = stripAccents(playerData.name);
    const existingPlayer = players.find(p => stripAccents(p.name) === normalizedName);
    if (existingPlayer) {
      toast.error(`Un joueur nommé "${existingPlayer.name}" existe déjà`);
      return;
    }

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
    const targetPlayer = players.find(p => p.id === playerId);
    setConfirmModal({
      title: 'Supprimer ce joueur ?',
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        try {
          // Find and delete linked profile
          const { data: linked } = await supabase.from('profiles').select('id, email, role').eq('player_id', playerId);
          if (linked && linked.length > 0) {
            await supabase.from('profiles').delete().eq('id', linked[0].id);
          }
          await supabase.from('players').delete().eq('id', playerId);
          // Audit log
          await supabase.from('audit_logs').insert({
            action: 'delete_player',
            target_name: targetPlayer?.name || 'Inconnu',
            target_email: linked?.[0]?.email || null,
            target_role: linked?.[0]?.role || null,
            performed_by: currentUser?.uid,
            performed_by_name: currentUser?.name || 'Inconnu',
            details: { player_id: playerId, had_profile: !!(linked && linked.length > 0) }
          });
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
          // Delete related data first to avoid FK constraint errors
          if (playerId) {
            await supabase.from('cards').delete().eq('player_id', playerId);
            await supabase.from('attendance_records').delete().eq('player_id', playerId);

            // Remove player from all event presences (JSONB cleanup)
            const eventsWithPresence = events.filter(e => e.presences && (e.presences as any)[playerId]);
            for (const evt of eventsWithPresence) {
              const updatedPresences = { ...(evt.presences as any) };
              delete updatedPresences[playerId];
              await supabase.from('events').update({ presences: updatedPresences }).eq('id', evt.id);
            }
          }
          // Delete user role
          await supabase.from('user_roles').delete().eq('user_id', memberId);
          // Delete profile
          const { error: profileError } = await supabase.from('profiles').delete().eq('id', memberId);
          if (profileError) throw profileError;
          // Delete player last
          if (playerId) {
            await supabase.from('players').delete().eq('id', playerId);
          }
          toast.success('Membre supprimé avec succès');
          setMembers(prev => prev.filter(m => m.id !== memberId));
          if (playerId) {
            setPlayers(prev => prev.filter(p => p.id !== playerId));
            // Update local events state to reflect cleaned presences
            setEvents(prev => prev.map(e => {
              if (e.presences && (e.presences as any)[playerId]) {
                const cleaned = { ...(e.presences as any) };
                delete cleaned[playerId];
                return { ...e, presences: cleaned };
              }
              return e;
            }));
          }
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
      const sendNotification = eventData.sendNotification;
      delete eventData.sendNotification;

      const typeLabels: Record<string, string> = { match: 'Match', training: 'Entraînement', other: 'Événement' };
      const notifiableRoles = ['admin+', 'admin', 'entraineur', 'dirigeant', 'joueur'];
      const targetMembers = members.filter(m => notifiableRoles.includes(m.role));
      const memberEmails = [...new Set(targetMembers.map(m => m.email).filter(Boolean))];

      setShowAddEvent(false);
      const isNotifiable = eventData.type === 'match' || eventData.type === 'training';
      setEventCreatedResult({ title: eventData.title, date: eventData.date, type: eventData.type, notified: sendNotification && isNotifiable, notifCount: (sendNotification && isNotifiable) ? memberEmails.length : 0 });

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
            duration: eventData.duration || null,
            home_logo: eventData.homeLogo || null,
            away_logo: eventData.awayLogo || null,
          } as any);

          // Only send push notifications for match and training (no email)
          if (sendNotification && isNotifiable) {
            const typeIcons: Record<string, string> = { match: '🏟️', training: '🏋️', other: '📅' };
            const dateFormatted = new Date(eventData.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const timeFormatted = eventData.time ? ` à ${eventData.time}` : '';
            const locationInfo = eventData.location ? `\n📍 ${eventData.location}` : '';
            const creatorName = currentUser?.name || 'Un membre';
            const pushTitle = `${typeIcons[eventData.type] || '📅'} Nouvel événement`;
            const pushBody = `${creatorName} a publié un nouveau ${(typeLabels[eventData.type] || 'événement').toLowerCase()} :\n${eventData.title}\n📅 ${dateFormatted}${timeFormatted}${locationInfo}\n\nConfirme ta présence sur l'app ! 💪`;

            const { data: tokenRows } = await supabase.from('fcm_tokens').select('token');
            const fcmTokens = [...new Set((tokenRows || []).map((r: any) => r.token).filter(Boolean))];
            if (fcmTokens.length > 0) {
              await supabase.functions.invoke('send-push-notification', {
                body: { title: pushTitle, body: pushBody, data: { tab: 'presences' }, tokens: fcmTokens },
              }).catch(e => console.error('Push error:', e));
            }
          }
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
    const isGhost = event?.reason === '__ghost__';
    setConfirmModal({
      title: 'Supprimer cet événement ?',
      message: isGhost ? 'Cet événement fantôme sera supprimé définitivement sans archivage.' : 'Les données de présence seront archivées avant la suppression.',
      onConfirm: async () => {
        // Optimistic delete: remove from UI immediately
        setEvents(prev => prev.filter(e => e.id !== eventId));
        try {
          // Skip archiving for ghost events
          if (!isGhost && event && event.presences) {
            const records = Object.entries(event.presences)
              .filter(([, status]) => status === 'present' || status === 'absent')
              .map(([playerId, status]) => ({
                player_id: playerId, event_id: eventId, event_type: event.type,
                event_date: event.date, status,
              }));
            if (records.length > 0) await supabase.from('attendance_records').insert(records);
          }
          await supabase.from('events').delete().eq('id', eventId);
          // Also delete associated match sheet for ghost events
          if (isGhost) {
            await supabase.from('match_sheets').delete().eq('event_id', eventId);
          }
        } catch (err: any) {
          // Restore on error
          if (event) setEvents(prev => [event, ...prev]);
          toast.error('Erreur: ' + err.message);
        }
      }
    });
  };

  const renameEvent = async (eventId: string, newTitle: string) => {
    try {
      const { error } = await supabase.from('events').update({ title: newTitle }).eq('id', eventId);
      if (error) throw error;
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, title: newTitle } : e));
      toast.success('Titre modifié');
    } catch (err: any) {
      toast.error('Erreur : ' + (err.message || 'impossible de renommer'));
    }
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

    // Award 1 point for liking (not un-liking)
    if (!isLiked) {
      try {
        const { data: existing } = await supabase.from('user_points').select('id, balance').eq('user_id', currentUser.uid).maybeSingle();
        if (existing) {
          await supabase.from('user_points').update({ balance: existing.balance + 1, updated_at: new Date().toISOString() }).eq('id', existing.id);
        } else {
          await supabase.from('user_points').insert({ user_id: currentUser.uid, balance: 101 });
        }
        await supabase.from('points_transactions').insert({ user_id: currentUser.uid, amount: 1, type: 'like', description: `Like sur : ${newsItem.title}` });
        toast.success('+1 pt de pari ajouté !', { icon: '❤️' });
      } catch (err) { console.warn('Like points error:', err); }
    }
  };

  const addComment = async (newsId: string, content: string) => {
    if (!currentUser || !content.trim()) return;
    const newsItem = news.find(n => n.id === newsId);
    const tempId = `temp-${Date.now()}`;
    const newComment: NewsComment = { id: tempId, newsId, authorName: currentUser.name, authorUid: currentUser.uid, content: content.trim(), createdAt: new Date().toISOString() };
    setNewsComments(prev => [...prev, newComment]);
    const { error } = await supabase.from('news_comments').insert({
      news_id: newsId, author_name: currentUser.name, author_uid: currentUser.uid, content: content.trim(),
    });
    if (error) { setNewsComments(prev => prev.filter(c => c.id !== tempId)); console.error('Error adding comment:', error); return; }

    // Award 5 points for commenting
    try {
      const { data: existing } = await supabase.from('user_points').select('id, balance').eq('user_id', currentUser.uid).maybeSingle();
      if (existing) {
        await supabase.from('user_points').update({ balance: existing.balance + 5, updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await supabase.from('user_points').insert({ user_id: currentUser.uid, balance: 105 });
      }
      await supabase.from('points_transactions').insert({ user_id: currentUser.uid, amount: 5, type: 'comment', description: `Commentaire sur : ${newsItem?.title || 'Actu'}` });
      // Points awarded silently
    } catch (err) { console.warn('Comment points error:', err); }
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

  // Guard to prevent realtime from overwriting optimistic stat updates
  const statsUpdateLock = React.useRef<number>(0);

  const updatePlayerStats = async (playerId: string, field: string, value: string) => {
    if (!canManage()) return;
    const numVal = parseInt(value);
    // Don't save NaN (empty field while typing)
    if (isNaN(numVal)) return;
    const safeVal = Math.max(0, numVal);
    // Lock realtime refetch for 3 seconds to avoid overwriting optimistic update
    statsUpdateLock.current = Date.now();
    // Optimistic update (keep stable sort)
    setPlayers(prev => sortPlayersStable(prev.map(p => p.id === playerId ? { ...p, [field]: safeVal } : p)));
    const { error } = await supabase.from('players').update({ [field]: safeVal }).eq('id', playerId);
    if (error) {
      console.error('Error updating stats:', error);
      toast.error('Erreur lors de la sauvegarde des stats');
      // Revert: refetch from DB
      const { data } = await supabase.from('players').select('*');
      if (data) setPlayers(sortPlayersStable(data.map(mapPlayer)));
    }
  };

  const getPlayerCards = (playerId: string) => cards.filter(c => c.playerId === playerId);

  // Championship CRUD
  const addChampionship = async (data: { name: string; season: string; teams: string[]; team?: string; fffUrl?: string; matches?: Array<{ homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null; date: string; journee: number; played: boolean }>; standings?: Array<any>; teamLogos?: Record<string, string> }) => {
    if (!canManage()) return;
    try {
      const { matches: importedMatches, standings, teamLogos, ...champData } = data;
      const { data: inserted, error } = await supabase.from('championships').insert({
        name: champData.name, season: champData.season, teams: champData.teams,
        fff_url: champData.fffUrl || null, fff_standings: standings || [], team_logos: teamLogos || {},
        team: (champData as any).team || 'A',
      }).select('id').single();
      if (error) throw error;
      if (importedMatches && importedMatches.length > 0) {
        const rows = importedMatches.map(m => ({
          championship_id: inserted.id, home_team: m.homeTeam, away_team: m.awayTeam,
          home_score: m.homeScore, away_score: m.awayScore, date: m.date, journee: m.journee, played: m.played,
        }));
        await supabase.from('championship_matches').insert(rows);
      }
      // Refetch immédiat pour actualisation sans attendre le realtime
      const { data: updatedChamps } = await supabase.from('championships').select('*');
      if (updatedChamps) setChampionships(updatedChamps.map(c => ({
        id: c.id, name: c.name, season: c.season, teams: c.teams || [],
        team: c.team || 'A', fffUrl: c.fff_url || undefined,
        fffStandings: (c.fff_standings as any) || [], teamLogos: (c.team_logos as any) || {},
        createdAt: c.created_at,
      })));
      const { data: updatedMatches } = await supabase.from('championship_matches').select('*');
      if (updatedMatches) setChampMatches(updatedMatches.map(m => ({
        id: m.id, championshipId: m.championship_id, homeTeam: m.home_team, awayTeam: m.away_team,
        homeScore: m.home_score, awayScore: m.away_score, date: m.date, journee: m.journee, played: m.played ?? false,
      })));
      toast.success('Championnat ajouté !');
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
  };

  const canUpdateChampionnat = () => currentUser && (currentUser.role === 'admin' || currentUser.role === 'admin+' || currentUser.role === 'entraineur' || currentUser.role === 'joueur');

  const refreshFromFFF = async (championshipId: string, fffUrl: string): Promise<{ success: boolean; updated: number; added: number; standingsCount: number; error?: string }> => {
    
    if (!canUpdateChampionnat()) return { success: false, updated: 0, added: 0, standingsCount: 0, error: 'Non autorisé' };
    try {
      const { decodeFFFApiRef, getClassement, getResultats, getCalendrier, mapClassementToStandings, mapMatchesToScrapedMatches, extractTeamLogosFromClassement } = await import('@/lib/fffApi');
      const apiRef = decodeFFFApiRef(fffUrl);
      if (!apiRef) return { success: false, updated: 0, added: 0, standingsCount: 0, error: 'Référence API FFF invalide' };

      const [classementData, resultatsData, calendrierData] = await Promise.all([
        getClassement(apiRef.cpNo, apiRef.phase, apiRef.poule).catch(() => null),
        getResultats(apiRef.cpNo, apiRef.phase, apiRef.poule).catch(() => null),
        getCalendrier(apiRef.cpNo, apiRef.phase, apiRef.poule).catch(() => null),
      ]);

      const standings = mapClassementToStandings(classementData);
      const resultMatches = mapMatchesToScrapedMatches(resultatsData);
      const calendarMatches = mapMatchesToScrapedMatches(calendrierData);
      const logos = extractTeamLogosFromClassement(classementData);

      // Merge matches
      const allNewMatches = [...resultMatches];
      const seen = new Set(resultMatches.map(m => `${m.homeTeam}-${m.awayTeam}-${m.date}`));
      for (const m of calendarMatches) {
        const key = `${m.homeTeam}-${m.awayTeam}-${m.date}`;
        if (!seen.has(key)) { allNewMatches.push(m); seen.add(key); }
      }

      const updateData: Record<string, any> = {};
      if (standings.length > 0) updateData.fff_standings = standings;
      if (Object.keys(logos).length > 0) updateData.team_logos = logos;
      if (Object.keys(updateData).length > 0) await supabase.from('championships').update(updateData).eq('id', championshipId);

      const existingMatches = champMatches.filter(m => m.championshipId === championshipId);
      let updated = 0, added = 0;

      for (const scraped of allNewMatches) {
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
      return { success: true, updated, added, standingsCount: standings.length };
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

  const updateChampionship = async (id: string, updates: { team?: string }) => {
    try {
      await supabase.from('championships').update(updates).eq('id', id);
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
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
      // iOS peut envoyer des fichiers sans type MIME correct, on le force
      let uploadFile = file;
      if (!file.type || file.type === 'application/octet-stream') {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };
        const mime = mimeMap[ext] || 'image/jpeg';
        uploadFile = new File([file], file.name, { type: mime });
      }

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('albumId', albumId);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erreur upload');
      }
      const { url, path } = await res.json();
      await supabase.from('gallery_photos').insert({
        album_id: albumId, url, storage_path: path,
        title: file.name.replace(/\.[^/.]+$/, ''), uploaded_by: currentUser!.uid, uploader_name: currentUser!.name,
      });
      // Optimistically add photo to state so it appears immediately
      const newPhoto: Photo = {
        id: crypto.randomUUID(),
        albumId,
        url,
        storagePath: path,
        title: file.name.replace(/\.[^/.]+$/, ''),
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser!.uid,
        uploaderName: currentUser!.name,
      };
      setGalleryPhotos(prev => [newPhoto, ...prev]);
    }
    const { data: photosData } = await supabase.from('gallery_photos').select('*');
    if (photosData) {
      setGalleryPhotos(getPublicPhotoUrls(photosData.map(mapPhoto)));
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
  // Build a team→logo map from events for match sheet logo fallback
  const teamLogoMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const ev of events) {
      if (ev.homeLogo && ev.title) {
        const parts = ev.title.split(/\s+vs\s+/i);
        if (parts[0]) map[parts[0].trim().toUpperCase()] = ev.homeLogo;
        if (parts[1]) map[parts[1].trim().toUpperCase()] = ev.awayLogo || ev.homeLogo;
      }
      if (ev.awayLogo && ev.title) {
        const parts = ev.title.split(/\s+vs\s+/i);
        if (parts[1]) map[parts[1].trim().toUpperCase()] = ev.awayLogo;
        if (parts[0] && !map[parts[0].trim().toUpperCase()]) map[parts[0].trim().toUpperCase()] = ev.homeLogo || ev.awayLogo;
      }
    }
    return map;
  }, [events]);

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
    <div className="min-h-screen bg-secondary/30 flex flex-col pb-24">
      {/* Header */}
      {/* Header */}
      <header className={`bg-primary border-b border-primary/80 sticky z-50 pt-[env(safe-area-inset-top)] transition-transform duration-300 ease-in-out lg:translate-y-0 lg:top-0 ${headerVisible ? 'top-0 translate-y-0' : 'top-0 -translate-y-full'}`}>
        <div className="mx-auto px-3 sm:px-6 lg:px-10">
          <div className="flex justify-between items-center h-16 lg:h-20 overflow-hidden">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
              <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-white/20 rounded-xl flex items-center justify-center shadow-md border border-white/15 shrink-0">
                  <img src={clubLogo} alt="FCO Logo" className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 object-contain drop-shadow-md" />
                </div>
                <h1 className="text-sm sm:text-lg lg:text-xl font-bold text-primary-foreground leading-tight whitespace-nowrap">FCO Manager</h1>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button onClick={() => setShowAvatarModal(true)} className="flex items-center gap-1.5 sm:gap-2.5 px-1 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:bg-white/10 transition-all group">
                <div className="relative shrink-0">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/15 flex items-center justify-center overflow-hidden ring-2 ring-white/20 group-hover:ring-accent transition-all">
                    {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-[9px] sm:text-xs font-bold text-primary-foreground">{currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-3 sm:h-3 bg-success rounded-full border-2 border-primary" />
                </div>
                <div className="hidden lg:block text-left min-w-0 max-w-[160px]">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-primary-foreground leading-tight truncate">{currentUser?.name}</span>
                    {currentUser?.role === 'admin+' && !currentUser?.displayRole && <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-primary-foreground/50 uppercase tracking-wider">
                    {(() => {
                      const visualRole = currentUser?.displayRole || currentUser?.role;
                      const isAdminWithDisplay = currentUser?.displayRole && (currentUser?.role === 'admin' || currentUser?.role === 'admin+') && currentUser?.displayRole !== currentUser?.role;
                      return (
                        <>
                          {visualRole === 'admin+' ? <><Shield size={9} className="text-accent shrink-0" /><span className="truncate">Super Admin</span></> :
                           visualRole === 'admin' ? <><Shield size={9} className="shrink-0" /><span className="truncate">Admin</span></> :
                           visualRole === 'entraineur' ? <><Dumbbell size={9} className="shrink-0" /><span className="truncate">Entraîneur</span></> :
                           visualRole === 'photographe' ? <><Camera size={9} className="shrink-0" /><span className="truncate">CM</span></> :
                           visualRole === 'dirigeant' ? <><Briefcase size={9} className="shrink-0" /><span className="truncate">Dirigeant</span></> :
                           <><UserCircle size={9} className="shrink-0" /><span className="truncate">Joueur</span></>}
                          {isAdminWithDisplay && <Shield size={8} className="text-accent/60 shrink-0" />}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </button>
              <HeaderPoints userId={currentUser?.uid} />
              <NotificationBell />
              {/* Admin+ dropdown menu */}
              {currentUser?.role === 'admin+' && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setSettingsMenuOpen(prev => !prev)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${settingsMenuOpen ? 'bg-white/20 text-primary-foreground' : 'hover:bg-white/10 text-primary-foreground/50 hover:text-primary-foreground'}`}
                    title="Admin+"
                  >
                    <Shield size={15} className="sm:hidden" />
                    <Shield size={17} className="hidden sm:block" />
                  </button>
                  <AnimatePresence>
                    {settingsMenuOpen && (
                      <>
                        {createPortal(
                          <div className="fixed inset-0 z-[100]" onClick={() => setSettingsMenuOpen(false)}>
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: -8 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: -8 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-3 w-52 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
                              style={{ top: `calc(env(safe-area-inset-top) + 60px)` }}
                              onClick={e => e.stopPropagation()}
                            >
                              <button onClick={() => { setSettingsMenuOpen(false); setShowVersionManager(true); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-secondary/60 transition-colors">
                                <Smartphone size={16} className="text-muted-foreground" />
                                <span>Versions requises</span>
                              </button>
                              <button onClick={() => { setSettingsMenuOpen(false); setShowPushTest(true); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-secondary/60 transition-colors">
                                <Send size={16} className="text-muted-foreground" />
                                <span>Notification push</span>
                              </button>
                            </motion.div>
                          </div>,
                          document.body
                        )}
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {/* Standard buttons for all users */}
              <button onClick={() => setShowChangePassword(true)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-all shrink-0" title="Changer mot de passe">
                <Lock size={14} className="sm:hidden" /><Lock size={16} className="hidden sm:block" />
              </button>
              <button onClick={handleLogout} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-destructive/20 flex items-center justify-center text-primary-foreground/50 hover:text-destructive transition-all shrink-0" title="Déconnexion">
                <LogOut size={14} className="sm:hidden" /><LogOut size={16} className="hidden sm:block" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Welcome banner removed — HomeTab is the new landing */}

      {/* Content */}
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:p-6 lg:px-10 flex-1">
        <div className="animate-fade-in">
          {activeTab === 'home' && (
            <HomeTab currentUser={currentUser} events={events} players={visiblePlayers} news={news} members={visibleMembers} onNavigate={handleTabChange} />
          )}
          {activeTab === 'presences' && (
            <PresencesTab events={events} players={visiblePlayers} members={visibleMembers} currentUser={currentUser} canManage={canManage} canCreateEvent={canCreateEvent} canManageOwnPresence={canManageOwnPresence} togglePresence={togglePresence} deleteEvent={deleteEvent} canDeleteEvent={canDeleteEvent} renameEvent={renameEvent} onAddEvent={() => setShowAddEvent(true)} championships={championships} initialSelectedEventId={pendingEventId} onResetHeader={() => { setHeaderVisible(true); lastDirection.current = null; directionChangeY.current = 0; lastScrollY.current = 0; setPendingEventId(null); }}
              onNavigateToMatchSheet={(eventId) => handleTabChange('matchsheets')}
              onPublishAndNotifyConvocations={async (eventId, event, convocations, customNotif) => {
                try {
                  console.log('[Dashboard] Publishing convocations with customNotif:', JSON.stringify(customNotif));
                  const { data, error } = await supabase.functions.invoke('publish-convocations', {
                    body: { eventId, convocations, customNotif },
                  });

                  console.log('[Dashboard] publish-convocations response:', JSON.stringify({ data, error }));

                  if (error) throw new Error(error.message || 'Erreur lors de la publication');
                  if (data?.error) throw new Error(data.error);

                  // Force refresh events and match sheets from DB
                  const [{ data: freshEvents }, { data: freshMatchSheets }] = await Promise.all([
                    supabase.from('events').select('*').order('date', { ascending: true }),
                    supabase.from('match_sheets').select('*').order('date', { ascending: false }),
                  ]);
                  if (freshEvents) setEvents(filterGhostEvents(freshEvents.map(mapEvent), currentUser?.uid));
                  if (freshMatchSheets) setMatchSheets(freshMatchSheets.map(mapMatchSheet));

                  if (data?.notifiedCount > 0) {
                    toast.success(`Convocations publiées et ${data.notifiedCount} joueur(s) notifié(s) !`);
                  } else if (data?.convokedCount > 0) {
                    toast.success('Convocations publiées ! (aucun appareil à notifier)');
                  } else {
                    toast.success('Convocations publiées !');
                  }

                  handleTabChange('matchsheets');
                } catch (err: any) { toast.error('Erreur: ' + (err.message || 'Échec de la publication')); throw err; }
              }}
              onSendReminder={async (event) => {
                try {
                  const presences = event.presences || {};
                  // Find players who haven't responded (not present, not absent)
                  const allPlayerIds = players.filter(p => !p.id.startsWith('temp-')).map(p => p.id);
                  const noResponsePlayerIds = allPlayerIds.filter(pid => !presences[pid] || (presences[pid] !== 'present' && presences[pid] !== 'absent'));

                  if (noResponsePlayerIds.length === 0) {
                    toast.info('Tous les joueurs ont déjà répondu !');
                    return;
                  }

                  // Find member IDs linked to these players
                  const targetMemberIds = members
                    .filter(m => m.playerId && noResponsePlayerIds.includes(m.playerId))
                    .map(m => m.id);

                  if (targetMemberIds.length === 0) {
                    toast.info('Aucun membre à notifier');
                    return;
                  }

                  const { data: tokenRows } = await supabase
                    .from('fcm_tokens')
                    .select('token')
                    .in('user_id', targetMemberIds);

                  const tokens = tokenRows?.map(r => r.token) || [];

                  if (tokens.length === 0) {
                    toast.info('Aucun appareil enregistré pour les joueurs en attente');
                    return;
                  }

                  const senderName = currentUser?.name || 'Un responsable';
                  const eventDate = new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

                  await supabase.functions.invoke('send-push-notification', {
                    body: {
                      title: `⏰ Rappel de ${senderName}`,
                      body: `${senderName} a lancé un rappel de confirmation de présence pour l'événement suivant : ${event.title} le ${eventDate}`,
                      tokens,
                      data: { tab: 'presences', eventId: event.id },
                    },
                  });

                  toast.success(`Rappel envoyé à ${tokens.length} joueur(s) en attente`);
                } catch (err: any) {
                  toast.error('Erreur: ' + err.message);
                }
              }}
            />
          )}
          {activeTab === 'stats' && <StatsTab players={visiblePlayersForStats} events={events} cards={cards} attendanceRecords={attendanceRecords} members={visibleMembers} championships={championships} champMatches={champMatches} matchSheets={visibleMatchSheets} currentUser={currentUser} canManage={canManage} updatePlayerStats={updatePlayerStats} deletePlayer={deletePlayer} getPlayerCards={getPlayerCards} deleteCard={deleteCard} onAddCard={(playerId) => { setSelectedPlayerForCard(playerId); setShowAddCard(true); }} />}
          {activeTab === 'championnat' && <ChampionnatTab championships={championships} matches={champMatches} currentUserRole={currentUser?.role} canManage={canManage} canUpdateChampionnat={canUpdateChampionnat} onAddChampionship={addChampionship} onDeleteChampionship={deleteChampionship} onUpdateChampionship={updateChampionship} onAddMatch={addChampMatch} onUpdateMatchScore={updateMatchScore} onDeleteMatch={deleteChampMatch} onRefreshFromFFF={refreshFromFFF} dataLoaded={!loading} />}
          {activeTab === 'news' && <NewsTab news={news} comments={newsComments} members={members} currentUser={currentUser} canManage={canManage} canCreateNews={canCreateNews} deleteNews={deleteNews} toggleLike={toggleLike} addComment={addComment} deleteComment={deleteComment} onAddNews={() => setShowAddNews(true)} />}
          {activeTab === 'calendar' && <CalendarTab events={events} members={members} currentUser={currentUser} />}
          {activeTab === 'gallery' && <GalleryTab albums={albums} photos={galleryPhotos} currentUser={currentUser} canManagePhotos={canManagePhotos} onCreateAlbum={createAlbum} onDeleteAlbum={deleteAlbum} onUploadPhotos={uploadPhotos} onDeletePhoto={deletePhoto} />}
          {hasOpenedParisTab && (
            <div className={activeTab === 'paris' ? '' : 'hidden'}>
              <ParisTab currentUser={currentUser} championships={championships} />
            </div>
          )}
          {activeTab === 'matchsheets' && <MatchSheetsTab matchSheets={visibleMatchSheets} players={visiblePlayers} isManager={!!canManage()} championships={championships} teamLogoMap={teamLogoMap} onMatchSheetUpdated={(updatedSheet) => { setMatchSheets(prev => { const next = prev.map(ms => ms.id === updatedSheet.id ? updatedSheet : ms); writeCache('matchSheets', next); return next; }); }} onDeleteMatchSheet={(sheetId) => { setConfirmModal({ title: 'Supprimer cette feuille de match ?', message: 'Cette action est irréversible. La composition sera définitivement supprimée.', onConfirm: async () => { setMatchSheets(prev => prev.filter(ms => ms.id !== sheetId)); try { await supabase.from('match_sheets').delete().eq('id', sheetId); toast.success('Feuille de match supprimée'); } catch { toast.error('Erreur lors de la suppression'); } } }); }} />}
          {activeTab === 'discussions' && <ChatTab currentUser={currentUser} members={members} />}
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

      <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} unreadDiscussions={unreadDiscussions} />



      {/* Modals */}
      {showAddPlayer && <AddPlayerForm onSubmit={addPlayer} onClose={() => setShowAddPlayer(false)} currentUser={currentUser} />}
      {showInvitePlayer && (
        <InvitePlayerForm currentUser={currentUser} onClose={() => setShowInvitePlayer(false)}
          onSubmit={async (data) => {
            try {
              if (currentUser?.role === 'entraineur') data.role = 'joueur';
              if (data.role === 'admin+' && currentUser?.role !== 'admin+') { toast.error("Seul l'Admin+ peut attribuer ce rôle"); return; }
              const isCollective = data.mode === 'collective' || (data as any).collective;
              const isCode = data.mode === 'code';
              const isCodeCollective = isCode && (data as any).collective;
              const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

              // Generate invite code for code mode (individual or collective)
              const inviteCode = isCode ? `FCO-${Math.random().toString(36).substring(2, 6).toUpperCase()}` : null;

              const { data: inv, error } = await supabase.from('invitations').insert({
                email: data.mode === 'email' ? data.email : null,
                role: isCode ? 'joueur' : data.role,
                position: data.position || null,
                license_expiry: data.licenseExpiry || null,
                expires_at: expiresAt,
                invited_by: currentUser?.uid || '',
                max_uses: isCollective || isCodeCollective ? 9999 : 1,
                use_count: 0,
                invite_code: inviteCode,
              } as any).select('id, invite_code').single();
              if (error) throw error;
              
              if (isCode) {
                toast.success('Code d\'invitation généré !');
                setShowInvitePlayer(false);
                setInviteResult({ email: '', link: (inv as any).invite_code || inviteCode || '' });
              } else {
                const link = `${getWebOrigin()}/register?token=${inv.id}`;
                if (data.mode === 'email' && data.email) {
                  try {
                    await sendInvitationEmail({
                      to_email: data.email,
                      invite_link: link,
                      role_label: data.role || 'Joueur',
                      inviter_name: currentUser?.name || 'Un administrateur',
                    });
                    toast.success('Invitation envoyée par email !');
                  } catch { toast.warning("Email non envoyé, mais le lien a été généré"); }
                } else {
                  toast.success(isCollective ? 'Lien collectif généré !' : 'Lien d\'invitation généré !');
                }
                setShowInvitePlayer(false);
                setInviteResult({ email: data.email || '', link });
              }
            } catch (err: any) { toast.error('Erreur: ' + err.message); }
          }}
        />
      )}
      {inviteResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setInviteResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4"><CheckCircle2 size={32} className="text-accent" /></div>
              <h3 className="text-lg font-bold text-foreground">
                {inviteResult.email ? 'Invitation envoyée' : inviteResult.link.startsWith('FCO-') ? 'Code généré' : 'Lien généré'}
              </h3>
              {inviteResult.email && <p className="text-sm text-muted-foreground mt-1">{inviteResult.email}</p>}
            </div>
            <div className="mx-6 mb-4 space-y-2">
              {inviteResult.link.startsWith('FCO-') ? (
                <>
                  <div className="flex items-center justify-center gap-3 p-5 bg-secondary/60 rounded-xl border border-border/50">
                    <p className="text-3xl font-black text-primary tracking-[0.15em] select-all">{inviteResult.link}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(inviteResult.link); toast.success('Code copié !'); }} className="flex-1 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5">
                      <Copy size={13} /> Copier le code
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center mt-2 px-2">📱 Le joueur entre ce code dans l'app pour créer son compte. Expire dans 48h.</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                    <Mail size={16} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lien d'inscription</p>
                      <p className="text-xs font-medium text-foreground truncate">{inviteResult.link}</p>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(inviteResult.link); toast.success('Lien copié !'); }} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Copier"><Copy size={14} className="text-muted-foreground" /></button>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center mt-2 px-2">📋 Vous pouvez aussi partager ce lien directement. Il expire dans 48h.</p>
                </>
              )}
            </div>
            <div className="p-4 border-t border-border">
              <button onClick={() => setInviteResult(null)} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all text-sm">Fermer</button>
            </div>
          </div>
        </div>
      )}
      {showAddEvent && <AddEventForm onSubmit={addEvent} onClose={() => setShowAddEvent(false)} isDirigeant={currentUser?.role === 'dirigeant'} isAdminPlus={currentUser?.role === 'admin+'} currentUserId={currentUser?.uid} />}
      {showAddNews && <AddNewsForm onSubmit={addNews} onClose={() => setShowAddNews(false)} />}
      {showAddCard && <AddCardForm players={visiblePlayers} selectedPlayerId={selectedPlayerForCard} cards={cards} onSubmit={addCard} onClose={() => { setShowAddCard(false); setSelectedPlayerForCard(null); }} />}
      {showChangePassword && <ChangePasswordForm onClose={() => setShowChangePassword(false)} />}
      {showAdminResetPassword && selectedMemberForReset && <AdminResetPasswordForm member={selectedMemberForReset} onClose={() => { setShowAdminResetPassword(false); setSelectedMemberForReset(null); }} />}
      {showAvatarModal && currentUser && <AvatarModal currentUser={currentUser} onClose={() => { setShowAvatarModal(false); setAvatarFocusLicense(false); }} onAvatarUpdated={(photoURL) => setCurrentUser({ ...currentUser, photoURL })} focusLicense={avatarFocusLicense} onStartTutorial={() => setShowTutorial(true)} />}
      {showPushTest && <SendPushNotifForm onClose={() => setShowPushTest(false)} />}
      <VersionManagerModal open={showVersionManager} onClose={() => setShowVersionManager(false)} />
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
      <AnimatePresence>
        {welcomeName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4 pb-24 sm:pb-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 60 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280, delay: 0.1 }}
              className="relative max-w-sm w-full overflow-hidden rounded-[2rem] bg-gradient-to-b from-card to-card/95 border border-border/50 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]"
            >
              <motion.div
                animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.1, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-60 bg-primary/25 rounded-full blur-[80px] pointer-events-none"
              />
              <div className="relative z-10 px-8 pt-10 pb-8 text-center">
                <div className="relative inline-flex items-center justify-center mb-7">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-28 h-28 rounded-full border border-primary/15"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    className="absolute w-24 h-24 rounded-full border border-primary/20"
                  />
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.3 }}
                    className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-primary/10"
                  >
                    <img src={clubLogo} alt="FCO" className="w-13 h-13 object-contain drop-shadow-md" />
                  </motion.div>
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="text-xs font-bold uppercase tracking-[0.25em] text-primary/60 mb-3"
                >Bienvenue au club</motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight"
                >
                  Salut{' '}
                  <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{welcomeName}</span> 👋
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="text-sm text-muted-foreground mt-3 leading-relaxed"
                >Tout est prêt pour toi. On te fait un tour rapide ?</motion.p>
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setWelcomeName(null); setTutorialMandatory(true); setShowTutorial(true); }}
                  className="mt-8 w-full py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-primary/30"
                >Découvrir l'app 🚀</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding tutorial */}
      {showTutorial && currentUser && (
        <OnboardingTutorial
          userRole={currentUser.role}
          onComplete={() => { setShowTutorial(false); setTutorialMandatory(false); setTimeout(() => setActiveTab('home'), 400); setTimeout(() => { if (licenseNeedsReminder) setShowLicenseReminder(true); }, 1000); }}
          onTabChange={handleTabChange}
          mandatory={tutorialMandatory}
        />
      )}

      {/* Win celebration popup */}
      {winCelebration && (
        <WinCelebration
          totalWon={winCelebration.totalWon}
          matchCount={winCelebration.matchCount}
          onClose={handleCloseWinCelebration}
        />
      )}
    </div>
  );
};

// Error boundary to prevent app crashes
class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard crash caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center gap-4">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm shadow-lg">
            <h2 className="text-lg font-bold text-foreground mb-2">Erreur inattendue</h2>
            <p className="text-sm text-muted-foreground mb-4">
              L'application a rencontré un problème. Essayez de relancer.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium"
            >
              Relancer l'app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const DashboardWithErrorBoundary = () => (
  <DashboardErrorBoundary>
    <Dashboard />
  </DashboardErrorBoundary>
);

export default DashboardWithErrorBoundary;
