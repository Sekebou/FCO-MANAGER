import React, { useState } from 'react';
import { X, FileText, Megaphone, User } from 'lucide-react';

interface Props {
  onSubmit: (data: any) => void;
  onClose: () => void;
}

const AddNewsForm = ({ onSubmit, onClose }: Props) => {
  const [formData, setFormData] = useState({ title: '', content: '', author: '' });

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Megaphone size={20} className="text-accent" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Nouvelle actualité</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="relative">
            <FileText size={16} className="absolute left-3.5 top-3.5 text-muted-foreground" />
            <input type="text" placeholder="Titre de l'actualité" className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
          </div>

          <textarea
            placeholder="Contenu de l'actualité..."
            className="w-full p-4 bg-secondary border border-border rounded-xl h-32 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm resize-none transition-all"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          />

          <div className="relative">
            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Auteur" className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 text-sm transition-all" value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
            Annuler
          </button>
          <button
            onClick={() => onSubmit(formData)}
            disabled={!formData.title || !formData.content}
            className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-accent/20"
          >
            Publier
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddNewsForm;
