import React, { useEffect, useRef } from 'react';
import { useRoomStore } from '../features/room/RoomStore';
import { Box, Card, Flex, Text, Heading } from '@radix-ui/themes';
import { VideoIcon } from '@radix-ui/react-icons';
import { motion } from 'framer-motion';

interface VideoPlayerProps {
  onSync: (state: { currentTime: number; isPlaying: boolean }) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ onSync }) => {
  const { videoState, hostId, userId } = useRoomStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const isHost = userId === hostId;

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const showPlaceholder = !videoState.sourceUrl && videoState.sourceType !== 'youtube' && videoState.sourceType !== 'local';

  useEffect(() => {
    if (videoState.sourceType === 'youtube') {
      const videoId = getYouTubeId(videoState.sourceUrl || '') || 'dQw4w9WgXcQ'; // Default to a demo video if none provided

      if (!(window as any).YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const initPlayer = () => {
        if (playerRef.current) {
          if (videoState.sourceUrl) {
            const currentId = getYouTubeId(videoState.sourceUrl);
            if (currentId) playerRef.current.loadVideoById(currentId);
          }
          return;
        }

        playerRef.current = new (window as any).YT.Player('yt-player', {
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: isHost ? 1 : 0,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (event: any) => {
              if (!isHost) {
                event.target.seekTo(videoState.currentTime);
                if (videoState.isPlaying) event.target.playVideo();
                else event.target.pauseVideo();
              }
            },
            onStateChange: (event: any) => {
              if (isHost) {
                const isPlaying = event.data === (window as any).YT.PlayerState.PLAYING;
                onSync({ currentTime: playerRef.current.getCurrentTime(), isPlaying });
              }
            },
          },
        });
      };

      if ((window as any).YT && (window as any).YT.Player) {
        initPlayer();
      } else {
        (window as any).onYouTubeIframeAPIReady = initPlayer;
      }
    }
  }, [videoState.sourceType, isHost, onSync]);

  // Sync YouTube player when videoState changes
  useEffect(() => {
    if (videoState.sourceType === 'youtube' && playerRef.current && playerRef.current.seekTo) {
      if (!isHost) {
        const drift = Math.abs(playerRef.current.getCurrentTime() - videoState.currentTime);
        if (drift > 1.5) {
          playerRef.current.seekTo(videoState.currentTime);
        }
        if (videoState.isPlaying) playerRef.current.playVideo();
        else playerRef.current.pauseVideo();
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
        if (videoState.isPlaying) videoRef.current.play();
        else videoRef.current.pause();
      }
    }
  }, [videoState, isHost]);

  const handleLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && videoRef.current) {
      const url = URL.createObjectURL(file);
      videoRef.current.src = url;
    }
  };

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
              background: 'var(--violet-a3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--violet-a4)'
            }}>
              <VideoIcon width={48} height={48} color="var(--violet-9)" />
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
          controls={isHost}
          onPlay={() => isHost && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: true })}
          onPause={() => isHost && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: false })}
          onSeeked={() => isHost && onSync({ currentTime: videoRef.current!.currentTime, isPlaying: !videoRef.current!.paused })}
        />
      )}

      {isHost && videoState.sourceType === 'local' && (
        <Box position="absolute" top="4" left="4" style={{ zIndex: 10 }}>
          <Card size="1">
            <input type="file" accept="video/*" onChange={handleLocalFile} style={{ fontSize: '12px' }} />
          </Card>
        </Box>
      )}
    </Box>
  );
};
