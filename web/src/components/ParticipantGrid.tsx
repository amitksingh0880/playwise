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
            <Card className="p-0 overflow-hidden relative bg-zinc-900 border-zinc-800 shadow-md aspect-video">
              {streams[user.id] ? (
                <VideoFeed stream={streams[user.id]} isLocal={user.id === userId} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                  <Avatar className="h-16 w-16 border-2 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                    <AvatarFallback className="bg-zinc-800 text-orange-400 font-bold text-xl">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-xs font-bold text-white drop-shadow-md">{user.name}</span>
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
      className={`w-full h-full object-cover bg-zinc-950 ${isLocal ? '-scale-x-100' : ''}`}
    />
  );
};
