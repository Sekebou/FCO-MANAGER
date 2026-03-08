import React from 'react';
import type { Event, Member } from '@/pages/Dashboard';
import RoleBadge from '@/components/ui/role-badge';
import { Swords, Dumbbell, CalendarDays, Repeat, CircleDot } from 'lucide-react';

interface AppUser {
  uid: string;
  role: string;
  [key: string]: any;
}

interface Props {
  events: Event[];
  members: Member[];
  currentUser?: AppUser | null;
}

const CalendarTab = ({ events, members, currentUser }: Props) => {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD local

  const sorted = [...events]
    .filter(e => e.date >= todayStr)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Find closest date (could have multiple events on the same day)
  const closestDate = sorted[0]?.date || null;
  const closestEvents = closestDate ? sorted.filter(e => e.date === closestDate) : [];
  const restEvents = closestDate ? sorted.filter(e => e.date !== closestDate) : [];

  // Determine event status based on date + time
  const getEventStatus = (event: Event): 'terminé' | 'en cours' | 'à venir' => {
    if (event.date > todayStr) return 'à venir';
    if (event.date < todayStr) return 'terminé';
    // Today: check time
    if (!event.time) return 'en cours';
    const [h, m] = event.time.replace('H', ':').replace('h', ':').split(':').map(Number);
    const eventStart = new Date(now);
    eventStart.setHours(h || 0, m || 0, 0, 0);
    const duration = (event.duration || 90) * 60 * 1000;
    const eventEnd = new Date(eventStart.getTime() + duration);
    if (now < eventStart) return 'à venir';
    if (now <= eventEnd) return 'en cours';
    return 'terminé';
  };

  const StatusBadge = ({ status }: { status: 'terminé' | 'en cours' | 'à venir' }) => {
    const styles = {
      'terminé': 'bg-muted text-muted-foreground',
      'en cours': 'bg-green-500/15 text-green-600',
      'à venir': 'bg-accent/10 text-accent',
    };
    const labels = {
      'terminé': 'Terminé',
      'en cours': '● En cours',
      'à venir': 'À venir',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const EventCard = ({ event, isPast, highlight }: { event: Event; isPast?: boolean; highlight?: boolean }) => {
    const status = getEventStatus(event);
    return (
      <div className={`border-l-4 rounded-r-xl transition-all ${
        highlight
          ? 'border-accent bg-accent/10 shadow-lg ring-1 ring-accent/25 p-4 sm:p-5'
          : isPast
            ? 'border-border bg-muted/50 p-3 sm:p-4'
            : 'border-accent/50 bg-accent/5 shadow-sm p-3 sm:p-4'
      }`}>
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className={`font-semibold text-sm sm:text-base ${isPast ? 'text-muted-foreground' : 'text-foreground'} truncate`}>{event.title}</h4>
              <StatusBadge status={status} />
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 space-y-0.5">
              <span className="block">{new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}{event.time ? ` à ${event.time}` : ''}</span>
              {event.createdByName && (
                <span className="flex items-center gap-1 text-muted-foreground/60 text-[11px]">
                  {event.createdByName}
                  {(() => {
                    const creator = members.find(m => m.id === event.createdBy);
                    return creator ? <RoleBadge role={creator.role} displayRole={creator.displayRole} compact /> : null;
                  })()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 items-center shrink-0">
            {event.recurrence === 'recurring' ? (
              <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-primary/10 text-primary">
                <Repeat className="w-3 h-3" /> Récurrent
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-muted text-muted-foreground">
                <CircleDot className="w-3 h-3" /> Ponctuel
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium shrink-0 ${
              event.type === 'match' ? 'bg-accent/10 text-accent' :
              event.type === 'training' ? 'bg-purple-100 text-purple-700' :
              'bg-muted text-muted-foreground'
            }`}>
              {event.type === 'match' ? <Swords className="w-3 h-3" /> : event.type === 'training' ? <Dumbbell className="w-3 h-3" /> : <CalendarDays className="w-3 h-3" />}
              {event.type === 'match' ? 'Match' : event.type === 'training' ? 'Entraînement' : 'Autre'}
            </span>
            {event.type === 'other' && event.reason && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-secondary text-foreground max-w-[120px] truncate" title={event.reason}>
                {event.reason}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-xl flex items-center justify-center">
          <CalendarDays className="text-accent" size={18} />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">Calendrier</h2>
      </div>

      {/* Événements les plus proches (même date) */}
      {closestEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-accent uppercase tracking-wider flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
            </span>
            {closestEvents.length > 1 ? 'Événements les plus proches' : 'Événement le plus proche'}
          </h3>
          <div className="space-y-2">
            {closestEvents.map(e => (
              <EventCard key={e.id} event={e} highlight />
            ))}
          </div>
        </div>
      )}

      {/* Séparateur */}
      {closestEvents.length > 0 && restEvents.length > 0 && (
        <div className="h-px bg-border/60" />
      )}

      {/* À venir */}
      {restEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-accent uppercase tracking-wider">À venir</h3>
          <div className="space-y-2">
            {restEvents.map((e, i, arr) => (
              <React.Fragment key={e.id}>
                <EventCard event={e} />
                {i < arr.length - 1 && <div className="h-px bg-border/30 mx-2" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <p className="text-muted-foreground italic text-sm text-center py-8">Aucun événement à venir</p>
      )}
    </div>
  );
};

export default CalendarTab;
