import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmModal = ({ title, message, confirmLabel = 'Supprimer', cancelLabel = 'Annuler', variant = 'danger', onConfirm, onClose }: Props) => {
  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header icon */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDanger ? 'bg-destructive/10' : 'bg-warning/10'}`}>
            {isDanger ? (
              <Trash2 size={28} className="text-destructive" />
            ) : (
              <AlertTriangle size={28} className="text-warning" />
            )}
          </div>
          <h3 className="text-lg font-bold text-foreground text-center">{title}</h3>
          <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all text-sm ${
              isDanger
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20'
                : 'bg-warning text-warning-foreground hover:bg-warning/90 shadow-lg shadow-warning/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
