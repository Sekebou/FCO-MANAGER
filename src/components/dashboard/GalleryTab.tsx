import React, { useState, useRef, useEffect } from 'react';
import type { AppUser } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Camera, Plus, FolderPlus, Trash2, Download, X, Image, Calendar, 
  ChevronLeft, Upload, Loader2, ZoomIn, FolderOpen, Heart, MessageCircle, Send, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export interface Album {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  coverUrl?: string;
}

export interface Photo {
  id: string;
  albumId: string;
  url: string;
  storagePath: string;
  title?: string;
  uploadedAt: string;
  uploadedBy: string;
  uploaderName: string;
  likes?: string[];
}

interface PhotoComment {
  id: string;
  photoId: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: string;
}

interface Props {
  albums: Album[];
  photos: Photo[];
  currentUser: AppUser | null;
  canManagePhotos: () => boolean;
  onCreateAlbum: (data: { name: string; description?: string }) => Promise<void>;
  onDeleteAlbum: (albumId: string) => void;
  onUploadPhotos: (albumId: string, files: File[]) => Promise<void>;
  onDeletePhoto: (photo: Photo) => void;
}

const GalleryTab = ({ albums, photos, currentUser, canManagePhotos, onCreateAlbum, onDeleteAlbum, onUploadPhotos, onDeletePhoto }: Props) => {
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [albumName, setAlbumName] = useState('');
  const [albumDesc, setAlbumDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const handleCreateAlbum = async () => {
    if (!albumName.trim()) {
      toast.warning('Veuillez entrer un nom pour l\'album');
      return;
    }
    try {
      await onCreateAlbum({ name: albumName.trim(), description: albumDesc.trim() || undefined });
      setAlbumName('');
      setAlbumDesc('');
      setShowCreateAlbum(false);
      toast.success('Album créé avec succès');
    } catch {
      toast.error('Erreur lors de la création de l\'album');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAlbum || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    
    const validFiles = files.filter(f => f.type.startsWith('image/') || /\.(heic|heif|jpg|jpeg|png|gif|webp)$/i.test(f.name));
    if (validFiles.length !== files.length) {
      toast.warning('Seules les images sont acceptées');
    }
    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: validFiles.length });
    try {
      for (let i = 0; i < validFiles.length; i++) {
        setUploadProgress({ current: i + 1, total: validFiles.length });
        await onUploadPhotos(selectedAlbum.id, [validFiles[i]]);
      }
      toast.success(`${validFiles.length} photo${validFiles.length > 1 ? 's' : ''} ajoutée${validFiles.length > 1 ? 's' : ''}`);
    } catch {
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (photo: Photo) => {
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.title || `photo-${photo.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors du téléchargement');
    }
  };

  // Likes — optimistic update via onLikesChanged callback
  const [localLikes, setLocalLikes] = useState<Record<string, string[]>>({});

  const getPhotoLikes = (photo: Photo): string[] => {
    return localLikes[photo.id] ?? photo.likes ?? [];
  };

  const toggleLike = async (photoId: string) => {
    if (!currentUser) return;
    // Optimistic update
    const photo = photos.find(p => p.id === photoId);
    const currentLikes = localLikes[photoId] ?? photo?.likes ?? [];
    const uid = currentUser.uid;
    const newLikes = currentLikes.includes(uid)
      ? currentLikes.filter(id => id !== uid)
      : [...currentLikes, uid];
    setLocalLikes(prev => ({ ...prev, [photoId]: newLikes }));
    
    try {
      await supabase.rpc('toggle_photo_like', { p_photo_id: photoId });
    } catch {
      // Revert on error
      setLocalLikes(prev => ({ ...prev, [photoId]: currentLikes }));
      toast.error('Erreur');
    }
  };

  const isLiked = (photo: Photo) => currentUser ? getPhotoLikes(photo).includes(currentUser.uid) : false;

  // Comments
  const loadComments = async (photoId: string) => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('photo_comments')
      .select('*')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true });
    if (data) {
      setComments(data.map((c: any) => ({
        id: c.id,
        photoId: c.photo_id,
        authorUid: c.author_uid,
        authorName: c.author_name,
        authorPhoto: c.author_photo,
        content: c.content,
        createdAt: c.created_at,
      })));
    }
    setLoadingComments(false);
  };

  const addComment = async (photoId: string) => {
    if (!commentText.trim() || !currentUser) return;
    const text = commentText.trim();
    setCommentText('');
    await supabase.from('photo_comments').insert({
      photo_id: photoId,
      author_uid: currentUser.uid,
      author_name: currentUser.name,
      author_photo: currentUser.photoURL || null,
      content: text,
    });
    await loadComments(photoId);
  };

  const deleteComment = async (commentId: string, photoId: string) => {
    await supabase.from('photo_comments').delete().eq('id', commentId);
    await loadComments(photoId);
  };

  // Lightbox navigation
  const albumPhotos = selectedAlbum ? photos.filter(p => p.albumId === selectedAlbum.id).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()) : [];
  
  const openLightbox = (photo: Photo) => {
    const idx = albumPhotos.findIndex(p => p.id === photo.id);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxPhoto(photo);
    setShowComments(false);
    setComments([]);
    loadComments(photo.id);
  };

  const navigateLightbox = (dir: 1 | -1) => {
    const newIdx = lightboxIndex + dir;
    if (newIdx >= 0 && newIdx < albumPhotos.length) {
      setLightboxIndex(newIdx);
      const newPhoto = albumPhotos[newIdx];
      setLightboxPhoto(newPhoto);
      setComments([]);
      setShowComments(false);
      loadComments(newPhoto.id);
    }
  };

  // Touch swipe for lightbox
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) navigateLightbox(diff > 0 ? 1 : -1);
  };

  // Album grid view
  if (!selectedAlbum) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-xl flex items-center justify-center">
              <Camera className="text-accent" size={18} />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Galerie photos</h2>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 bg-accent/10 text-accent px-3 py-2 rounded-xl">
              <FolderOpen size={14} />
              <span className="text-xs font-bold">{albums.length} album{albums.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl">
              <Image size={14} />
              <span className="text-xs font-bold">{photos.length} photo{photos.length > 1 ? 's' : ''}</span>
            </div>
            {canManagePhotos() && (
              <button 
                onClick={() => setShowCreateAlbum(true)} 
                className="bg-accent text-accent-foreground px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-accent/90 transition-all text-sm font-medium"
              >
                <FolderPlus size={18} /> Nouvel album
              </button>
            )}
          </div>
        </div>

        {/* Create album modal */}
        {showCreateAlbum && (
          <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowCreateAlbum(false)}>
            <div className="bg-card rounded-2xl w-full max-w-md border border-border shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h3 className="text-lg font-bold text-foreground">Créer un album</h3>
                <button onClick={() => setShowCreateAlbum(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Nom de l'album *</label>
                  <input
                    value={albumName}
                    onChange={e => setAlbumName(e.target.value)}
                    placeholder="Ex: Match du 15/02/2026"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Description</label>
                  <textarea
                    value={albumDesc}
                    onChange={e => setAlbumDesc(e.target.value)}
                    placeholder="Description optionnelle..."
                    rows={3}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button onClick={() => setShowCreateAlbum(false)} className="flex-1 px-4 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
                  Annuler
                </button>
                <button onClick={handleCreateAlbum} className="flex-1 px-4 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/90 transition-all text-sm">
                  Créer l'album
                </button>
              </div>
            </div>
          </div>
        )}

        {albums.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <Camera className="mx-auto mb-3 text-muted-foreground" size={48} />
            <p className="text-muted-foreground font-medium">Aucun album</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Les photos seront organisées par album</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {albums.map(album => {
              const albumPhotoCount = photos.filter(p => p.albumId === album.id).length;
              const cover = photos.find(p => p.albumId === album.id);
              return (
                <div
                  key={album.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                  onClick={() => setSelectedAlbum(album)}
                >
                  <div className="aspect-video bg-secondary relative overflow-hidden">
                    {cover ? (
                      <img src={cover.url} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera size={40} className="text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-base font-bold text-white truncate">{album.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-white/80">{albumPhotoCount} photo{albumPhotoCount > 1 ? 's' : ''}</span>
                        <span className="text-xs text-white/50">•</span>
                        <span className="text-xs text-white/80">{new Date(album.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    {album.description && (
                      <p className="text-xs text-muted-foreground truncate flex-1">{album.description}</p>
                    )}
                    {canManagePhotos() && (
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteAlbum(album.id); }}
                        className="ml-auto p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Album detail view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedAlbum(null)} className="p-2 hover:bg-secondary rounded-xl transition-all text-muted-foreground hover:text-foreground">
            <ChevronLeft size={22} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{selectedAlbum.name}</h2>
            {selectedAlbum.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{selectedAlbum.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl">
            <Image size={14} />
            <span className="text-xs font-bold">{albumPhotos.length} photo{albumPhotos.length > 1 ? 's' : ''}</span>
          </div>
          {canManagePhotos() && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-accent text-accent-foreground px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-accent/90 transition-all text-sm font-medium disabled:opacity-50"
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                {uploading && uploadProgress ? `${uploadProgress.current}/${uploadProgress.total}` : uploading ? 'Upload...' : 'Ajouter des photos'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Upload progress bar */}
      {uploading && uploadProgress && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Upload en cours...</span>
            <span className="text-xs text-muted-foreground">{uploadProgress.current}/{uploadProgress.total}</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-accent h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {albumPhotos.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Image className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground font-medium">Aucune photo dans cet album</p>
          {canManagePhotos() && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 bg-accent text-accent-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-accent/90 transition-all inline-flex items-center gap-2"
            >
              <Upload size={16} /> Ajouter des photos
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {albumPhotos.map(photo => {
            const liked = isLiked(photo);
            const likeCount = (photo.likes || []).length;
            return (
              <div key={photo.id} className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className="aspect-square relative overflow-hidden cursor-pointer" onClick={() => openLightbox(photo)}>
                  <img src={photo.url} alt={photo.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn size={24} className="text-white" />
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Calendar size={10} />
                      <span>{new Date(photo.uploadedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="truncate">{photo.uploaderName}</span>
                    </div>
                  </div>
                  {/* Like & comment row */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLike(photo.id); }}
                      className={`flex items-center gap-1 text-[11px] font-medium transition-all ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-400'}`}
                    >
                      <Heart size={13} className={liked ? 'fill-current' : ''} />
                      {likeCount > 0 && <span>{likeCount}</span>}
                    </button>
                    <button
                      onClick={() => openLightbox(photo)}
                      className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-accent transition-all"
                    >
                      <MessageCircle size={13} />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleDownload(photo)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-secondary hover:bg-accent hover:text-accent-foreground rounded-lg transition-all text-[10px] font-medium text-muted-foreground">
                      <Download size={11} /> Télécharger
                    </button>
                    {canManagePhotos() && (
                      <button onClick={() => onDeletePhoto(photo)} className="flex items-center justify-center px-2 py-1.5 bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground text-destructive rounded-lg transition-all">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox with swipe & comments */}
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/95 backdrop-blur-xl flex flex-col z-50"
            onClick={() => setLightboxPhoto(null)}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between p-4 shrink-0" onClick={e => e.stopPropagation()}>
              <div className="text-white/70 text-xs">
                {lightboxIndex + 1} / {albumPhotos.length}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleLike(lightboxPhoto.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${isLiked(lightboxPhoto) ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/70 hover:text-white'}`}
                >
                  <Heart size={16} className={isLiked(lightboxPhoto) ? 'fill-current' : ''} />
                  {(lightboxPhoto.likes || []).length > 0 && <span>{(lightboxPhoto.likes || []).length}</span>}
                </button>
                <button
                  onClick={() => setShowComments(!showComments)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${showComments ? 'bg-accent/20 text-accent' : 'bg-white/10 text-white/70 hover:text-white'}`}
                >
                  <MessageCircle size={16} />
                  {comments.length > 0 && <span>{comments.length}</span>}
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDownload(lightboxPhoto); }} className="bg-white/10 hover:bg-white/20 text-white/70 hover:text-white px-3 py-1.5 rounded-full text-sm transition-all">
                  <Download size={16} />
                </button>
                <button className="text-white/70 hover:text-white transition-colors" onClick={() => setLightboxPhoto(null)}>
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Image area with navigation */}
            <div
              className="flex-1 flex items-center justify-center relative min-h-0 px-4"
              onClick={() => setLightboxPhoto(null)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {lightboxIndex > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); navigateLightbox(-1); }}
                  className="absolute left-2 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hidden sm:block"
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              <img 
                src={lightboxPhoto.url} 
                alt={lightboxPhoto.title || ''} 
                className="max-w-full max-h-full object-contain rounded-xl"
                onClick={e => e.stopPropagation()}
              />
              {lightboxIndex < albumPhotos.length - 1 && (
                <button
                  onClick={e => { e.stopPropagation(); navigateLightbox(1); }}
                  className="absolute right-2 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hidden sm:block"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>

            {/* Bottom info */}
            <div className="p-4 shrink-0" onClick={e => e.stopPropagation()}>
              <div className="text-white/60 text-xs text-center">
                {lightboxPhoto.uploaderName} • {new Date(lightboxPhoto.uploadedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Comments panel */}
            <AnimatePresence>
              {showComments && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-border max-h-[50vh] flex flex-col"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                    <h4 className="text-sm font-bold text-foreground">Commentaires ({comments.length})</h4>
                    <button onClick={() => setShowComments(false)} className="text-muted-foreground hover:text-foreground">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingComments ? (
                      <div className="text-center py-4"><Loader2 size={20} className="animate-spin mx-auto text-muted-foreground" /></div>
                    ) : comments.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-4">Aucun commentaire</p>
                    ) : (
                      comments.map(c => (
                        <div key={c.id} className="flex gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-accent overflow-hidden">
                            {c.authorPhoto ? (
                              <img src={c.authorPhoto} className="w-full h-full object-cover" alt="" />
                            ) : c.authorName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              {currentUser && (c.authorUid === currentUser.uid || currentUser.role === 'admin+' || currentUser.role === 'admin') && (
                                <button onClick={() => deleteComment(c.id, lightboxPhoto.id)} className="text-muted-foreground/50 hover:text-destructive ml-auto">
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-foreground/80 mt-0.5 break-words">{c.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {currentUser && (
                    <div className="flex gap-2 p-4 border-t border-border shrink-0">
                      <input
                        ref={commentInputRef}
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addComment(lightboxPhoto.id)}
                        placeholder="Ajouter un commentaire..."
                        className="flex-1 px-3 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                      <button
                        onClick={() => addComment(lightboxPhoto.id)}
                        disabled={!commentText.trim()}
                        className="p-2.5 bg-accent text-accent-foreground rounded-xl disabled:opacity-30 hover:bg-accent/90 transition-all"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GalleryTab;
