import React, { useState } from 'react';
import type { Player } from '@/pages/Dashboard';
import { X, AlertCircle, Calendar, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  players: Player[];
  selectedPlayerId: string | null;
  onSubmit: (data: any) => void;
  onClose: () => void;
}

const AddCardForm = ({ players, selectedPlayerId, onSubmit, onClose }: Props) => {
  const [formData, setFormData] = useState({
    playerId: selectedPlayerId || '', type: 'yellow', reason: '', date: new Date().toISOString().split('T')[0], suspendedUntil: ''
  });

  const handleSubmit = () => {
    if (!formData.playerId || !formData.reason || !formData.date) { toast.warning('Remplissez tous les champs obligatoires'); return; }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
              <AlertCircle size={20} className="text-destructive" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Ajouter un carton</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Player select */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Joueur</label>
            <select className="w-full py-3 px-4 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all appearance-none" value={formData.playerId} onChange={(e) => setFormData({ ...formData, playerId: e.target.value })}>
              <option value="">-- Sélectionner --</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Card type */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Type de carton</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'yellow' })}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  formData.type === 'yellow'
                    ? 'bg-warning/15 border-warning/40 text-warning scale-[1.02]'
                    : 'bg-secondary border-transparent text-muted-foreground hover:border-border'
                }`}
              >
                🟨 Jaune
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'red' })}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  formData.type === 'red'
                    ? 'bg-destructive/15 border-destructive/40 text-destructive scale-[1.02]'
                    : 'bg-secondary border-transparent text-muted-foreground hover:border-border'
                }`}
              >
                🟥 Rouge
              </button>
            </div>
          </div>

          {/* Reason */}
          <div className="relative">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raison</label>
            <textarea placeholder="Ex: Faute sur le gardien" className="w-full p-4 bg-secondary border border-border rounded-xl h-20 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm resize-none transition-all" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Date</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="date" className="w-full pl-10 pr-3 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/50 text-sm transition-all" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Suspendu jusqu'au</label>
              <input type="date" className="w-full px-3 py-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent/50 text-sm transition-all" value={formData.suspendedUntil} onChange={(e) => setFormData({ ...formData, suspendedUntil: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 bg-destructive text-destructive-foreground rounded-xl font-medium hover:bg-destructive/90 transition-all text-sm shadow-lg shadow-destructive/20"
          >
            Ajouter le carton
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCardForm;
