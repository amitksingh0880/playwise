import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Reaction {
  id: number;
  emoji: string;
  x: number;
}

export const ReactionOverlay: React.FC = () => {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  useEffect(() => {
    const handleReaction = (e: any) => {
      const { emoji } = e.detail;
      const id = Date.now() + Math.random();
      const x = 20 + Math.random() * 60; // 20% to 80% width

      setReactions((prev) => [...prev, { id, emoji, x }]);

      // Remove after animation
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 4000);
    };

    window.addEventListener('playwise-reaction', handleReaction);
    return () => window.removeEventListener('playwise-reaction', handleReaction);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 100
    }}>
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ y: '100%', x: `${r.x}%`, opacity: 0, scale: 0.5, rotate: 0 }}
            animate={{ 
              y: '-10%', 
              opacity: [0, 1, 1, 0], 
              scale: [0.5, 1.5, 1.5, 1],
              rotate: Math.random() > 0.5 ? 45 : -45,
              x: `${r.x + (Math.random() * 20 - 10)}%`
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3.5, ease: "easeOut" }}
            style={{
              position: 'absolute',
              fontSize: '2rem',
              textShadow: '0 0 10px rgba(0,0,0,0.5)',
              filter: 'drop-shadow(0 0 5px rgba(255,100,0,0.3))'
            }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
