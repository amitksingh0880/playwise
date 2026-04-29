import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoPlayer } from './components/VideoPlayer';
import { Chat } from './components/Chat';
import { ParticipantGrid } from './components/ParticipantGrid';
import { useWebSocket } from './hooks/useWebSocket';
import { useWebRTC } from './hooks/useWebRTC';
import { useRoomStore } from './features/room/RoomStore';
import { 
  Box, 
  Flex, 
  Button, 
  IconButton, 
  Card, 
  Text, 
  Heading, 
  Badge,
  TextField,
  Separator,
  Tooltip
} from '@radix-ui/themes';
import { 
  GearIcon, 
  PersonIcon, 
  ExitIcon, 
  EnterFullScreenIcon, 
  ExitFullScreenIcon,
  MagicWandIcon,
  CopyIcon,
  VideoIcon
} from '@radix-ui/react-icons';

function App() {
  const { roomId, userId, userName, resetRoom } = useRoomStore();
  const { send } = useWebSocket();
  const { streams } = useWebRTC(send);
  const [roomInput, setRoomInput] = useState('');
  const [nameInput, setNameInput] = useState(userName || '');
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [sourceUrlInput, setSourceUrlInput] = useState('');
  const [showSourceDialog, setShowSourceDialog] = useState(false);

  const handleJoin = () => {
    if (roomInput && nameInput) {
      useRoomStore.getState().setUser(userId!, nameInput);
      send({ type: 'join', roomId: roomInput, name: nameInput });
    }
  };

  const handleCreate = () => {
    if (nameInput) {
      const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase();
      useRoomStore.getState().setUser(userId!, nameInput);
      send({ type: 'join', roomId: newRoomId, name: nameInput });
    }
  };

  const handleSync = (state: { currentTime: number; isPlaying: boolean }) => {
    send({ type: 'sync', state });
  };

  const handleChat = (message: string) => {
    send({ type: 'chat', message });
  };

  const handleUpdateSource = () => {
    const isYouTube = sourceUrlInput.includes('youtube.com') || sourceUrlInput.includes('youtu.be');
    send({ 
      type: 'sync', 
      state: { 
        sourceType: isYouTube ? 'youtube' : 'url',
        sourceUrl: sourceUrlInput,
        currentTime: 0,
        isPlaying: false
      } 
    });
    setShowSourceDialog(false);
  };

  if (!roomId) {
    return (
      <Flex align="center" justify="center" style={{ 
        height: '100vh', 
        background: 'radial-gradient(circle at top left, var(--orange-3), transparent), radial-gradient(circle at bottom right, var(--amber-3), transparent), var(--black-a12)' 
      }}>
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "circOut" }}
        >
          <Card size="4" style={{ width: 440, boxShadow: 'var(--shadow-6)', border: '1px solid var(--white-a4)' }}>
            <Flex direction="column" gap="5">
              <Box style={{ textAlign: 'center' }}>
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <Heading size="9" weight="bold" style={{ 
                    background: 'linear-gradient(to right, var(--orange-9), var(--amber-9))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.04em'
                  }}>
                    Playwise
                  </Heading>
                </motion.div>
                <Text color="gray" size="2" weight="medium">Your synchronized digital theater.</Text>
              </Box>

              <Flex direction="column" gap="2">
                <Text size="1" weight="bold" color="gray">NICKNAME</Text>
                <TextField.Root
                  size="3"
                  variant="surface"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Movie Buff"
                />
              </Flex>

              <Flex direction="column" gap="3">
                <Button size="3" variant="classic" onClick={handleCreate} style={{ cursor: 'pointer' }}>
                  <MagicWandIcon /> Create New Session
                </Button>
                
                <Flex align="center" gap="3" py="2">
                  <Separator size="4" />
                  <Text size="1" color="gray" style={{ whiteSpace: 'nowrap' }}>OR ENTER ROOM CODE</Text>
                  <Separator size="4" />
                </Flex>

                <Flex gap="2">
                  <Box flexGrow="1">
                    <TextField.Root
                      size="3"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      placeholder="XXXXXX"
                    />
                  </Box>
                  <Button size="3" variant="soft" onClick={handleJoin} style={{ cursor: 'pointer' }}>
                    Join
                  </Button>
                </Flex>
              </Flex>
            </Flex>
          </Card>
        </motion.div>
      </Flex>
    );
  }

  return (
    <Flex direction="column" style={{ height: '100vh', backgroundColor: 'var(--black-a12)' }}>
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <Flex p="4" align="center" justify="between" style={{ 
          background: 'var(--gray-a2)', 
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--gray-a4)',
          zIndex: 50
        }}>
          <Flex align="center" gap="4">
            <Heading size="6" weight="bold" style={{ 
              background: 'linear-gradient(to right, var(--orange-9), var(--amber-9))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Playwise
            </Heading>
            <Badge variant="soft" color="orange" size="2" radius="full">
              <PersonIcon /> {useRoomStore.getState().users.length} Live
            </Badge>
          </Flex>

          <Flex align="center" gap="4">
            <Flex align="center" gap="2">
              <Card size="1" variant="surface" style={{ 
                padding: '4px 16px', 
                backgroundColor: 'var(--orange-a3)',
                border: '1px solid var(--orange-a4)'
              }}>
                <Text size="1" weight="bold" style={{ letterSpacing: '0.15em', color: 'var(--orange-11)' }}>
                  {roomId}
                </Text>
              </Card>
              <Tooltip content="Copy Room Link">
                <IconButton variant="ghost" onClick={() => navigator.clipboard.writeText(roomId)}>
                  <CopyIcon />
                </IconButton>
              </Tooltip>
            </Flex>
            <Separator orientation="vertical" size="1" />
            <IconButton variant="ghost" color="red" radius="full" onClick={resetRoom}>
              <ExitIcon />
            </IconButton>
          </Flex>
        </Flex>
      </motion.div>

      {/* Main Content */}
      <Flex flexGrow="1" overflow="hidden" style={{ position: 'relative' }}>
        {/* Video Area */}
        <Box flexGrow="1" style={{ position: 'relative', overflow: 'hidden' }}>
          <VideoPlayer onSync={handleSync} />
          
          {/* Controls Overlay */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '24px',
                right: '24px',
                zIndex: 20
              }}
            >
              <Flex 
                justify="between" 
                align="center"
                p="4"
                style={{ 
                  background: 'var(--gray-a4)', 
                  backdropFilter: 'blur(20px)', 
                  borderRadius: 'var(--radius-5)',
                  border: '1px solid var(--white-a3)',
                  boxShadow: 'var(--shadow-6)'
                }}
              >
                <Flex align="center" gap="4">
                  <Box style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 'var(--radius-3)', 
                    background: 'linear-gradient(135deg, var(--orange-9), var(--amber-9))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <MagicWandIcon color="white" width={20} height={20} />
                  </Box>
                  <Box>
                    <Text size="2" weight="bold">Session Active</Text>
                    <Text size="1" color="gray">Host: {useRoomStore.getState().hostId === userId ? 'You' : 'Participant'}</Text>
                  </Box>
                </Flex>

                <Flex gap="3">
                  <Tooltip content="Change Video">
                    <IconButton size="3" variant="soft" radius="full" onClick={() => setShowSourceDialog(true)}>
                      <VideoIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={sidebarHidden ? "Show Sidebar" : "Cinema Mode"}>
                    <IconButton 
                      size="3"
                      variant={sidebarHidden ? "soft" : "surface"} 
                      onClick={() => setSidebarHidden(!sidebarHidden)}
                      radius="full"
                    >
                      {sidebarHidden ? <EnterFullScreenIcon /> : <ExitFullScreenIcon />}
                    </IconButton>
                  </Tooltip>
                  <IconButton size="3" variant="soft" radius="full">
                    <GearIcon />
                  </IconButton>
                </Flex>
              </Flex>
            </motion.div>
          </AnimatePresence>
        </Box>

        {/* Sidebar */}
        <Box 
          style={{ 
            width: sidebarHidden ? 0 : 400, 
            opacity: sidebarHidden ? 0 : 1,
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            backgroundColor: 'var(--gray-1)',
            borderLeft: sidebarHidden ? 'none' : '1px solid var(--gray-a4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Box p="4" flexShrink="0">
            <Heading size="3" mb="3">Participants</Heading>
            <ParticipantGrid streams={streams} />
          </Box>
          <Separator size="4" />
          <Box flexGrow="1" p="4" overflow="hidden">
            <Chat onSendMessage={handleChat} />
          </Box>
        </Box>
      </Flex>

      {/* Source Dialog */}
      <AnimatePresence>
        {showSourceDialog && (
          <Flex 
            position="absolute" 
            inset="0" 
            align="center" 
            justify="center" 
            style={{ zIndex: 100, backgroundColor: 'var(--black-a9)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Card size="3" style={{ width: 400 }}>
                <Flex direction="column" gap="4">
                  <Heading size="4">Change Video Source</Heading>
                  <Text size="2" color="gray">Paste a YouTube URL or direct video link.</Text>
                  <TextField.Root 
                    placeholder="https://www.youtube.com/watch?v=..." 
                    value={sourceUrlInput}
                    onChange={(e) => setSourceUrlInput(e.target.value)}
                  />
                  <Flex gap="3" justify="end">
                    <Button variant="soft" color="gray" onClick={() => setShowSourceDialog(false)}>Cancel</Button>
                    <Button variant="solid" onClick={handleUpdateSource}>Update Source</Button>
                  </Flex>
                </Flex>
              </Card>
            </motion.div>
          </Flex>
        )}
      </AnimatePresence>
    </Flex>
  );
}

export default App;
