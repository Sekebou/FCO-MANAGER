import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Coins, X, Sparkles } from 'lucide-react';

interface WinCelebrationProps {
  totalWon: number;
  matchCount: number;
  onClose: () => void;
}

/** Single confetti piece */
const Confetti: React.FC<{ delay: number; left: number; color: string; size: number }> = ({ delay, left, color, size }) => (
  <motion.div
    initial={{ y: -20, x: 0, opacity: 1, rotate: 0, scale: 0 }}
    animate={{
      y: [0, 600, 900],
      x: [0, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 300],
      opacity: [1, 1, 0],
      rotate: [0, 360 + Math.random() * 720],
      scale: [0, 1, 0.5],
    }}
    transition={{ duration: 2.5 + Math.random() * 1.5, delay, ease: 'easeOut' }}
    className="absolute top-0 pointer-events-none"
    style={{
      left: `${left}%`,
      width: size,
      height: size * (Math.random() > 0.5 ? 1 : 2.5),
      backgroundColor: color,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
    }}
  />
);

const CONFETTI_COLORS = [
  '#FFD700', '#FF6B35', '#00E676', '#2979FF', '#FF4081',
  '#E040FB', '#FFAB00', '#00BCD4', '#76FF03', '#FF1744',
  '#651FFF', '#F50057', '#00E5FF', '#AEEA00',
];

const WinCelebration: React.FC<WinCelebrationProps> = ({ totalWon, matchCount, onClose }) => {
  const [show, setShow] = useState(true);

  // Generate confetti pieces once
  const confettiPieces = useMemo(() =>
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      delay: Math.random() * 0.8,
      left: Math.random() * 100,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 8,
    })),
  []);

  // Second wave of confetti
  const confettiWave2 = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i + 100,
      delay: 0.6 + Math.random() * 0.8,
      left: Math.random() * 100,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 5 + Math.random() * 7,
    })),
  []);

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 400);
  };

  // Auto close after 8s
  useEffect(() => {
    const timer = setTimeout(handleClose, 8000);
    return () => clearTimeout(timer);
  }, []);

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[80] flex items-center justify-center"
          onClick={handleClose}
        >
          {/* Blurred background */}
          <div className="absolute inset-0 bg-foreground/70 backdrop-blur-xl" />

          {/* Confetti layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confettiPieces.map(c => <Confetti key={c.id} {...c} />)}
            {confettiWave2.map(c => <Confetti key={c.id} {...c} />)}
          </div>

          {/* Main card */}
          <motion.div
            initial={{ scale: 0.3, opacity: 0, y: 60 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
            className="relative z-10 w-[85vw] max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* Glow effect behind */}
            <div className="absolute -inset-8 bg-gradient-to-b from-amber-400/30 via-amber-500/10 to-transparent rounded-full blur-3xl" />

            <div className="relative bg-gradient-to-b from-card via-card to-card/95 rounded-3xl border border-amber-500/30 shadow-2xl shadow-amber-500/20 overflow-hidden">
              {/* Top shimmer */}
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-transparent via-amber-400/10 to-transparent pointer-events-none"
              />

              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/80 hover:bg-secondary flex items-center justify-center z-20"
              >
                <X size={14} className="text-muted-foreground" />
              </button>

              <div className="px-6 pt-8 pb-6 text-center space-y-5">
                {/* Trophy icon with pulse */}
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.3 }}
                  className="relative mx-auto w-20 h-20"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 bg-amber-400/20 rounded-full blur-xl"
                  />
                  <div className="relative w-20 h-20 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/40">
                    <Trophy size={36} className="text-white drop-shadow-md" />
                  </div>
                  {/* Sparkles around */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                    className="absolute -inset-3"
                  >
                    <Sparkles size={16} className="absolute top-0 right-1 text-amber-400" />
                    <Sparkles size={12} className="absolute bottom-0 left-0 text-orange-400" />
                    <Sparkles size={14} className="absolute top-1/2 -right-2 text-yellow-300" />
                  </motion.div>
                </motion.div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <h2 className="text-2xl font-black text-foreground tracking-tight">
                    🎉 Bravo !
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {matchCount > 1
                      ? `Tu as gagné ${matchCount} paris !`
                      : 'Tu as gagné ton pari !'
                    }
                  </p>
                </motion.div>

                {/* Points won - big number */}
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.7 }}
                  className="py-5 px-6 bg-gradient-to-br from-amber-500/15 via-amber-400/10 to-orange-500/10 rounded-2xl border border-amber-500/20"
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Coins size={20} className="text-amber-400" />
                    <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Points gagnés</span>
                  </div>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    transition={{ delay: 0.9, duration: 0.6, ease: 'easeOut' }}
                    className="block text-5xl font-black bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent"
                  >
                    +{totalWon}
                  </motion.span>
                  <span className="text-xs text-muted-foreground font-medium mt-1 block">
                    pts ajoutés à ton solde
                  </span>
                </motion.div>

                {/* CTA */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleClose}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-amber-500/30 hover:brightness-110 transition-all"
                >
                  Encaisser 💰
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default WinCelebration;
