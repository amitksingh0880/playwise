import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomStore } from '../features/room/RoomStore';
import { Grid, Box, Text, Avatar, Card, AspectRatio, Badge } from '@radix-ui/themes';

interface ParticipantGridProps {
  streams: Record<string, MediaStream>;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({ streams }) => {
  const { users } = useRoomStore();

  return (
    <Grid columns="2" gap="3">
      <AnimatePresence>
        {users.map((user, index) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <Card style={{ 
              padding: 0, 
              overflow: 'hidden', 
              position: 'relative', 
              backgroundColor: 'var(--gray-3)',
              boxShadow: 'var(--shadow-3)',
              border: '1px solid var(--gray-a4)'
            }}>
              <AspectRatio ratio={16 / 9}>
                {streams[user.id] ? (
                  <VideoFeed stream={streams[user.id]} isLocal={false} />
                ) : (
                  <Box 
                    width="100%" 
                    height="100%" 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, var(--gray-3), var(--gray-4))'
                    }}
                  >
                    <Avatar 
                      size="5" 
                      fallback={user.name.charAt(0)} 
                      variant="soft" 
                      color="orange"
                      radius="full"
                    />
                  </Box>
                )}
              </AspectRatio>
              
              <Box 
                position="absolute" 
                bottom="2" 
                left="2" 
                style={{ 
                  backgroundColor: 'rgba(0,0,0,0.5)', 
                  backdropFilter: 'blur(8px)',
                  padding: '2px 8px', 
                  borderRadius: 'var(--radius-2)',
                  border: '1px solid var(--white-a3)'
                }}
              >
                <Flex align="center" gap="2">
                  <Box style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--green-9)' }} />
                  <Text size="1" weight="bold" style={{ color: 'white' }}>{user.name}</Text>
                </Flex>
              </Box>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </Grid>
  );
};

const VideoFeed: React.FC<{ stream: MediaStream; isLocal: boolean }> = ({ stream, isLocal }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'cover',
        transform: isLocal ? 'scaleX(-1)' : 'none'
      }}
    />
  );
};

import { Flex } from '@radix-ui/themes';
