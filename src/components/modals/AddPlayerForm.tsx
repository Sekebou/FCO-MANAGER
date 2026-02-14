import React, { useState } from 'react';

interface Props {
  onSubmit: (data: any) => void;
  onClose: () => void;
}

const AddPlayerForm = ({ onSubmit, onClose }: Props) => {
  const [formData, setFormData] = useState({
    name: '', position: 'Attaquant', createAccount: true, email: '', password: '', licenseExpiry: ''
  });

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-border shadow-xl animate-fade-in">
        <h3 className="text-xl font-bold text-foreground mb-5">Ajouter un joueur</h3>

        <div className="mb-4 pb-4 border-b border-border">
          <h4 className="font-medium mb-3 text-sm text-muted-foreground">📋 Informations</h4>
          <input type="text" placeholder="Nom complet" className="w-full p-3 bg-secondary border border-border rounded-xl mb-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          <select className="w-full p-3 bg-secondary border border-border rounded-xl mb-3 text-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })}>
            <option>Gardien</option><option>Défenseur</option><option>Milieu</option><option>Attaquant</option>
          </select>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">🎫 Expiration licence</label>
            <input type="date" className="w-full p-3 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.licenseExpiry} onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })} />
          </div>
        </div>

        <div className="mb-5">
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={formData.createAccount} onChange={(e) => setFormData({ ...formData, createAccount: e.target.checked })} className="w-4 h-4 accent-accent" />
            <span className="font-medium text-sm text-foreground">🔐 Créer un compte</span>
          </label>
          {formData.createAccount && (
            <div className="space-y-3 bg-accent/5 p-3 rounded-xl">
              <input type="email" placeholder="Email" className="w-full p-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              <input type="text" placeholder="Mot de passe (min. 6)" className="w-full p-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => onSubmit(formData)} disabled={!formData.name || (formData.createAccount && (!formData.email || !formData.password))} className="flex-1 bg-accent text-accent-foreground p-3 rounded-xl font-medium hover:bg-accent/90 transition-all disabled:opacity-50 text-sm">Ajouter</button>
          <button onClick={onClose} className="flex-1 bg-secondary text-foreground p-3 rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">Annuler</button>
        </div>
      </div>
    </div>
  );
};

export default AddPlayerForm;
