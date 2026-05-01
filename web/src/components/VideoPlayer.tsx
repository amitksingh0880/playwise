import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomStore } from '../features/room/RoomStore';
import { Card } from '@/components/ui/card';
import { Info, Wifi } from 'lucide-react';
import Lottie from 'lottie-react';
import spinAnimation from '../assets/Spin.json';
import Hls from 'hls.js';
import { AnimatePresence } from 'framer-motion';

interface VideoPlayerProps {
  onSync: (state: { currentTime: number; isPlaying: boolean; playbackRate?: number }) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ onSync }) => {
  const { videoState, hostId, userId, isLocked, users } = useRoomStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const lastSyncTime = useRef<number>(0);
  
  const currentUser = users.find(u => u.id === userId);
  const isHost = userId === hostId;
  const isMod = currentUser?.role === 'mod';
  const canControl = isHost || isMod || !isLocked;
  
  const [localFileLoaded, setLocalFileLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const showPlaceholder = !videoState.sourceUrl && videoState.sourceType !== 'youtube' && videoState.sourceType !== 'local';

  // ─── Latency Compensated Seek ──────────────────────────────────────────────
  const performRobustSync = useCallback((targetTime: number, isPlaying: boolean, playbackRate: number, serverTime?: number) => {
    let compensatedTime = targetTime;
    
    // If we have serverTime, compensate for the network delay
    if (serverTime && isPlaying) {
      const delayMs = Date.now() - serverTime;
      const delaySec = delayMs / 1000;
      // Cap compensation at 5 seconds to avoid wild jumps on extreme lag
      compensatedTime += Math.min(delaySec * playbackRate, 5);
      console.log(`[Sync] Compensating for ${delayMs}ms delay. Target: ${targetTime.toFixed(2)} -> ${compensatedTime.toFixed(2)}`);
    }

    if (videoState.sourceType === 'youtube' && playerRef.current?.seekTo) {
      const playerTime = playerRef.current.getCurrentTime();
      const drift = Math.abs(playerTime - compensatedTime);
      
      // Only seek if drift is > 1.2s to prevent constant stutter
      if (drift > 1.2) {
        setIsSyncing(true);
        playerRef.current.seekTo(compensatedTime, true);
        setTimeout(() => setIsSyncing(false), 1000);
      }
      
      const playerState = playerRef.current.getPlayerState();
      if (isPlaying && playerState !== 1) playerRef.current.playVideo();
      else if (!isPlaying && playerState === 1) playerRef.current.pauseVideo();
      
      if (Math.abs(playerRef.current.getPlaybackRate() - playbackRate) > 0.01) {
        playerRef.current.setPlaybackRate(playbackRate);
      }
    } else if (videoState.sourceType !== 'youtube' && videoRef.current) {
      const playerTime = videoRef.current.currentTime;
      const drift = Math.abs(playerTime - compensatedTime);

      if (drift > 1.0) {
        setIsSyncing(true);
        videoRef.current.currentTime = compensatedTime;
        setTimeout(() => setIsSyncing(false), 1000);
      }
      
      if (isPlaying && videoRef.current.paused) videoRef.current.play().catch(() => {});
      else if (!isPlaying && !videoRef.current.paused) videoRef.current.pause();

      if (Math.abs(videoRef.current.playbackRate - playbackRate) > 0.01) {
        videoRef.current.playbackRate = playbackRate;
      }
    }
  }, [videoState.sourceType]);

  // ─── YouTube API Initialization ─────────────────────────────────────────────
  useEffect(() => {
    if (videoState.sourceType !== 'youtube' || showPlaceholder) return;
    let isMounted = true;

    const initPlayer = () => {
      if (!isMounted) return;
      const videoId = getYouTubeId(videoState.sourceUrl || '') || 'dQw4w9WgXcQ';
      
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        const currentId = getYouTubeId(videoState.sourceUrl);
        if (currentId) playerRef.current.loadVideoById(currentId);
        return;
      }

      try {
        playerRef.current = new (window as any).YT.Player('yt-player', {
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: canControl ? 1 : 0,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin,
            enablejsapi: 1,
          },
          events: {
            onReady: () => {
              if (!isMounted) return;
              if (!isHost) {
                performRobustSync(videoState.currentTime, videoState.isPlaying, videoState.playbackRate, videoState.serverTime);
              }
            },
            onStateChange: (event: any) => {
              if (canControl && isMounted && !isSyncing) {
                const isPlaying = event.data === (window as any).YT.PlayerState.PLAYING;
                onSync({ 
                  currentTime: playerRef.current.getCurrentTime(), 
                  isPlaying,
                  playbackRate: playerRef.current.getPlaybackRate()
                });
              }
            }
          },
        });
      } catch (e) {
        console.error('Failed to create YouTube player', e);
      }
    };

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    } else if ((window as any).YT.Player) {
      initPlayer();
    } else {
      const checkInterval = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          initPlayer();
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
    return () => { isMounted = false; };
  }, [videoState.sourceType, isHost, videoState.sourceUrl, showPlaceholder, canControl, onSync, performRobustSync]);

  // ─── Heartbeat Sync (Host -> Room) ──────────────────────────────────────────
  useEffect(() => {
    if (!isHost) return;

    const interval = setInterval(() => {
      let currentState: any = null;

      if (videoState.sourceType === 'youtube' && playerRef.current?.getCurrentTime) {
        currentState = {
          currentTime: playerRef.current.getCurrentTime(),
          isPlaying: playerRef.current.getPlayerState() === 1,
          playbackRate: playerRef.current.getPlaybackRate()
        };
      } else if (videoRef.current) {
        currentState = {
          currentTime: videoRef.current.currentTime,
          isPlaying: !videoRef.current.paused,
          playbackRate: videoRef.current.playbackRate
        };
      }

      if (currentState) {
        // Only broadcast if changed or every 5 seconds as a safety heartbeat
        const timeSinceLastSync = Date.now() - lastSyncTime.current;
        if (timeSinceLastSync > 5000) {
          onSync(currentState);
          lastSyncTime.current = Date.now();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, videoState.sourceType, onSync]);

  // ─── Reactive Sync (Room -> Client) ─────────────────────────────────────────
  useEffect(() => {
    if (isHost) return;
    performRobustSync(videoState.currentTime, videoState.isPlaying, videoState.playbackRate, videoState.serverTime);
  }, [videoState.lastUpdated, isHost, performRobustSync]);

  // ─── Source Loader ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (videoState.sourceType !== 'url' || !videoState.sourceUrl || !videoRef.current) return;
    let hls: Hls | null = null;
    if (Hls.isSupported() && videoState.sourceUrl.includes('.m3u8')) {
      hls = new Hls();
      hls.loadSource(videoState.sourceUrl);
      hls.attachMedia(videoRef.current);
    } else {
      videoRef.current.src = videoState.sourceUrl;
    }
    return () => { hls?.destroy(); };
  }, [videoState.sourceType, videoState.sourceUrl]);

  const handleLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && videoRef.current) {
      videoRef.current.src = URL.createObjectURL(file);
      setLocalFileLoaded(true);
      if (isHost) {
        onSync({ currentTime: 0, isPlaying: false, playbackRate: 1.0 });
        useRoomStore.getState().updateVideoState({ ...videoState, sourceType: 'local', currentTime: 0 });
      }
    }
  };

  const localFileName = (videoState as any).localFileName;
  const showParticipantPrompt = !isHost && videoState.sourceType === 'local' && !localFileLoaded && localFileName;

  return (
    <div className="w-full h-full bg-[#030308] relative overflow-hidden flex items-center justify-center border border-white/5 shadow-inner">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 pointer-events-none" />
      
      {/* Sync Status Overlay */}
      <AnimatePresence>
        {isSyncing && (
          <div className="absolute top-6 right-6 z-50 flex items-center gap-2 bg-fuchsia-600/20 backdrop-blur-md border border-fuchsia-500/50 px-4 py-2 rounded-full shadow-[0_0_20px_rgba(192,38,211,0.3)]">
            <Wifi className="w-4 h-4 text-fuchsia-400 animate-pulse" />
            <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">Syncing...</span>
          </div>
        )}
      </AnimatePresence>

      {showPlaceholder ? (
        <div className="flex flex-col items-center justify-center gap-6 h-full relative z-10">
          <div className="w-64 h-64 drop-shadow-[0_0_30px_rgba(6,182,212,0.5)]">
            <Lottie animationData={spinAnimation} loop={true} />
          </div>
          <div className="text-center space-y-3 mt-[-20px]">
            <h3 className="text-3xl font-black text-white tracking-tighter drop-shadow-md">The Stage is Empty</h3>
            <p className="text-cyan-400/80 font-bold tracking-widest uppercase text-sm">Waiting for host transmission...</p>
          </div>
        </div>
      ) : videoState.sourceType === 'youtube' ? (
        <div className="w-full h-full">
          <div id="yt-player" className="w-full h-full" />
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-contain relative z-10 drop-shadow-2xl"
          controls={canControl}
          onPlay={() => canControl && !isSyncing && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: true, playbackRate: videoRef.current!.playbackRate })}
          onPause={() => canControl && !isSyncing && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: false, playbackRate: videoRef.current!.playbackRate })}
          onSeeked={() => canControl && !isSyncing && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: !videoRef.current!.paused, playbackRate: videoRef.current!.playbackRate })}
          onRateChange={() => canControl && !isSyncing && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: !videoRef.current!.paused, playbackRate: videoRef.current!.playbackRate })}
        />
      )}

      {showParticipantPrompt && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-6 max-w-md text-center p-10 bg-slate-950/60 border border-white/10 rounded-[2rem] shadow-[0_0_80px_rgba(6,182,212,0.2)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-500 to-cyan-500" />
            <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
              <Info className="w-10 h-10 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-white tracking-tight mb-2">Sync Required</h3>
              <p className="text-slate-400 font-medium leading-relaxed">
                The host is currently playing:
                <strong className="block mt-3 p-3 bg-black/60 rounded-xl border border-white/5 text-cyan-400 font-mono tracking-wider shadow-inner">{localFileName}</strong>
              </p>
            </div>
            <Card className="w-full mt-4 border-dashed border-2 border-white/20 bg-white/5 hover:bg-white/10 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer group rounded-2xl overflow-hidden">
              <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-8 gap-3">
                <span className="text-4xl group-hover:scale-110 transition-transform duration-300">📁</span>
                <span className="text-sm font-bold text-slate-300 group-hover:text-cyan-400">SELECT LOCAL FILE</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => handleLocalFile(e)} />
              </label>
            </Card>
          </div>
        </div>
      )}

      {isHost && videoState.sourceType === 'local' && (
        <div className="absolute top-6 left-6 z-30">
          <Card className="bg-slate-950/60 backdrop-blur-xl border border-white/10 p-2.5 shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-2xl">
            <div className="flex items-center gap-3 px-2">
              <span className="text-lg">📁</span>
              <label className="cursor-pointer">
                <span className="text-xs font-black tracking-wider uppercase text-cyan-400 hover:text-cyan-300 transition-colors">
                  {localFileLoaded ? 'FILE ACTIVE — CHANGE' : 'SELECT SOURCE FILE'}
                </span>
                <input type="file" accept="video/*" onChange={handleLocalFile} className="hidden" />
              </label>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
