import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomStore } from '../features/room/RoomStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, VideoOff, WifiOff } from 'lucide-react';

interface ParticipantGridProps {
  streams: Record<string, MediaStream>;
  send?: (data: any) => void;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({ streams, send }) => {
  const { users, userId, hostId } = useRoomStore();
  const isHost = userId === hostId;

  const handlePromote = (targetId: string, role: 'mod' | 'user') => {
    if (send) send({ type: 'update-role', targetId, role });
  };

  return (
    <div className="grid grid-cols-2 gap-2 md:gap-3">
      <AnimatePresence>
        {users.map((user, index) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.35, delay: index * 0.06 }}
          >
            <ParticipantCard
              user={user}
              stream={streams[user.id]}
              isLocal={user.id === userId}
              isHost={isHost}
              onPromote={handlePromote}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ParticipantCardProps {
  user: { id: string; name: string; role: string; color?: string; avatarUrl?: string };
  stream?: MediaStream;
  isLocal: boolean;
  isHost: boolean;
  onPromote: (id: string, role: 'mod' | 'user') => void;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({ user, stream, isLocal, isHost, onPromote }) => {
  const hasVideo = stream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

  return (
    <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-white/10 group shadow-[0_8px_32px_rgba(0,0,0,0.8)] hover:border-white/20 transition-all duration-300">
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 z-10 pointer-events-none" />

      {/* Video or avatar */}
      {stream && hasVideo ? (
        <VideoFeed stream={stream} isLocal={isLocal} />
      ) : (
        <AvatarPlaceholder user={user} hasStream={!!stream} />
      )}

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-2 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 max-w-[85%]">
          {/* Live indicator */}
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stream ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />

          <span className="text-[10px] font-black tracking-tight text-white uppercase truncate">
            {isLocal ? 'You' : user.name}
          </span>

          {user.role !== 'user' && (
            <Badge variant="ghost" className="h-4 px-1 bg-cyan-500/20 text-[8px] font-black uppercase text-cyan-400 border border-cyan-500/30 flex-shrink-0">
              {user.role}
            </Badge>
          )}

          {!stream && (
            <WifiOff className="h-2.5 w-2.5 text-slate-500 flex-shrink-0" />
          )}
        </div>

        {/* Host promote button */}
        {isHost && user.id !== useRoomStore.getState().userId && user.role !== 'mod' && (
          <Button
            size="icon"
            className="h-6 w-6 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all pointer-events-auto opacity-0 group-hover:opacity-100 flex-shrink-0"
            onClick={() => onPromote(user.id, 'mod')}
          >
            <Star className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── Video Feed ───────────────────────────────────────────────────────────────
const VideoFeed: React.FC<{ stream: MediaStream; isLocal: boolean }> = ({ stream, isLocal }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    video.srcObject = stream;
    setIsLoading(true);

    const onPlaying = () => { if (!cancelled) setIsLoading(false); };
    video.addEventListener('playing', onPlaying);

    video.play().catch(err => {
      if (!cancelled && err?.name !== 'AbortError') {
        console.warn('[VideoFeed] play() error:', err?.name);
      }
    });

    return () => {
      cancelled = true;
      video.removeEventListener('playing', onPlaying);
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
          <div className="w-6 h-6 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${isLocal ? '-scale-x-100' : ''}`}
        style={{ display: isLoading ? 'none' : 'block' }}
      />
    </div>
  );
};

// ─── Avatar Placeholder (no stream) ──────────────────────────────────────────
const AvatarPlaceholder: React.FC<{
  user: { name: string; color?: string; avatarUrl?: string };
  hasStream: boolean;
}> = ({ user, hasStream }) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-950">
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border-2"
      style={{ borderColor: user.color || '#c026d3', boxShadow: `0 0 20px ${user.color || '#c026d3'}33` }}
    >
      {user.avatarUrl && user.avatarUrl.length <= 2 ? (
        <span>{user.avatarUrl}</span>
      ) : (
        <span className="text-xl font-black" style={{ color: user.color || '#c026d3' }}>
          {user.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
    {!hasStream && (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 rounded-full border border-white/5">
        <VideoOff className="h-2.5 w-2.5 text-slate-500" />
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Camera off</span>
      </div>
    )}
  </div>
);
