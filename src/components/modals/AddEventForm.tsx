import React, { useState } from 'react';
import { X, CalendarDays, Type, Bell, Swords, Dumbbell, Repeat, CircleDot, FileText } from 'lucide-react';
import NativeDatePicker from '@/components/ui/native-date-picker';
import NativeTimePicker from '@/components/ui/native-time-picker';
import LocationAutocomplete from '@/components/ui/location-autocomplete';

interface Props {
  onSubmit: (data: any) => void;
  onClose: () => void;
  isDirigeant?: boolean;
}

const AddEventForm = ({ onSubmit, onClose, isDirigeant }: Props) => {
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    type: isDirigeant ? 'training' : 'match',
    recurrence: 'ponctuel' as 'recurring' | 'ponctuel',
    sendNotification: true,
    reason: '',
    time: '',
    location: '',
  });
  const [locationValid, setLocationValid] = useState(false);

  const allTypeOptions = [
    { value: 'match', label: 'Match', shortLabel: 'Match', icon: <Swords className="w-3.5 h-3.5" />, color: 'bg-accent/10 border-accent/30 text-accent' },
    { value: 'training', label: 'Entraînement', shortLabel: 'Entraîn.', icon: <Dumbbell className="w-3.5 h-3.5" />, color: 'bg-purple-500/10 border-purple-500/30 text-purple-600' },
    { value: 'other', label: 'Autre', shortLabel: 'Autre', icon: <CalendarDays className="w-3.5 h-3.5" />, color: 'bg-muted border-border text-muted-foreground' },
  ];

  const typeOptions = isDirigeant ? allTypeOptions.filter(o => o.value === 'training') : allTypeOptions;

  // Location is required only for match
  const needsLocation = formData.type === 'match';
  const isFormValid = formData.title && formData.date && formData.time && (!needsLocation || locationValid);

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <CalendarDays size={20} className="text-accent" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Nouvel événement</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="relative">
            <Type size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Titre (ex: Match vs FC Paris)" className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
          </div>

          <NativeDatePicker
            value={formData.date}
            onChange={(date) => setFormData({ ...formData, date })}
            min={new Date().toISOString().split('T')[0]}
          />

          {/* Time picker */}
          <NativeTimePicker
            value={formData.time}
            onChange={(time) => setFormData({ ...formData, time })}
          />

          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: opt.value, ...(opt.value === 'match' ? { recurrence: 'ponctuel' } : {}), ...(opt.value !== 'match' ? { location: '' } : {}) })}
                  className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-semibold border-2 transition-all whitespace-nowrap ${
                    formData.type === opt.value ? opt.color + ' scale-[1.02]' : 'bg-secondary border-transparent text-muted-foreground hover:border-border'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">{opt.icon} <span className="hidden min-[380px]:inline">{opt.label}</span><span className="min-[380px]:hidden">{opt.shortLabel}</span></span>
                </button>
              ))}
            </div>
          </div>

          {/* Location autocomplete - only for match */}
          {formData.type === 'match' && (
            <div className="animate-fade-in">
              <LocationAutocomplete
                value={formData.location}
                onChange={(location) => setFormData({ ...formData, location })}
                onValidSelection={setLocationValid}
              />
              {!locationValid && (
                <p className="text-[11px] text-muted-foreground mt-1">📍 Sélectionne une adresse dans les suggestions</p>
              )}
            </div>
          )}

          {/* Recurrence selector - hidden for match (always ponctuel) */}
          {formData.type !== 'match' && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Récurrence</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, recurrence: 'ponctuel' })}
                  className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-semibold border-2 transition-all whitespace-nowrap ${
                    formData.recurrence === 'ponctuel' ? 'bg-muted border-border text-foreground scale-[1.02]' : 'bg-secondary border-transparent text-muted-foreground hover:border-border'
                  }`}
                >
                  <span className="inline-flex items-center gap-1"><CircleDot className="w-3.5 h-3.5" /> Ponctuel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, recurrence: 'recurring' })}
                  className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-semibold border-2 transition-all whitespace-nowrap ${
                    formData.recurrence === 'recurring' ? 'bg-primary/10 border-primary/30 text-primary scale-[1.02]' : 'bg-secondary border-transparent text-muted-foreground hover:border-border'
                  }`}
                >
                  <span className="inline-flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> Récurrent</span>
                </button>
              </div>
              {formData.recurrence === 'recurring' && (
                <p className="text-[11px] text-muted-foreground mt-1.5">Se répète chaque semaine automatiquement</p>
              )}
            </div>
          )}

          {/* Reason field for "other" type */}
          {formData.type === 'other' && (
            <div className="relative animate-fade-in">
              <FileText size={16} className="absolute left-3.5 top-3.5 text-muted-foreground" />
              <textarea
                placeholder="Précisez la raison (ex: Réunion de bureau, Tournoi amical, Journée cohésion...)"
                className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all resize-none"
                rows={2}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>
          )}
          {/* Notification */}
          {(formData.type === 'match' || formData.type === 'training') && (
            <div className="p-4 bg-accent/5 rounded-xl border border-accent/10 animate-fade-in">
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, sendNotification: !prev.sendNotification }))}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${formData.sendNotification ? 'bg-accent border-accent' : 'border-border'}`}>
                  {formData.sendNotification && <span className="text-accent-foreground text-xs">✓</span>}
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Bell size={14} className="text-accent" /> Notifier les joueurs
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Email de confirmation de présence</p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
            Annuler
          </button>
          <button
            onClick={() => onSubmit(formData)}
            disabled={!isFormValid}
            className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-accent/20"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddEventForm;
