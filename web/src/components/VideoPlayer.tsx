import React, { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../features/room/RoomStore';
import { Box, Card, Flex, Text, Heading, Button, Callout } from '@radix-ui/themes';
import { VideoIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { motion } from 'framer-motion';

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
        if (drift > 2.0) { // Increased threshold slightly for stability
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
      // Host broadcasts the filename so participants know which file to load
      if (isHost && !isParticipant) {
        onSync({ 
          currentTime: 0, 
          isPlaying: false,
          // @ts-ignore — extend sync state with filename hint
          localFileName: file.name 
        });
      }
      // Immediately seek to current synced time
      if (!isHost) {
        videoRef.current.currentTime = videoState.currentTime;
        if (videoState.isPlaying) videoRef.current.play().catch(() => {});
      }
    }
  };

  const localFileName = (videoState as any).localFileName;
  const showParticipantPrompt = !isHost && videoState.sourceType === 'local' && !localFileLoaded && localFileName;

  return (
    <Box width="100%" height="100%" style={{ backgroundColor: 'black', position: 'relative', overflow: 'hidden' }}>
      {showPlaceholder ? (
        <Flex align="center" justify="center" direction="column" gap="4" style={{ height: '100%' }}>
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Box style={{ 
              width: 120, 
              height: 120, 
              borderRadius: '50%', 
              background: 'var(--orange-a3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--orange-a4)'
            }}>
              <VideoIcon width={48} height={48} color="var(--orange-9)" />
            </Box>
          </motion.div>
          <Box style={{ textAlign: 'center' }}>
            <Heading size="4">Ready for the Show?</Heading>
            <Text size="2" color="gray">Waiting for the host to start a video...</Text>
          </Box>
        </Flex>
      ) : videoState.sourceType === 'youtube' ? (
        <Box width="100%" height="100%">
          <div id="yt-player" style={{ width: '100%', height: '100%' }} />
        </Box>
      ) : (
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%' }}
          controls={canControl}
          onPlay={() => canControl && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: true })}
          onPause={() => canControl && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: false })}
          onSeeked={() => canControl && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: !videoRef.current!.paused })}
        />
      )}

      {/* Participant prompt to load the same local file */}
      {showParticipantPrompt && (
        <Box 
          position="absolute" 
          style={{ inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Flex direction="column" align="center" gap="4" style={{ maxWidth: 400, textAlign: 'center', padding: 32 }}>
            <InfoCircledIcon width={40} height={40} color="var(--orange-9)" />
            <Heading size="4">Load Your Copy of the File</Heading>
            <Text size="2" color="gray">
              The host is playing: <strong style={{ color: 'var(--orange-11)' }}>{localFileName}</strong>
              <br /><br />
              Please select the same file from your device to join the synchronized playback.
            </Text>
            <Card style={{ padding: 16, width: '100%', textAlign: 'center', cursor: 'pointer', border: '1px dashed var(--orange-a6)', background: 'var(--orange-a2)' }}>
              <label style={{ cursor: 'pointer' }}>
                <Text size="2" weight="bold" style={{ color: 'var(--orange-11)' }}>📂 Click to select the file</Text>
                <input 
                  type="file" 
                  accept="video/*" 
                  style={{ display: 'none' }}
                  onChange={(e) => handleLocalFile(e, false)}
                />
              </label>
            </Card>
          </Flex>
        </Box>
      )}

      {/* Host file picker (top-left corner) */}
      {isHost && videoState.sourceType === 'local' && (
        <Box position="absolute" top="4" left="4" style={{ zIndex: 10 }}>
          <Card size="1">
            <Flex align="center" gap="2">
              <Text size="1" color="gray">📂</Text>
              <label style={{ cursor: 'pointer' }}>
                <Text size="1" weight="bold" style={{ color: 'var(--orange-11)' }}>
                  {localFileLoaded ? '✅ File loaded — change file' : 'Select local video file'}
                </Text>
                <input type="file" accept="video/*" onChange={handleLocalFile} style={{ display: 'none' }} />
              </label>
            </Flex>
          </Card>
        </Box>
      )}
    </Box>
  );
};
