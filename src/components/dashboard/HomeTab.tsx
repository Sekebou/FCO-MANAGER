import React, { useMemo } from 'react';
import {
  ChevronRight, Clock, MapPin, Trophy, Dumbbell,
  Target, Shield, Swords, Users,
  Calendar, Newspaper, BarChart3, Flame, Sparkles
} from 'lucide-react';
import type { Player, Event, NewsItem, Member } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import { getNowParis, isEventTerminatedParis } from '@/lib/dateUtils';
import footballHeroBg from '@/assets/football-hero-bg.jpg';

interface HomeTabProps {
  currentUser: AppUser | null;
  events: Event[];
  players: Player[];
  news: NewsItem[];
  members: Member[];
  onNavigate: (tab: string, eventId?: string) => void;
}

const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatDateLong = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

const getCountdown = (dateStr: string, timeStr?: string | null): { label: string; urgent: boolean } | null => {
  const target = new Date(dateStr);
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    target.setHours(h || 0, m || 0, 0, 0);
  } else {
    target.setHours(0, 0, 0, 0);
  }
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return { label: `J-${days}`, urgent: days <= 1 };
  if (hours > 0) return { label: `${hours}h`, urgent: true };
  const mins = Math.floor((diff % 3600000) / 60000);
  return { label: `${mins}min`, urgent: true };
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

const HomeTab: React.FC<HomeTabProps> = ({ currentUser, events, players, news, members, onNavigate }) => {
  const isCoach = currentUser && ['admin+', 'admin', 'entraineur'].includes(currentUser.role);

  const now = getNowParis();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const isEventTerminated = (event: Event): boolean => isEventTerminatedParis(event);

  const upcomingEvents = useMemo(() =>
    events
      .filter(e => new Date(e.date) >= today && !isEventTerminated(e))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events]
  );

  const featuredMatch = useMemo(() => upcomingEvents.find(e => e.type === 'match') || null, [upcomingEvents]);
  const otherMatches = useMemo(
    () => upcomingEvents.filter(e => e.type === 'match' && e.id !== featuredMatch?.id).slice(0, 2),
    [upcomingEvents, featuredMatch]
  );
  const nextTrainings = useMemo(() => upcomingEvents.filter(e => e.type === 'training').slice(0, 2), [upcomingEvents]);

  const myPlayer = useMemo(() => {
    if (!currentUser?.playerId) return null;
    return players.find(p => p.id === currentUser.playerId) || null;
  }, [players, currentUser]);

  const recentNews = useMemo(() => news.slice(0, 2), [news]);
  const playerIdsWithAccount = useMemo(() => new Set(members.filter(m => m.playerId).map(m => m.playerId)), [members]);
  const totalPlayers = useMemo(() => players.filter(p => playerIdsWithAccount.has(p.id)).length, [players, playerIdsWithAccount]);

  const initials = currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const handleMatchClick = (matchId: string) => {
    onNavigate('presences', matchId);
  };

  const featuredCd = featuredMatch ? getCountdown(featuredMatch.date, featuredMatch.time) : null;
  const myPid = currentUser?.playerId;
  const iAmConvokedFeatured = !!(
    featuredMatch && myPid && featuredMatch.convocationsPublished &&
    featuredMatch.convocations && (featuredMatch.convocations as any)[myPid]
  );
  const featuredPublisher = featuredMatch?.convocationsPublishedByName || featuredMatch?.createdByName;

  return (
    <div className="space-y-6 pb-6">
      {/* ── Greeting Header (clean, minimal) ── */}
      <div className="flex items-center gap-3 px-1 pt-1">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-primary/10 shadow-md shadow-primary/10">
          {currentUser?.photoURL ? (
            <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <span className="text-sm font-black text-white">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.16em]">{getGreeting()}</p>
          <h2 className="text-[22px] font-black text-foreground leading-tight truncate -mt-0.5">
            {currentUser?.name?.split(' ')[0]} 👋
          </h2>
        </div>
      </div>

      {/* ── Featured Match Hero (premium card) ── */}
      {featuredMatch && (
        <button
          onClick={() => handleMatchClick(featuredMatch.id)}
          className="group relative w-full text-left overflow-hidden rounded-3xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-transform"
        >
          {/* Pitch background */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${footballHeroBg})` }}
          />
          {/* Color overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent/85" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/40 to-transparent" />
          {/* Decorative glows */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-accent/40 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />

          <div className="relative p-5">
            {/* Top row: badge + countdown */}
            <div className="flex items-start justify-between mb-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20">
                <Flame size={11} className="text-white" strokeWidth={2.5} />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Prochain match</span>
              </div>
              {featuredCd && (
                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-md border ${
                  featuredCd.urgent
                    ? 'bg-warning/90 border-white/30 animate-pulse'
                    : 'bg-white/15 border-white/20'
                }`}>
                  <Clock size={10} className="text-white" strokeWidth={2.5} />
                  <span className="text-[11px] font-black text-white">{featuredCd.label}</span>
                </div>
              )}
            </div>

            {/* Match title */}
            <h3 className="text-xl font-black text-white leading-tight mb-1 drop-shadow-md">
              {featuredMatch.title}
            </h3>

            {/* Date + time + location */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
              <span className="inline-flex items-center gap-1 text-[12px] text-white/90 font-semibold capitalize">
                <Calendar size={11} strokeWidth={2.5} /> {formatDateLong(featuredMatch.date)}
              </span>
              {featuredMatch.time && (
                <span className="inline-flex items-center gap-1 text-[12px] text-white/90 font-semibold">
                  <Clock size={11} strokeWidth={2.5} /> {featuredMatch.time}
                </span>
              )}
            </div>
            {featuredMatch.location && (
              <span className="inline-flex items-center gap-1 text-[11px] text-white/75 font-medium mb-4">
                <MapPin size={10} strokeWidth={2.5} />
                <span className="truncate max-w-[260px]">{featuredMatch.location}</span>
              </span>
            )}

            {/* Convocation badge */}
            {iAmConvokedFeatured && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/95 backdrop-blur-sm border border-white/20 shadow-md">
                <Shield size={12} className="text-white shrink-0" strokeWidth={2.5} />
                <span className="text-[11px] font-black text-white">
                  Tu es convoqué{featuredPublisher ? <> · <span className="font-bold opacity-90">{featuredPublisher}</span></> : ''}
                </span>
              </div>
            )}
          </div>
        </button>
      )}

      {/* ── Personal Stats Strip (player view) ── */}
      {myPlayer && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Target, value: myPlayer.goals || 0, label: 'Buts' },
            { icon: Swords, value: myPlayer.assists || 0, label: 'Passes' },
            { icon: Shield, value: myPlayer.matches || 0, label: 'Matchs' },
          ].map((s) => (
            <div key={s.label} className="relative bg-card border border-border/50 rounded-2xl px-3 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                <s.icon size={16} className="text-primary" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black text-foreground leading-none">{s.value}</div>
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Coach Stats Strip ── */}
      {isCoach && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Users, value: totalPlayers, label: 'Joueurs' },
            { icon: Target, value: players.reduce((s, p) => s + (p.goals || 0), 0), label: 'Buts' },
            { icon: Swords, value: players.reduce((s, p) => s + (p.assists || 0), 0), label: 'Passes' },
          ].map((s) => (
            <div key={s.label} className="relative bg-card border border-border/50 rounded-2xl px-3 py-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                <s.icon size={16} className="text-primary" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black text-foreground leading-none">{s.value}</div>
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Quick Navigation (modern pills) ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Calendar, label: 'Présences', tab: 'presences' },
          { icon: Trophy, label: 'Champ.', tab: 'championnat' },
          { icon: BarChart3, label: 'Stats', tab: 'stats' },
          { icon: isCoach ? Users : Newspaper, label: isCoach ? 'Effectif' : 'Actus', tab: isCoach ? 'members' : 'news' },
        ].map((a) => (
          <button
            key={a.tab}
            onClick={() => onNavigate(a.tab)}
            className="group flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-card border border-border/50 active:scale-95 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <a.icon size={17} className="text-primary" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold text-foreground">{a.label}</span>
          </button>
        ))}
      </div>

      {/* ── Other Upcoming Matches (slim) ── */}
      {otherMatches.length > 0 && (
        <div>
          <SectionHeader
            title="À venir"
            onAction={() => onNavigate('presences')}
          />
          <div className="space-y-2">
            {otherMatches.map((match) => {
              const cd = getCountdown(match.date, match.time);
              const iAm = !!(myPid && match.convocationsPublished && match.convocations && (match.convocations as any)[myPid]);
              return (
                <button
                  key={match.id}
                  onClick={() => handleMatchClick(match.id)}
                  className="group w-full text-left bg-card border border-border/50 rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition-all hover:border-primary/30 hover:shadow-md"
                >
                  {/* Date block */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-primary/70 uppercase leading-none">
                      {new Date(match.date).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
                    </span>
                    <span className="text-base font-black text-primary leading-none mt-0.5">
                      {new Date(match.date).getDate()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-black text-foreground truncate">{match.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {match.time && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
                          <Clock size={9} /> {match.time}
                        </span>
                      )}
                      {iAm && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-success uppercase">
                          <Shield size={9} strokeWidth={3} /> Convoqué
                        </span>
                      )}
                    </div>
                  </div>

                  {cd && (
                    <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-black text-foreground/70 shrink-0">
                      {cd.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Next Trainings ── */}
      {nextTrainings.length > 0 && (
        <div>
          <SectionHeader
            title="Entraînements"
            onAction={() => onNavigate('presences')}
          />
          <div className="space-y-2">
            {nextTrainings.map((training) => {
              const cd = getCountdown(training.date, training.time);
              return (
                <button
                  key={training.id}
                  onClick={() => onNavigate('presences', training.id)}
                  className="group w-full text-left bg-card border border-border/50 rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition-all hover:border-accent/30 hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/20 flex items-center justify-center shrink-0">
                    <Dumbbell size={18} className="text-accent" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-black text-foreground truncate capitalize">{training.title.toLowerCase()}</h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-semibold capitalize">
                        <Calendar size={9} /> {formatDate(training.date)}
                      </span>
                      {training.time && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
                          <Clock size={9} /> {training.time}
                        </span>
                      )}
                    </div>
                  </div>
                  {cd && (
                    <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-black text-foreground/70 shrink-0">
                      {cd.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent News ── */}
      {recentNews.length > 0 && (
        <div>
          <SectionHeader
            title="Actualités"
            onAction={() => onNavigate('news')}
          />
          <div className="space-y-2">
            {recentNews.map((n) => (
              <button
                key={n.id}
                onClick={() => onNavigate('news')}
                className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/50 active:scale-[0.98] transition-all hover:border-accent/30 hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/15 flex items-center justify-center shrink-0">
                  <Newspaper size={15} className="text-accent" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-black text-foreground truncate">{n.title}</h4>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{n.content.slice(0, 70)}</p>
                </div>
                <span className="text-[9px] text-muted-foreground/60 font-bold shrink-0 capitalize">{formatDate(n.date)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state for fully empty home ── */}
      {!featuredMatch && otherMatches.length === 0 && nextTrainings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4">
            <Sparkles size={28} className="text-primary" strokeWidth={2.5} />
          </div>
          <h3 className="text-base font-black text-foreground mb-1">Rien de prévu pour l'instant</h3>
          <p className="text-xs text-muted-foreground max-w-[260px]">
            Les prochains matchs et entraînements apparaîtront ici dès leur ajout.
          </p>
        </div>
      )}
    </div>
  );
};

/* ── Section Header (minimal) ── */
const SectionHeader: React.FC<{
  title: string;
  onAction?: () => void;
  actionLabel?: string;
}> = ({ title, onAction, actionLabel = 'Tout voir' }) => (
  <div className="flex items-center justify-between mb-2.5 px-1">
    <h3 className="text-[11px] font-black text-foreground tracking-[0.12em] uppercase">{title}</h3>
    {onAction && (
      <button
        onClick={onAction}
        className="text-[10px] font-black text-primary flex items-center gap-0.5 active:scale-95 transition-transform uppercase tracking-wider"
      >
        {actionLabel} <ChevronRight size={11} strokeWidth={3} />
      </button>
    )}
  </div>
);

export default React.memo(HomeTab);
