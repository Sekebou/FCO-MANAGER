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
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const past = sorted.filter(e => e.date < todayStr);
  const future = sorted.filter(e => e.date >= todayStr);

  const nextMatch = future.find(e => e.type === 'match');

  const EventCard = ({ event, isPast, highlight }: { event: Event; isPast?: boolean; highlight?: boolean }) => {
    return (
      <div className={`border-l-4 p-3 sm:p-4 rounded-r-xl transition-all ${
        highlight
          ? 'border-accent bg-accent/10 shadow-md ring-1 ring-accent/20 scale-[1.01]'
          : isPast
            ? 'border-border bg-muted/50'
            : 'border-accent/50 bg-accent/5 shadow-sm'
      }`}>
        {highlight && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Prochain match</span>
          </div>
        )}
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className={`font-semibold text-sm sm:text-base ${isPast ? 'text-muted-foreground' : 'text-foreground'} truncate`}>{event.title}</h4>
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

      <div>
        <h3 className="text-lg font-semibold mb-3 text-accent">Événements à venir</h3>
        {future.length === 0 ? (
          <p className="text-muted-foreground italic text-sm">Aucun événement planifié</p>
        ) : (
          <div className="space-y-3">
            {future.map(e => <EventCard key={e.id} event={e} highlight={nextMatch?.id === e.id} />)}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Événements passés</h3>
        {past.length === 0 ? (
          <p className="text-muted-foreground italic text-sm">Aucun événement passé</p>
        ) : (
          <div className="space-y-3">
            {[...past].reverse().map(e => <EventCard key={e.id} event={e} isPast />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarTab;
