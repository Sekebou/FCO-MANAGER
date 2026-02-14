import React from 'react';
import type { NewsItem } from '@/pages/Dashboard';
import { Bell, Plus, Trash2 } from 'lucide-react';

interface Props {
  news: NewsItem[];
  canManage: () => boolean | null;
  deleteNews: (id: string) => void;
  onAddNews: () => void;
}

const NewsTab = ({ news, canManage, deleteNews, onAddNews }: Props) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Actualités</h2>
        {canManage() && (
          <button onClick={onAddNews} className="bg-accent text-accent-foreground px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-accent/90 transition-all text-sm font-medium">
            <Plus size={18} /> Nouvelle actualité
          </button>
        )}
      </div>

      {news.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Bell className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground font-medium">Aucune actualité</p>
        </div>
      ) : (
        news.map(item => (
          <div key={item.id} className="bg-card border border-border rounded-2xl p-5 animate-fade-in">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground">{item.title}</h3>
                <span className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString('fr-FR')}</span>
              </div>
              {canManage() && (
                <button onClick={() => deleteNews(item.id)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-all">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <p className="text-foreground/80 text-sm leading-relaxed mb-2">{item.content}</p>
            <p className="text-xs text-muted-foreground italic">Par {item.author}</p>
          </div>
        ))
      )}
    </div>
  );
};

export default NewsTab;
