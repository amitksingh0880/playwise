import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomStore } from '../features/room/RoomStore';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ParticipantGridProps {
  streams: Record<string, MediaStream>;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({ streams }) => {
  const { users, userId } = useRoomStore();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <AnimatePresence>
        {users.map((user, index) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <Card className="p-0 overflow-hidden relative bg-[#020205] border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] aspect-video rounded-2xl group">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-cyan-500/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20" />
              {streams[user.id] ? (
                <VideoFeed stream={streams[user.id]} isLocal={user.id === userId} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900/50">
                  <Avatar className="h-20 w-20 border-2 border-fuchsia-500 shadow-[0_0_20px_rgba(192,38,211,0.5)]">
                    <AvatarFallback className="bg-slate-950 text-fuchsia-400 font-black text-2xl">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2.5 z-30 shadow-lg">
                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-pulse" />
                <span className="text-xs font-black tracking-wider uppercase text-white drop-shadow-md">{user.name}</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const VideoFeed: React.FC<{ stream: MediaStream; isLocal: boolean }> = ({ stream, isLocal }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    video.srcObject = stream;

    const tryPlay = async () => {
      try {
        await video.play();
      } catch (err: any) {
        if (!cancelled && err?.name !== 'AbortError') {
          console.warn('VideoFeed play error:', err?.name);
        }
      }
    };

    tryPlay();

    return () => {
      cancelled = true;
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className={`w-full h-full object-cover relative z-10 ${isLocal ? '-scale-x-100' : ''}`}
    />
  );
};
