import React, { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../features/room/RoomStore';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Info } from 'lucide-react';
import Lottie from 'lottie-react';
import spinAnimation from '../../public/Spin.json';

interface VideoPlayerProps {
  onSync: (state: { currentTime: number; isPlaying: boolean }) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ onSync }) => {
  const { videoState, hostId, userId, isLocked } = useRoomStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const isHost = userId === hostId;
  const canControl = isHost || !isLocked;
  const [localFileLoaded, setLocalFileLoaded] = useState(false);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const showPlaceholder = !videoState.sourceUrl && videoState.sourceType !== 'youtube' && videoState.sourceType !== 'local';

  // YouTube API Initialization
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

      const playerElement = document.getElementById('yt-player');
      if (!playerElement) return;

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
            onReady: (event: any) => {
              if (!isMounted) return;
              if (!isHost) {
                event.target.seekTo(videoState.currentTime, true);
                if (videoState.isPlaying) event.target.playVideo();
                else event.target.pauseVideo();
              }
            },
            onStateChange: (event: any) => {
              if (canControl && isMounted) {
                const isPlaying = event.data === (window as any).YT.PlayerState.PLAYING;
                onSync({ currentTime: playerRef.current.getCurrentTime(), isPlaying });
              }
            },
            onError: (err: any) => {
              console.error('YouTube Player Error:', err);
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

    return () => {
      isMounted = false;
    };
  }, [videoState.sourceType, isHost, videoState.sourceUrl, showPlaceholder]);

  // Periodic sync from host
  useEffect(() => {
    if (!isHost) return;

    const interval = setInterval(() => {
      if (videoState.sourceType === 'youtube' && playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && playerRef.current.getPlayerState) {
        const currentTime = playerRef.current.getCurrentTime();
        onSync({ currentTime, isPlaying: playerRef.current.getPlayerState() === 1 });
      } else if (videoState.sourceType !== 'youtube' && videoRef.current) {
        onSync({ currentTime: videoRef.current.currentTime, isPlaying: !videoRef.current.paused });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isHost, videoState.sourceType, onSync]);

  // Sync YouTube player when videoState changes
  useEffect(() => {
    if (videoState.sourceType === 'youtube' && playerRef.current && typeof playerRef.current.seekTo === 'function' && playerRef.current.getPlayerState) {
      if (!isHost) {
        const playerTime = playerRef.current.getCurrentTime();
        const drift = Math.abs(playerTime - videoState.currentTime);
        if (drift > 2.0) {
          playerRef.current.seekTo(videoState.currentTime, true);
        }
        
        const playerState = playerRef.current.getPlayerState();
        if (videoState.isPlaying && playerState !== 1) playerRef.current.playVideo();
        else if (!videoState.isPlaying && playerState === 1) playerRef.current.pauseVideo();
      }
    }
  }, [videoState, isHost]);

  // Sync HTML5 video player
  useEffect(() => {
    if (videoState.sourceType !== 'youtube' && videoRef.current) {
      if (!isHost) {
        const drift = Math.abs(videoRef.current.currentTime - videoState.currentTime);
        if (drift > 1.5) {
          videoRef.current.currentTime = videoState.currentTime;
        }
        if (videoState.isPlaying) videoRef.current.play().catch(() => {});
        else videoRef.current.pause();
      }
    }
  }, [videoState, isHost]);

  const handleLocalFile = (e: React.ChangeEvent<HTMLInputElement>, isParticipant = false) => {
    const file = e.target.files?.[0];
    if (file && videoRef.current) {
      const url = URL.createObjectURL(file);
      videoRef.current.src = url;
      setLocalFileLoaded(true);
      if (isHost && !isParticipant) {
        onSync({ 
          currentTime: 0, 
          isPlaying: false,
          // @ts-ignore
          localFileName: file.name 
        });
      }
      if (!isHost) {
        videoRef.current.currentTime = videoState.currentTime;
        if (videoState.isPlaying) videoRef.current.play().catch(() => {});
      }
    }
  };

  const localFileName = (videoState as any).localFileName;
  const showParticipantPrompt = !isHost && videoState.sourceType === 'local' && !localFileLoaded && localFileName;

  return (
    <div className="w-full h-full bg-black relative overflow-hidden flex items-center justify-center">
      {showPlaceholder ? (
        <div className="flex flex-col items-center justify-center gap-6 h-full">
          <div className="w-64 h-64">
            <Lottie animationData={spinAnimation} loop={true} />
          </div>
          <div className="text-center space-y-2 mt-[-20px]">
            <h3 className="text-2xl font-bold text-zinc-300 tracking-tight">Ready for the Show?</h3>
            <p className="text-zinc-500 font-medium">Waiting for the host to start a video...</p>
          </div>
        </div>
      ) : videoState.sourceType === 'youtube' ? (
        <div className="w-full h-full">
          <div id="yt-player" className="w-full h-full" />
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          controls={canControl}
          onPlay={() => canControl && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: true })}
          onPause={() => canControl && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: false })}
          onSeeked={() => canControl && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: !videoRef.current!.paused })}
        />
      )}

      {/* Participant prompt to load the same local file */}
      {showParticipantPrompt && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-6 max-w-md text-center p-8 bg-zinc-950/50 border border-zinc-800/50 rounded-3xl shadow-2xl">
            <Info className="w-12 h-12 text-orange-500" />
            <h3 className="text-2xl font-bold text-zinc-100">Load Your Copy</h3>
            <p className="text-zinc-400 leading-relaxed">
              The host is playing: <strong className="text-orange-400 font-mono block mt-2 p-2 bg-zinc-900 rounded-lg border border-zinc-800">{localFileName}</strong>
            </p>
            <p className="text-sm text-zinc-500">Please select the same file from your device to join the synchronized playback.</p>
            <Card className="w-full mt-4 border-dashed border-2 border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900 hover:border-orange-500/50 transition-colors cursor-pointer group">
              <label className="cursor-pointer w-full h-full flex items-center justify-center p-6">
                <span className="text-sm font-bold text-zinc-300 group-hover:text-orange-400 flex items-center gap-2">
                  <span className="text-xl">📂</span> Click to select the file
                </span>
                <input 
                  type="file" 
                  accept="video/*" 
                  className="hidden"
                  onChange={(e) => handleLocalFile(e, false)}
                />
              </label>
            </Card>
          </div>
        </div>
      )}

      {/* Host file picker (top-left corner) */}
      {isHost && videoState.sourceType === 'local' && (
        <div className="absolute top-6 left-6 z-10">
          <Card className="bg-zinc-950/80 backdrop-blur-md border-zinc-800/80 p-2 shadow-xl rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-sm">📂</span>
              <label className="cursor-pointer">
                <span className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors">
                  {localFileLoaded ? '✅ File loaded — change file' : 'Select local video file'}
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
