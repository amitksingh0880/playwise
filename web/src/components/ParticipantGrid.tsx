import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomStore } from '../features/room/RoomStore';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ParticipantGridProps {
  streams: Record<string, MediaStream>;
  send?: (data: any) => void;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({ streams, send }) => {
  const { users, userId, hostId } = useRoomStore();
  const isHost = userId === hostId;

  const handlePromote = (targetId: string, role: "mod" | "user") => {
    if (send) send({ type: 'update-role', targetId, role });
  };

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
                <div className="w-full h-full flex items-center justify-center bg-slate-950">
                  <Avatar className="h-24 w-24 border-2 shadow-[0_0_40px_rgba(0,0,0,0.5)]" style={{ borderColor: user.color || '#c026d3' }}>
                    <AvatarFallback className="bg-slate-900 font-black text-4xl" style={{ color: user.color || '#c026d3' }}>
                      {user.avatarUrl || user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none z-30">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 shadow-lg group-hover:bg-fuchsia-500/20 group-hover:border-fuchsia-500/30 transition-all">
                  <div className={`w-1.5 h-1.5 rounded-full ${streams[user.id] ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                  <span className="text-[10px] font-black tracking-tight text-white uppercase truncate max-w-[80px]">
                    {user.name}
                  </span>
                  {user.role !== 'user' && (
                    <Badge variant="ghost" className="h-4 px-1 bg-white/10 text-[8px] font-black uppercase text-cyan-400 border-none">
                      {user.role}
                    </Badge>
                  )}
                </div>
                
                {isHost && user.id !== userId && user.role !== 'mod' && (
                  <Button 
                    size="icon"
                    className="h-6 w-6 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all pointer-events-auto opacity-0 group-hover:opacity-100"
                    onClick={() => handlePromote(user.id, 'mod')}
                  >
                    <Star className="h-3 w-3" />
                  </Button>
                )}
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
