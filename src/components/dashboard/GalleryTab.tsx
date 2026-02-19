import React, { useState, useRef } from 'react';
import type { AppUser } from '@/contexts/AuthContext';
import { 
  Camera, Plus, FolderPlus, Trash2, Download, X, Image, Calendar, 
  ChevronLeft, Upload, Loader2, ZoomIn, FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';

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
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    // Sur iOS, les images HEIC sont valides aussi
    const validFiles = files.filter(f => f.type.startsWith('image/') || /\.(heic|heif|jpg|jpeg|png|gif|webp)$/i.test(f.name));
    if (validFiles.length !== files.length) {
      toast.warning('Seules les images sont acceptées');
    }
    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      await onUploadPhotos(selectedAlbum.id, validFiles);
      toast.success(`${validFiles.length} photo${validFiles.length > 1 ? 's' : ''} ajoutée${validFiles.length > 1 ? 's' : ''}`);
    } catch {
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
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

  const albumPhotos = selectedAlbum ? photos.filter(p => p.albumId === selectedAlbum.id) : [];

  // Album grid view
  if (!selectedAlbum) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Camera size={28} className="text-accent" />
            <h2 className="text-2xl font-bold text-foreground">Galerie photos</h2>
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
                  {/* Cover image */}
                  <div className="aspect-video bg-secondary relative overflow-hidden">
                    {cover ? (
                      <img src={cover.url} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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

                  {/* Footer */}
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
                {uploading ? 'Upload...' : 'Ajouter des photos'}
              </button>
            </>
          )}
        </div>
      </div>

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
          {albumPhotos
            .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
            .map(photo => (
            <div key={photo.id} className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300">
              <div className="aspect-square relative overflow-hidden cursor-pointer" onClick={() => setLightboxPhoto(photo)}>
                <img src={photo.url} alt={photo.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <ZoomIn size={24} className="text-white" />
                </div>
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Calendar size={10} />
                  <span>{new Date(photo.uploadedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="truncate">{photo.uploaderName}</span>
                </div>
                <div className="flex gap-1 mt-1.5">
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
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-foreground/90 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setLightboxPhoto(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors" onClick={() => setLightboxPhoto(null)}>
            <X size={28} />
          </button>
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div className="text-white/70 text-sm">
              <span>{lightboxPhoto.uploaderName}</span>
              <span className="mx-2">•</span>
              <span>{new Date(lightboxPhoto.uploadedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleDownload(lightboxPhoto); }} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm transition-all">
              <Download size={16} /> Télécharger
            </button>
          </div>
          <img 
            src={lightboxPhoto.url} 
            alt={lightboxPhoto.title || ''} 
            className="max-w-full max-h-[80vh] object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default GalleryTab;
