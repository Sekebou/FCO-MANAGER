import React, { useState } from 'react';
import type { Player } from '@/pages/Dashboard';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { toast } from 'sonner';
import NativeDatePicker from '@/components/ui/native-date-picker';

interface Props {
  players: Player[];
  selectedPlayerId: string | null;
  onSubmit: (data: any) => void;
  onClose: () => void;
}

const AddCardForm = ({ players, selectedPlayerId, onSubmit, onClose }: Props) => {
  useBodyScrollLock();
  const [formData, setFormData] = useState({
    playerId: selectedPlayerId || '', type: 'yellow', reason: '', date: new Date().toISOString().split('T')[0], suspendedUntil: ''
  });

  const handleSubmit = () => {
    if (!formData.playerId || !formData.reason || !formData.date) { toast.warning('Remplissez tous les champs obligatoires'); return; }
    onSubmit(formData);
  };

  const selectedPlayer = players.find(p => p.id === formData.playerId);

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[70]" onClick={onClose}>
      <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[85vh] flex flex-col border border-border shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Drag handle mobile */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h3 className="text-base font-bold text-foreground">Nouveau carton</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Player select */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Joueur</label>
            <div className="relative">
              <select
                className="w-full py-2.5 px-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/30 text-sm transition-all appearance-none"
                value={formData.playerId}
                onChange={(e) => setFormData({ ...formData, playerId: e.target.value })}
                style={{ fontSize: '16px' }}
              >
                <option value="">Sélectionner un joueur</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Card type */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'yellow' })}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  formData.type === 'yellow'
                    ? 'bg-warning/15 border-warning/50 text-warning'
                    : 'bg-secondary border-border text-muted-foreground'
                }`}
              >
                🟨 Jaune
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'red' })}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  formData.type === 'red'
                    ? 'bg-destructive/15 border-destructive/50 text-destructive'
                    : 'bg-secondary border-border text-muted-foreground'
                }`}
              >
                🟥 Rouge
              </button>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Raison</label>
            <textarea
              placeholder="Ex: Faute sur le gardien"
              className="w-full p-3 bg-secondary border border-border rounded-xl h-16 text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-accent/30 text-sm resize-none transition-all"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Date</label>
              <NativeDatePicker
                value={formData.date}
                onChange={(date) => setFormData({ ...formData, date })}
                placeholder="Date"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Suspendu jusqu'au</label>
              <NativeDatePicker
                value={formData.suspendedUntil}
                onChange={(date) => setFormData({ ...formData, suspendedUntil: date })}
                placeholder="Optionnel"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2">
          <button
            onClick={handleSubmit}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all shadow-lg ${
              formData.type === 'red'
                ? 'bg-destructive text-destructive-foreground shadow-destructive/20'
                : 'bg-warning text-warning-foreground shadow-warning/20'
            }`}
          >
            Ajouter le carton
          </button>
          <button onClick={onClose} className="w-full py-2 mt-2 text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCardForm;
