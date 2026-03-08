import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Coins, X } from 'lucide-react';

interface WinCelebrationProps {
  isVisible: boolean;
  onClose: () => void;
  amount: number;
  matchLabel: string;
  prediction: string;
}

// Confetti particle component
const Confetti = ({ index, total }: { index: number; total: number }) => {
  const colors = [
    'hsl(var(--primary))',
    '#FFD700',
    '#FFA500',
    '#FF6347',
    '#00CED1',
    '#7B68EE',
    '#32CD32',
    '#FF69B4',
  ];
  const color = colors[index % colors.length];
  const size = 6 + Math.random() * 8;
  const startX = Math.random() * 100;
  const drift = (Math.random() - 0.5) * 60;
  const delay = Math.random() * 0.8;
  const duration = 2.5 + Math.random() * 1.5;
  const rotation = Math.random() * 720 - 360;
  const isCircle = Math.random() > 0.5;

  return (
    <motion.div
      initial={{ 
        x: `${startX}vw`, 
        y: -20, 
        rotate: 0, 
        opacity: 1,
        scale: 0 
      }}
      animate={{ 
        x: `${startX + drift}vw`, 
        y: '110vh', 
        rotate: rotation,
        opacity: [1, 1, 1, 0],
        scale: [0, 1.2, 1, 0.8]
      }}
      transition={{ 
        duration, 
        delay,
        ease: 'easeIn'
      }}
      className="fixed z-[100] pointer-events-none"
      style={{
        width: size,
        height: isCircle ? size : size * 2.5,
        backgroundColor: color,
        borderRadius: isCircle ? '50%' : '2px',
      }}
    />
  );
};

// Sparkle burst component  
const Sparkle = ({ index }: { index: number }) => {
  const angle = (index / 12) * Math.PI * 2;
  const distance = 80 + Math.random() * 60;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;

  return (
    <motion.div
      initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
      animate={{ 
        x, 
        y, 
        scale: [0, 1.5, 0], 
        opacity: [1, 1, 0] 
      }}
      transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
      className="absolute w-2 h-2 rounded-full"
      style={{ backgroundColor: '#FFD700' }}
    />
  );
};

const WinCelebration = ({ isVisible, onClose, amount, matchLabel, prediction }: WinCelebrationProps) => {
  const [confettiCount] = useState(60);

  // Vibrate on show
  useEffect(() => {
    if (isVisible && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
  }, [isVisible]);

  // Auto-close after 6 seconds
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Confetti rain */}
          {Array.from({ length: confettiCount }).map((_, i) => (
            <Confetti key={`confetti-${i}`} index={i} total={confettiCount} />
          ))}

          {/* Dark overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[95] bg-black/60"
            onClick={onClose}
          />

          {/* Central popup */}
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ 
              type: 'spring', 
              damping: 12, 
              stiffness: 200,
              delay: 0.2 
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div 
              className="relative pointer-events-auto mx-6 w-full max-w-xs rounded-3xl p-6 text-center overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--card) / 0.95))',
                boxShadow: '0 0 60px rgba(255, 215, 0, 0.3), 0 20px 60px -15px rgba(0, 0, 0, 0.5)',
                border: '2px solid rgba(255, 215, 0, 0.3)',
              }}
            >
              {/* Golden glow */}
              <div 
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 50% 30%, rgba(255, 215, 0, 0.4), transparent 70%)',
                }}
              />

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 h-7 w-7 rounded-full bg-muted/50 flex items-center justify-center z-10"
              >
                <X size={14} className="text-muted-foreground" />
              </button>

              {/* Trophy icon with sparkles */}
              <div className="relative flex justify-center mb-4">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 8, stiffness: 150, delay: 0.4 }}
                  className="relative"
                >
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                      boxShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
                    }}
                  >
                    <Trophy size={36} className="text-white" strokeWidth={2.5} />
                  </div>
                  {/* Sparkle burst */}
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Sparkle key={`sparkle-${i}`} index={i} />
                  ))}
                </motion.div>
              </div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-xl font-black text-foreground mb-1 uppercase tracking-wide"
              >
                Pari Gagné ! 🎉
              </motion.h2>

              {/* Match info */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-xs text-muted-foreground mb-4"
              >
                {matchLabel} — <span className="font-semibold text-foreground">{prediction}</span>
              </motion.p>

              {/* Amount won */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.7 }}
                className="relative rounded-2xl py-4 px-6 mb-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 165, 0, 0.1))',
                  border: '1px solid rgba(255, 215, 0, 0.25)',
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <Coins size={24} className="text-amber-400" />
                  <CountUp target={amount} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-medium">
                  Points gagnés
                </p>
              </motion.div>

              {/* CTA */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                onClick={onClose}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground active:scale-95 transition-transform"
              >
                Continuer
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Animated counter
const CountUp = ({ target }: { target: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <span 
      className="text-3xl font-black tabular-nums"
      style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255, 215, 0, 0.3)' }}
    >
      +{count}
    </span>
  );
};

export default React.memo(WinCelebration);
