import React, { useState, useEffect } from 'react';
import { X, CalendarDays, Type, Bell, Swords, Dumbbell, Repeat, CircleDot, FileText, Globe, ChevronDown, Clock, MapPin, Home, Pencil } from 'lucide-react';
import NativeDatePicker from '@/components/ui/native-date-picker';
import NativeTimePicker from '@/components/ui/native-time-picker';
import LocationAutocomplete from '@/components/ui/location-autocomplete';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { getEquipes, getAllCompetitions, getTousMatchsAvenir, OISEMONT_CL_NO, type FFFCompetition, type FFFMonthGroup } from '@/lib/fffApi';

interface Props {
  onSubmit: (data: any) => void;
  onClose: () => void;
  isDirigeant?: boolean;
}

interface FFFMatchOption {
  label: string;
  title: string;
  date: string;
  time: string;
  location: string;
  isHome: boolean;
  homeLogo?: string;
  awayLogo?: string;
  homeName: string;
  awayName: string;
  month: string;
}

const AddEventForm = ({ onSubmit, onClose, isDirigeant }: Props) => {
  useBodyScrollLock();

  const [formData, setFormData] = useState({
    title: '',
    date: '',
    type: isDirigeant ? 'training' : 'match',
    recurrence: 'ponctuel' as 'recurring' | 'ponctuel',
    sendNotification: true,
    reason: '',
    time: '',
    location: '',
    duration: '' as string,
    homeLogo: '' as string,
    awayLogo: '' as string,
  });
  const [locationValid, setLocationValid] = useState(false);
  const [trainingLocationChoice, setTrainingLocationChoice] = useState<'stade' | 'salle' | 'autre' | null>(null);

  // Match creation mode: 'auto' (FFF) or 'manual'
  const [matchMode, setMatchMode] = useState<'auto' | 'manual' | null>(null);

  // FFF import state
  const [useFFimport, setUseFFFImport] = useState(false);
  const [fffEquipes, setFffEquipes] = useState<any[]>([]);
  const [fffCompetitions, setFffCompetitions] = useState<FFFCompetition[]>([]);
  const [selectedEquipe, setSelectedEquipe] = useState<string>('');
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [fffMatchesByMonth, setFffMatchesByMonth] = useState<FFFMatchOption[]>([]);
  const [loadingEquipes, setLoadingEquipes] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Load equipes when auto mode selected
  useEffect(() => {
    if (matchMode !== 'auto' || fffEquipes.length > 0) return;
    setLoadingEquipes(true);
    getEquipes(OISEMONT_CL_NO).then(data => {
      const equipes = Array.isArray(data) ? data : data?.['hydra:member'] || [];
      setFffEquipes(equipes);
      const comps = getAllCompetitions(equipes);
      setFffCompetitions(comps);
    }).catch(() => {}).finally(() => setLoadingEquipes(false));
  }, [matchMode]);

  // Load matches when competition selected — use getTousMatchsAvenir
  useEffect(() => {
    if (!selectedCompetition) { setFffMatchesByMonth([]); return; }
    const comp = fffCompetitions.find(c => `${c.cpNo}-${c.phase}-${c.poule}` === selectedCompetition);
    if (!comp) return;
    setLoadingMatches(true);
    getTousMatchsAvenir(comp.cpNo, comp.phase, comp.poule).then((monthGroups: FFFMonthGroup[]) => {
      const now = new Date();
      const options: FFFMatchOption[] = [];
      for (const group of monthGroups) {
        for (const m of group.matchs) {
          if (!m.home || !m.away) continue;
          // Skip played matches
          const hasScore = m.home_score !== null && m.home_score !== undefined && m.away_score !== null && m.away_score !== undefined;
          if (hasScore) continue;
          const matchDate = m.date ? new Date(m.date) : null;
          if (matchDate && matchDate < now) continue;

          const isHome = m.home?.club?.cl_no === OISEMONT_CL_NO;
          const homeN = m.home?.short_name || m.home?.name || '';
          const awayN = m.away?.short_name || m.away?.name || '';
          const terrain = m.terrain;
          let loc = '';
          if (terrain) loc = [terrain.name, terrain.city].filter(Boolean).join(', ');

          // Extract time: prefer FFF separate `time` field, else parse raw date string
          let timeStr = '';
          if (m.time && typeof m.time === 'string') {
            // FFF returns time as "15H00" or "15:00" or "15:00:00"
            const normalized = m.time.replace(/[Hh]/, ':');
            const tm = normalized.match(/(\d{2}:\d{2})/);
            if (tm) timeStr = tm[1];
          }
          if (!timeStr && m.date) {
            const raw = m.date as string;
            // Extract from raw string before any Date parsing (e.g. "2026-03-15T15:00:00+01:00")
            const tm = raw.match(/T(\d{2}:\d{2})/);
            if (tm) timeStr = tm[1];
          }

          // Extract date from raw string to avoid UTC shift
          let dateStr = '';
          if (m.date) {
            const raw = m.date as string;
            const dm = raw.match(/^(\d{4}-\d{2}-\d{2})/);
            if (dm) dateStr = dm[1];
            else if (matchDate) dateStr = matchDate.toISOString().split('T')[0];
          }

          options.push({
            label: `${homeN} vs ${awayN}`,
            title: `${homeN} vs ${awayN}`,
            date: dateStr,
            time: timeStr,
            location: loc || (isHome ? 'Domicile' : 'Extérieur'),
            isHome,
            homeLogo: m.home?.club?.logo,
            awayLogo: m.away?.club?.logo,
            homeName: homeN,
            awayName: awayN,
            month: group.mois,
          });
        }
      }
      setFffMatchesByMonth(options);
    }).catch(() => {}).finally(() => setLoadingMatches(false));
  }, [selectedCompetition, fffCompetitions]);

  const [fffMatchSelected, setFffMatchSelected] = useState(false);
  const [showLocationOverride, setShowLocationOverride] = useState(false);
  const [showCustomTitle, setShowCustomTitle] = useState(false);

  const handleFFFMatchSelect = (match: FFFMatchOption) => {
    setFormData(prev => ({
      ...prev,
      title: match.title,
      date: match.date,
      time: match.time,
      location: match.location,
      homeLogo: match.homeLogo || '',
      awayLogo: match.awayLogo || '',
    }));
    setLocationValid(true);
    setFffMatchSelected(true);
    setShowLocationOverride(false);
  };

  // Group matches by month for display
  const matchesByMonth = fffMatchesByMonth.reduce<Record<string, FFFMatchOption[]>>((acc, m) => {
    if (!acc[m.month]) acc[m.month] = [];
    acc[m.month].push(m);
    return acc;
  }, {});

  // Group competitions by equipe
  const equipeNames = [...new Set(fffCompetitions.map(c => c.equipe))];

  const allTypeOptions = [
    { value: 'match', label: 'Match', shortLabel: 'Match', icon: <Swords className="w-3.5 h-3.5" />, color: 'bg-accent/10 border-accent/30 text-accent' },
    { value: 'training', label: 'Entraînement', shortLabel: 'Entraîn.', icon: <Dumbbell className="w-3.5 h-3.5" />, color: 'bg-purple-500/10 border-purple-500/30 text-purple-600' },
    { value: 'other', label: 'Autre', shortLabel: 'Autre', icon: <CalendarDays className="w-3.5 h-3.5" />, color: 'bg-muted border-border text-muted-foreground' },
  ];

  const typeOptions = isDirigeant ? allTypeOptions.filter(o => o.value === 'training') : allTypeOptions;

  const isFormValid = formData.title && formData.date;

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-[70]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-border shadow-2xl animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
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
        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, type: opt.value, ...(opt.value === 'match' ? { recurrence: 'ponctuel' } : {}), ...(opt.value !== 'match' ? { location: '' } : {}) });
                    if (opt.value === 'match') setMatchMode(null);
                    if (opt.value !== 'training') setTrainingLocationChoice(null);
                  }}
                  className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-semibold border-2 transition-all overflow-hidden ${
                    formData.type === opt.value ? opt.color + ' scale-[1.02]' : 'bg-secondary border-transparent text-muted-foreground hover:border-border'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 truncate">{opt.icon} <span className="truncate">{opt.shortLabel}</span></span>
                </button>
              ))}
            </div>
          </div>

          {/* FFF Import toggle - only for match */}
          {formData.type === 'match' && !matchMode && (
            <div className="animate-fade-in space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mode de création</label>
              <button
                type="button"
                onClick={() => setMatchMode('auto')}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-transparent bg-accent/5 hover:border-accent/30 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                  <Globe size={18} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">Automatique</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">Recommandé</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Importer depuis la FFF — date, heure, stade, logos</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMatchMode('manual')}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-transparent bg-secondary hover:border-border transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-muted/80 transition-colors">
                  <Pencil size={18} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-foreground">Manuel</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Saisir toutes les infos manuellement</p>
                </div>
              </button>
            </div>
          )}

          {/* Match AUTO mode: FFF import */}
          {formData.type === 'match' && matchMode === 'auto' && (
            <div className="animate-fade-in">
              {fffMatchSelected ? (
                <div className="p-3 bg-accent/5 rounded-xl border border-accent/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-accent flex items-center gap-1.5"><Globe size={14} /> Match importé FFF</span>
                    <button type="button" onClick={() => { setFffMatchSelected(false); setShowLocationOverride(false); }} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline">Modifier</button>
                  </div>
                  <p className="text-sm font-bold text-foreground">{formData.title}</p>
                  {formData.location && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin size={10} /> {formData.location}</p>
                  )}
                  {!formData.location && (
                    <p className="text-[10px] text-warning flex items-center gap-1"><MapPin size={10} /> Stade non trouvé</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-accent flex items-center gap-1.5"><Globe size={14} /> Import FFF</span>
                    <button type="button" onClick={() => setMatchMode(null)} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline">← Retour</button>
                  </div>
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 space-y-3">
                    {loadingEquipes ? (
                      <p className="text-xs text-muted-foreground text-center py-2">Chargement des équipes…</p>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Équipe</label>
                          <select className="w-full py-2.5 px-3 bg-card border border-border rounded-xl text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/50 appearance-none" value={selectedEquipe} onChange={(e) => { setSelectedEquipe(e.target.value); setSelectedCompetition(''); }}>
                            <option value="">-- Choisir une équipe --</option>
                            {equipeNames.map(name => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </div>
                        {selectedEquipe && (
                          <div>
                            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Compétition</label>
                            <select className="w-full py-2.5 px-3 bg-card border border-border rounded-xl text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/50 appearance-none" value={selectedCompetition} onChange={(e) => setSelectedCompetition(e.target.value)}>
                              <option value="">-- Choisir --</option>
                              {fffCompetitions.filter(c => c.equipe === selectedEquipe).map(c => (
                                <option key={`${c.cpNo}-${c.phase}-${c.poule}`} value={`${c.cpNo}-${c.phase}-${c.poule}`}>{c.competitionName}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {loadingMatches && <p className="text-xs text-muted-foreground text-center py-2">Chargement des matchs…</p>}
                        {!loadingMatches && Object.keys(matchesByMonth).length > 0 && (
                          <div className="max-h-52 overflow-y-auto space-y-2">
                            {Object.entries(matchesByMonth).map(([month, matches]) => (
                              <div key={month}>
                                <p className="text-[10px] font-bold text-primary uppercase tracking-wider px-1 py-1 sticky top-0 bg-primary/5 rounded capitalize">{month}</p>
                                <div className="space-y-0.5 mt-0.5">
                                  {matches.map((m, i) => (
                                    <button key={i} type="button" onClick={() => handleFFFMatchSelect(m)} className="w-full text-left px-2 py-2 rounded-lg text-xs hover:bg-primary/10 transition-all text-foreground flex items-center gap-2">
                                      {m.homeLogo ? <img src={m.homeLogo} alt="" className="w-5 h-5 rounded-full object-contain shrink-0" /> : <div className="w-5 h-5 rounded-full bg-muted shrink-0" />}
                                      <span className="truncate font-medium flex-1">{m.homeName} <span className="font-black text-accent">vs</span> {m.awayName}</span>
                                      {m.awayLogo ? <img src={m.awayLogo} alt="" className="w-5 h-5 rounded-full object-contain shrink-0" /> : <div className="w-5 h-5 rounded-full bg-muted shrink-0" />}
                                      <span className="text-[9px] text-muted-foreground shrink-0 ml-1">{m.date ? new Date(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${m.isHome ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}`}>{m.isHome ? 'DOM' : 'EXT'}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {!loadingMatches && selectedCompetition && Object.keys(matchesByMonth).length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-1">Aucun match à venir</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Custom title toggle after FFF selection */}
              {fffMatchSelected && (
                <div className="mt-2 animate-fade-in">
                  {showCustomTitle ? (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Type size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input type="text" placeholder="Titre personnalisé (optionnel)" className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                      </div>
                      <button type="button" onClick={() => setShowCustomTitle(false)} className="text-[10px] text-muted-foreground hover:text-foreground underline">Annuler</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowCustomTitle(true)} className="text-[10px] text-muted-foreground hover:text-foreground underline flex items-center gap-1">
                      <Pencil size={10} /> Modifier le titre
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Match MANUAL mode: all fields visible */}
          {formData.type === 'match' && matchMode === 'manual' && (
            <div className="animate-fade-in space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Pencil size={12} /> Saisie manuelle</span>
                <button type="button" onClick={() => setMatchMode(null)} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline">← Retour</button>
              </div>
              <div className="relative">
                <Type size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Titre (ex: Oisemont FC vs FC Paris)" className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>
            </div>
          )}

          {/* Title for non-match types */}
          {formData.type !== 'match' && (
            <div className="relative">
              <Type size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Titre (ex: Entraînement du mardi)" className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>
          )}

          {/* Hide date/time: for match auto → only after FFF selection; for match manual → show; for others → show */}
          {(formData.type !== 'match' || matchMode === 'manual' || (matchMode === 'auto' && fffMatchSelected)) && (
            <>
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
            </>
          )}

          {/* Duration - for training */}
          {formData.type === 'training' && (
            <div className="animate-fade-in">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Durée (minutes)</label>
              <div className="relative">
                <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  placeholder="90"
                  min="15"
                  max="300"
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Training location quick-select */}
          {formData.type === 'training' && (
            <div className="animate-fade-in">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lieu</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { key: 'stade' as const, label: 'Stade', value: 'Stade municipal, Oisemont' },
                  { key: 'salle' as const, label: 'Salle', value: 'Salle des sports, Oisemont' },
                  { key: 'autre' as const, label: 'Autre', value: '' },
                ]).map(loc => (
                  <button
                    key={loc.key}
                    type="button"
                    onClick={() => {
                      setTrainingLocationChoice(loc.key);
                      if (loc.key !== 'autre') {
                        setFormData(prev => ({ ...prev, location: loc.value }));
                        setLocationValid(true);
                      } else {
                        setFormData(prev => ({ ...prev, location: '' }));
                        setLocationValid(false);
                      }
                    }}
                    className={`px-2 py-2 rounded-xl text-[11px] font-semibold border-2 transition-all truncate ${
                      trainingLocationChoice === loc.key ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-secondary border-transparent text-muted-foreground hover:border-border'
                    }`}
                  >
                    <MapPin className="inline w-3 h-3 mr-0.5" />{loc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location autocomplete - for match: only manual mode or auto after selection with override; for training: only "Autre"; for other: always */}
          {(formData.type === 'other' || (formData.type === 'training' && trainingLocationChoice === 'autre') || (formData.type === 'match' && matchMode === 'manual' && (!formData.location || showLocationOverride)) || (formData.type === 'match' && matchMode === 'auto' && fffMatchSelected && (!formData.location || showLocationOverride))) && (
            <LocationAutocomplete
              value={formData.location}
              onChange={(location) => setFormData({ ...formData, location })}
              onValidSelection={setLocationValid}
            />
          )}
          {formData.type === 'match' && matchMode !== null && (matchMode === 'manual' || fffMatchSelected) && formData.location && !showLocationOverride && (
            <button type="button" onClick={() => setShowLocationOverride(true)} className="text-[10px] text-muted-foreground hover:text-foreground underline">
              Modifier le stade
            </button>
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
          {/* Notification - show only when mode is chosen for match, or for training */}
          {((formData.type === 'match' && matchMode !== null) || formData.type === 'training') && (
            <div className="p-4 bg-accent/5 rounded-xl border border-accent/10 animate-fade-in">
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, sendNotification: !prev.sendNotification }))}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${formData.sendNotification ? 'bg-accent border-accent' : 'border-border'}`}>
                  {formData.sendNotification && <span className="text-accent-foreground text-xs">✓</span>}
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Bell size={14} className="text-accent" /> Notifier les joueurs
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Notification push envoyée à tous les membres</p>
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
            onClick={() => onSubmit({ ...formData, duration: formData.duration ? parseInt(formData.duration, 10) : undefined })}
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
