import React, { useState } from 'react';

interface Props {
  onSubmit: (data: any) => void;
  onClose: () => void;
}

const AddNewsForm = ({ onSubmit, onClose }: Props) => {
  const [formData, setFormData] = useState({ title: '', content: '', author: '' });

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl p-6 max-w-md w-full border border-border shadow-xl animate-fade-in">
        <h3 className="text-xl font-bold text-foreground mb-5">Nouvelle actualité</h3>
        <input type="text" placeholder="Titre" className="w-full p-3 bg-secondary border border-border rounded-xl mb-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
        <textarea placeholder="Contenu" className="w-full p-3 bg-secondary border border-border rounded-xl mb-3 h-24 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm resize-none" value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} />
        <input type="text" placeholder="Auteur" className="w-full p-3 bg-secondary border border-border rounded-xl mb-4 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent text-sm" value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })} />
        <div className="flex gap-2">
          <button onClick={() => onSubmit(formData)} disabled={!formData.title || !formData.content} className="flex-1 bg-accent text-accent-foreground p-3 rounded-xl font-medium hover:bg-accent/90 transition-all disabled:opacity-50 text-sm">Publier</button>
          <button onClick={onClose} className="flex-1 bg-secondary text-foreground p-3 rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">Annuler</button>
        </div>
      </div>
    </div>
  );
};

export default AddNewsForm;
