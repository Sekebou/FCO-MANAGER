import React, { useState } from 'react';

interface Props {
  onSubmit: (data: any) => void;
  onClose: () => void;
}

const AddEventForm = ({ onSubmit, onClose }: Props) => {
  const [formData, setFormData] = useState({ title: '', date: '', type: 'match', sendNotification: true });

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl p-6 max-w-md w-full border border-border shadow-xl animate-fade-in">
        <h3 className="text-xl font-bold text-foreground mb-5">Ajouter un événement</h3>
        <input type="text" placeholder="Titre (ex: Match vs FC Paris)" className="w-full p-3 bg-secondary border border-border rounded-xl mb-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
        <input type="date" className="w-full p-3 bg-secondary border border-border rounded-xl mb-3 text-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
        <select className="w-full p-3 bg-secondary border border-border rounded-xl mb-3 text-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
          <option value="match">Match</option><option value="training">Entraînement</option><option value="other">Autre</option>
        </select>

        {(formData.type === 'match' || formData.type === 'training') && (
          <div className="mb-4 p-3 bg-accent/5 border border-accent/20 rounded-xl">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.sendNotification} onChange={(e) => setFormData({ ...formData, sendNotification: e.target.checked })} className="mt-1 accent-accent" />
              <div>
                <span className="font-medium text-sm text-foreground">📧 Notifier les joueurs</span>
                <p className="text-xs text-muted-foreground mt-0.5">Email de confirmation de présence</p>
              </div>
            </label>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => onSubmit(formData)} disabled={!formData.title || !formData.date} className="flex-1 bg-accent text-accent-foreground p-3 rounded-xl font-medium hover:bg-accent/90 transition-all disabled:opacity-50 text-sm">Ajouter</button>
          <button onClick={onClose} className="flex-1 bg-secondary text-foreground p-3 rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">Annuler</button>
        </div>
      </div>
    </div>
  );
};

export default AddEventForm;
