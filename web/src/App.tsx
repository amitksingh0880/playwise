import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoPlayer } from './components/VideoPlayer';
import { Chat } from './components/Chat';
import { ParticipantGrid } from './components/ParticipantGrid';
import { ReactionOverlay } from './components/ReactionOverlay';
import { useWebSocket } from './hooks/useWebSocket';
import { useWebRTC } from './hooks/useWebRTC';
import { useRoomStore } from './features/room/RoomStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Settings2, 
  Users, 
  LogOut, 
  Maximize2, 
  Minimize2,
  Wand2,
  Copy,
  Video
} from 'lucide-react';

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
      <div className="flex items-center justify-center min-h-screen bg-black overflow-hidden relative">
        {/* Animated Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-orange-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-rose-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse delay-1000" />
        <div className="absolute top-[40%] left-[40%] w-[30vw] h-[30vw] bg-amber-500/10 rounded-full blur-[100px] mix-blend-screen" />

        <motion.div 
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-md p-6"
        >
          <Card className="bg-zinc-950/50 border-zinc-800/50 backdrop-blur-xl shadow-2xl">
            <CardContent className="pt-8 pb-8 flex flex-col gap-8">
              <div className="text-center space-y-2">
                <motion.h1 
                  animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                  className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 bg-[length:200%_auto] bg-clip-text text-transparent"
                >
                  Playwise
                </motion.h1>
                <p className="text-zinc-400 font-medium tracking-wide">Your synchronized digital theater.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Nickname</label>
                  <Input 
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. Movie Buff"
                    className="bg-zinc-900/50 border-zinc-800 focus-visible:ring-orange-500 h-12 text-lg"
                  />
                </div>

                <div className="space-y-4">
                  <Button 
                    onClick={handleCreate} 
                    className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 transition-all duration-300 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)]"
                  >
                    <Wand2 className="mr-2 h-5 w-5" /> Create New Session
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full border-zinc-800" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-zinc-950/50 px-2 text-zinc-500 font-bold tracking-wider">Or enter room code</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input 
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      placeholder="XXXXXX"
                      className="bg-zinc-900/50 border-zinc-800 focus-visible:ring-orange-500 uppercase font-mono text-center tracking-widest h-12 text-lg"
                    />
                    <Button onClick={handleJoin} variant="secondary" className="h-12 px-8 font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-100">
                      Join
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-black text-zinc-100 overflow-hidden font-sans">
        {/* Header - Floating Glassmorphic */}
        <motion.header
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          className="absolute top-0 w-full z-50 p-4 pointer-events-none"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between bg-zinc-950/60 backdrop-blur-md border border-zinc-800/50 rounded-2xl px-6 py-3 shadow-2xl pointer-events-auto">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                Playwise
              </h1>
              <Badge variant="secondary" className="bg-zinc-800/80 text-orange-400 hover:bg-zinc-800 border-none gap-1.5 px-3">
                <Users className="w-3.5 h-3.5" /> {useRoomStore.getState().users.length} Live
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              {useRoomStore.getState().hostId === userId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={useRoomStore.getState().isLocked ? "destructive" : "ghost"} 
                      size="icon"
                      className={`rounded-full transition-all ${useRoomStore.getState().isLocked ? 'shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'hover:bg-zinc-800'}`}
                      onClick={() => send({ type: 'toggle-lock' })}
                    >
                      {useRoomStore.getState().isLocked ? '🔒' : '🔓'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{useRoomStore.getState().isLocked ? "Unlock Controls" : "Lock Controls (Host Only)"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 rounded-full pl-4 pr-1 py-1">
                <span className="text-sm font-mono font-bold tracking-widest text-orange-400">
                  {roomId}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100" onClick={() => navigator.clipboard.writeText(roomId || '')}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Copy Room Code</p></TooltipContent>
                </Tooltip>
              </div>

              <div className="w-[1px] h-6 bg-zinc-800 mx-1" />
              
              <Button variant="ghost" size="icon" className="rounded-full text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10" onClick={resetRoom}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.header>

        {/* Main Content Layout */}
        <div className="flex flex-1 overflow-hidden relative">
          
          {/* Video Area */}
          <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
            <VideoPlayer onSync={handleSync} />
            <ReactionOverlay />
            
            {/* Hover Controls Overlay */}
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-3xl"
              >
                <div className="flex items-center justify-between bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]">
                  
                  {/* Host Info & Reactions */}
                  <div className="flex items-center gap-4 pl-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                      <Wand2 className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-100">Session Active</span>
                      <span className="text-xs text-zinc-400">Host: {useRoomStore.getState().hostId === userId ? 'You' : 'Participant'}</span>
                    </div>
                    
                    <div className="w-[1px] h-8 bg-zinc-800 mx-2" />
                    
                    <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-full border border-zinc-800/50">
                      {['❤️', '🔥', '😂', '😮', '👏'].map(emoji => (
                        <Button 
                          key={emoji}
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full text-lg hover:bg-zinc-800 hover:scale-110 transition-all active:scale-95"
                          onClick={() => send({ type: 'reaction', emoji })}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pr-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="icon" className="rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300" onClick={() => setShowSourceDialog(true)}>
                          <Video className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Change Video Source</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className={`rounded-full ${sidebarHidden ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
                          onClick={() => setSidebarHidden(!sidebarHidden)}
                        >
                          {sidebarHidden ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>{sidebarHidden ? "Show Sidebar" : "Cinema Mode"}</p></TooltipContent>
                    </Tooltip>

                    <Button variant="secondary" size="icon" className="rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 ml-2">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Collapsible Sidebar */}
          <motion.div 
            animate={{ 
              width: sidebarHidden ? 0 : 380,
              opacity: sidebarHidden ? 0 : 1,
              x: sidebarHidden ? 100 : 0
            }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="h-full bg-zinc-950/80 backdrop-blur-2xl border-l border-zinc-800/80 flex flex-col pt-24 pb-4 overflow-hidden shrink-0 z-40 shadow-2xl relative"
          >
            <div className="px-6 pb-2 shrink-0">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Participants</h2>
              <ParticipantGrid streams={streams} />
            </div>
            
            <div className="px-6 py-2">
              <Separator className="bg-zinc-800" />
            </div>
            
            <div className="flex-1 overflow-hidden px-2 flex flex-col">
              <Chat onSendMessage={handleChat} />
            </div>
          </motion.div>
        </div>

        {/* Change Source Dialog */}
        <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change Video Source</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Paste a YouTube URL or a direct link to a video file.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input 
                placeholder="https://youtube.com/watch?v=..." 
                value={sourceUrlInput}
                onChange={(e) => setSourceUrlInput(e.target.value)}
                className="bg-zinc-900 border-zinc-800 focus-visible:ring-orange-500"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowSourceDialog(false)} className="hover:bg-zinc-800 hover:text-zinc-100">Cancel</Button>
              <Button onClick={handleUpdateSource} className="bg-orange-600 hover:bg-orange-500 text-white">Update Source</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}

export default App;
