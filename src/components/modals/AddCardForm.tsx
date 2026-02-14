import React, { useState } from 'react';
import type { Player } from '@/pages/Dashboard';

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
    if (!formData.playerId || !formData.reason || !formData.date) { alert('Remplissez tous les champs obligatoires'); return; }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl p-6 max-w-md w-full border border-border shadow-xl animate-fade-in">
        <h3 className="text-xl font-bold text-foreground mb-5">🟨🟥 Ajouter un carton</h3>

        <div className="mb-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Joueur *</label>
          <select className="w-full p-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.playerId} onChange={(e) => setFormData({ ...formData, playerId: e.target.value })}>
            <option value="">-- Sélectionner --</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type *</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="yellow" checked={formData.type === 'yellow'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="accent-warning" />
              <span className="px-3 py-1 bg-warning/20 text-warning rounded-lg font-medium text-sm">🟨 Jaune</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="red" checked={formData.type === 'red'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="accent-destructive" />
              <span className="px-3 py-1 bg-destructive/20 text-destructive rounded-lg font-medium text-sm">🟥 Rouge</span>
            </label>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Raison *</label>
          <textarea placeholder="Ex: Faute sur le gardien" className="w-full p-3 bg-secondary border border-border rounded-xl h-20 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm resize-none" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} />
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date du match *</label>
          <input type="date" className="w-full p-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Suspendu jusqu'au</label>
          <input type="date" className="w-full p-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.suspendedUntil} onChange={(e) => setFormData({ ...formData, suspendedUntil: e.target.value })} />
        </div>

        <div className="flex gap-2">
          <button onClick={handleSubmit} className="flex-1 bg-destructive text-destructive-foreground p-3 rounded-xl font-medium hover:bg-destructive/90 transition-all text-sm">Ajouter</button>
          <button onClick={onClose} className="flex-1 bg-secondary text-foreground p-3 rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">Annuler</button>
        </div>
      </div>
    </div>
  );
};

export default AddCardForm;
