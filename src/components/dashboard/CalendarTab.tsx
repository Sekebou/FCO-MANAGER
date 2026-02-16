import React from 'react';
import type { Event, Member } from '@/pages/Dashboard';
import RoleBadge from '@/components/ui/role-badge';

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
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const past = sorted.filter(e => new Date(e.date) < new Date());
  const future = sorted.filter(e => new Date(e.date) >= new Date());

  const EventCard = ({ event, isPast }: { event: Event; isPast?: boolean }) => {
    const teamLabel = null;
    return (
      <div className={`border-l-4 p-4 rounded-r-xl ${isPast ? 'border-border bg-muted/50' : 'border-accent bg-accent/5'} ${!isPast ? 'shadow-sm' : ''}`}>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h4 className={`font-semibold ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>{event.title}</h4>
              {teamLabel && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                  {teamLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {event.createdByName && (
                <span className="text-muted-foreground/60 inline-flex items-center gap-1.5">
                  {' '}· par {event.createdByName}
                  {(() => {
                    const creator = members.find(m => m.id === event.createdBy);
                    return creator ? <RoleBadge role={creator.role} /> : null;
                  })()}
                </span>
              )}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            event.type === 'match' ? 'bg-accent/10 text-accent' :
            event.type === 'training' ? 'bg-purple-100 text-purple-700' :
            'bg-muted text-muted-foreground'
          }`}>
            {event.type === 'match' ? 'Match' : event.type === 'training' ? 'Entraînement' : 'Autre'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-foreground">Calendrier</h2>

      <div>
        <h3 className="text-lg font-semibold mb-3 text-accent">Événements à venir</h3>
        {future.length === 0 ? (
          <p className="text-muted-foreground italic text-sm">Aucun événement planifié</p>
        ) : (
          <div className="space-y-3">
            {future.map(e => <EventCard key={e.id} event={e} />)}
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
