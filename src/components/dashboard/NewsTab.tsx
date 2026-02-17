import React, { useState } from 'react';
import type { NewsItem, NewsComment, Member } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import { Bell, Plus, Trash2, Heart, MessageCircle, Send, X } from 'lucide-react';
import RoleBadge from '@/components/ui/role-badge';

interface Props {
  news: NewsItem[];
  comments: NewsComment[];
  members: Member[];
  currentUser: AppUser | null;
  canManage: () => boolean | null;
  canCreateNews: () => boolean | null;
  deleteNews: (id: string) => void;
  toggleLike: (newsId: string) => void;
  addComment: (newsId: string, content: string) => void;
  deleteComment: (commentId: string) => void;
  onAddNews: () => void;
}

const CommentAvatar: React.FC<{ authorUid: string; authorName: string; members: Member[] }> = ({ authorUid, authorName, members }) => {
  const member = members.find(m => m.id === authorUid);
  const photoURL = member?.photoURL;
  const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={authorName}
        className="w-8 h-8 rounded-lg object-cover shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
      <span className="text-primary-foreground text-xs font-bold">{initials}</span>
    </div>
  );
};

const NewsTab = ({ news, comments, members, currentUser, canManage, canCreateNews, deleteNews, toggleLike, addComment, deleteComment, onAddNews }: Props) => {
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  const getCommentsForNews = (newsId: string) => comments.filter(c => c.newsId === newsId);

  const handleAddComment = (newsId: string) => {
    const content = commentInputs[newsId];
    if (!content?.trim()) return;
    addComment(newsId, content);
    setCommentInputs(prev => ({ ...prev, [newsId]: '' }));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Actualités</h2>
        {canCreateNews() && (
          <button onClick={onAddNews} className="bg-accent text-accent-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl flex items-center gap-1.5 sm:gap-2 hover:bg-accent/90 transition-all text-xs sm:text-sm font-medium">
            <Plus size={16} /> <span className="hidden sm:inline">Nouvelle actualité</span><span className="sm:hidden">Actu</span>
          </button>
        )}
      </div>

      {news.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Bell className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground font-medium">Aucune actualité</p>
        </div>
      ) : (
        news.map(item => {
          const likes = item.likes || [];
          const isLiked = currentUser ? likes.includes(currentUser.uid) : false;
          const newsComments = getCommentsForNews(item.id);
          const isExpanded = expandedComments[item.id] || false;

          return (
            <div key={item.id} className="bg-card border border-border rounded-2xl overflow-hidden animate-fade-in">
              {/* Content */}
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-foreground">{item.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-accent">{item.author}</span>
                      {(() => {
                        const authorMember = members.find(m => m.id === item.authorId);
                        return authorMember ? <RoleBadge role={authorMember.role} /> : null;
                      })()}
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>
                  {(currentUser?.role === 'admin+' || currentUser?.role === 'admin' || ((currentUser?.role === 'entraineur' || currentUser?.role === 'dirigeant') && item.authorId === currentUser?.uid)) && (
                    <button onClick={() => deleteNews(item.id)} className="w-8 h-8 rounded-lg bg-destructive/5 hover:bg-destructive/15 flex items-center justify-center transition-all">
                      <Trash2 size={15} className="text-destructive" />
                    </button>
                  )}
                </div>
                <p className="text-foreground/80 text-sm leading-relaxed">{item.content}</p>
              </div>

              {/* Actions bar */}
              <div className="flex items-center gap-1 px-5 py-3 border-t border-border">
                <button
                  onClick={() => toggleLike(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isLiked
                      ? 'bg-destructive/10 text-destructive'
                      : 'hover:bg-secondary text-muted-foreground'
                  }`}
                >
                  <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                  <span>{likes.length > 0 ? likes.length : ''} J'aime</span>
                </button>

                <button
                  onClick={() => setExpandedComments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isExpanded ? 'bg-accent/10 text-accent' : 'hover:bg-secondary text-muted-foreground'
                  }`}
                >
                  <MessageCircle size={16} />
                  <span>{newsComments.length > 0 ? newsComments.length : ''} Commentaire{newsComments.length !== 1 ? 's' : ''}</span>
                </button>
              </div>

              {/* Comments section */}
              {isExpanded && (
                <div className="border-t border-border animate-fade-in">
                  {/* Comments list */}
                  {newsComments.length > 0 && (
                    <div className="px-5 py-3 space-y-3 max-h-64 overflow-y-auto">
                      {newsComments.map(comment => (
                        <div key={comment.id} className="flex gap-3 group">
                          <CommentAvatar authorUid={comment.authorUid} authorName={comment.authorName} members={members} />
                          <div className="flex-1 min-w-0">
                            <div className="bg-secondary rounded-xl px-3 py-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-foreground">{comment.authorName}</span>
                                {(() => {
                                  const commentMember = members.find(m => m.id === comment.authorUid);
                                  return commentMember ? <RoleBadge role={commentMember.role} /> : null;
                                })()}
                              </div>
                              <p className="text-sm text-foreground/80 mt-0.5">{comment.content}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1 px-1">
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {new Date(comment.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {(currentUser?.uid === comment.authorUid || currentUser?.role === 'admin+' || currentUser?.role === 'admin') && (
                                <button onClick={() => deleteComment(comment.id)} className="text-[10px] text-destructive/60 hover:text-destructive font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                  Supprimer
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment input */}
                  {currentUser && (
                    <div className="px-5 py-3 border-t border-border/50 flex items-center gap-3">
                      <CommentAvatar authorUid={currentUser.uid} authorName={currentUser.name} members={members} />
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Écrire un commentaire..."
                          className="w-full py-2.5 px-4 pr-12 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                          value={commentInputs[item.id] || ''}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment(item.id)}
                        />
                        <button
                          onClick={() => handleAddComment(item.id)}
                          disabled={!commentInputs[item.id]?.trim()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center disabled:opacity-30 hover:brightness-110 transition-all"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default NewsTab;
