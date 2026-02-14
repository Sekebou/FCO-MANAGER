import React, { useState, useRef } from 'react';
import { db, doc, updateDoc } from '@/lib/firebase';
import type { AppUser } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface Props {
  currentUser: AppUser;
  onClose: () => void;
  onAvatarUpdated: (photoURL: string | null) => void;
}

const AvatarModal = ({ currentUser, onClose, onAvatarUpdated }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(currentUser.photoURL || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxWidth = 300, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target!.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const valid = ['image/jpeg', 'image/png', 'image/webp'];
    if (!valid.includes(file.type)) { alert('Format non supporté (JPG, PNG, WebP)'); return; }
    if (file.size > 3 * 1024 * 1024) { alert('Image trop lourde (max 3MB)'); return; }

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: compressed });
      setPhotoURL(compressed);
      const stored = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      stored.photoURL = compressed;
      sessionStorage.setItem('currentUser', JSON.stringify(stored));
      onAvatarUpdated(compressed);
      alert('✅ Photo mise à jour !');
    } catch (err: any) {
      alert('❌ Erreur: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Supprimer la photo ?')) return;
    setUploading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: null });
      setPhotoURL(null);
      const stored = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      stored.photoURL = null;
      sessionStorage.setItem('currentUser', JSON.stringify(stored));
      onAvatarUpdated(null);
    } catch (err: any) {
      alert('❌ Erreur: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl p-6 max-w-md w-full border border-border shadow-xl animate-fade-in">
        <h3 className="text-xl font-bold text-foreground mb-6 text-center">📸 Photo de profil</h3>

        <div className="flex flex-col items-center mb-6">
          {photoURL ? (
            <img src={photoURL} alt="Avatar" className="w-28 h-28 rounded-full object-cover border-4 border-accent shadow-lg" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-accent/20 flex items-center justify-center border-4 border-accent shadow-lg">
              <span className="text-5xl">
                {currentUser.role === 'admin' ? '👑' : currentUser.role === 'entraineur' ? '🎽' : '⚽'}
              </span>
            </div>
          )}
          <p className="mt-3 text-muted-foreground text-sm">{currentUser.name}</p>
        </div>

        <div className="space-y-3">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full bg-accent text-accent-foreground py-3 rounded-xl font-medium hover:bg-accent/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
            {uploading ? <><Loader2 size={16} className="animate-spin" /> Traitement...</> : <>📤 {photoURL ? 'Changer la photo' : 'Ajouter une photo'}</>}
          </button>
          {photoURL && (
            <button onClick={handleDelete} disabled={uploading} className="w-full bg-destructive text-destructive-foreground py-3 rounded-xl font-medium hover:bg-destructive/90 transition-all disabled:opacity-50 text-sm">🗑️ Supprimer</button>
          )}
          <button onClick={onClose} disabled={uploading} className="w-full bg-secondary text-foreground py-3 rounded-xl font-medium hover:bg-secondary/80 transition-all disabled:opacity-50 text-sm">Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default AvatarModal;
