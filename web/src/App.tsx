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
  Video,
  Play
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
      <div className="flex items-center justify-center min-h-screen bg-[#05050f] overflow-hidden relative font-sans">
        {/* Massive Dynamic Neon Background */}
        <div className="absolute top-[-30%] left-[-20%] w-[70vw] h-[70vw] bg-fuchsia-600/30 rounded-full blur-[150px] mix-blend-screen animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[70vw] h-[70vw] bg-cyan-600/30 rounded-full blur-[150px] mix-blend-screen animate-pulse duration-[10000ms]" />
        <div className="absolute top-[20%] left-[60%] w-[40vw] h-[40vw] bg-violet-600/20 rounded-full blur-[120px] mix-blend-screen" />

        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="relative z-10 w-full max-w-lg p-6"
        >
          <Card className="bg-slate-950/40 border border-white/10 backdrop-blur-3xl shadow-[0_0_80px_rgba(192,38,211,0.15)] rounded-3xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-cyan-500/10" />
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-fuchsia-500/50 to-transparent" />
            
            <CardContent className="pt-12 pb-10 px-10 flex flex-col gap-10 relative z-10">
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                  className="mx-auto w-20 h-20 bg-gradient-to-br from-fuchsia-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(192,38,211,0.5)] mb-6 transform rotate-3"
                >
                  <Play className="w-10 h-10 text-white fill-white ml-1" />
                </motion.div>
                <h1 className="text-6xl font-black tracking-tighter bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent drop-shadow-lg">
                  Playwise
                </h1>
                <p className="text-slate-400 font-medium tracking-widest uppercase text-sm">Next-Gen Watch Party</p>
              </div>

              <div className="space-y-6 mt-4">
                <div className="space-y-2 group">
                  <Input 
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Enter your nickname"
                    className="bg-black/50 border-white/10 focus-visible:ring-fuchsia-500 focus-visible:border-fuchsia-500 h-14 text-lg text-center font-bold text-white placeholder:text-slate-600 rounded-xl transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-6">
                  <Button 
                    onClick={handleCreate} 
                    className="w-full h-14 text-lg font-black tracking-wide bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white border-none rounded-xl shadow-[0_0_40px_rgba(192,38,211,0.4)] hover:shadow-[0_0_60px_rgba(192,38,211,0.6)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Wand2 className="mr-3 h-6 w-6" /> START NEW SESSION
                  </Button>
                  
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs font-black uppercase tracking-widest">
                      <span className="bg-[#0b0c16] px-4 text-slate-500 rounded-full border border-white/5 py-1">Or join existing</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Input 
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      placeholder="ROOM ID"
                      className="bg-black/50 border-white/10 focus-visible:ring-cyan-500 focus-visible:border-cyan-500 uppercase font-mono text-center tracking-widest h-14 text-lg font-bold text-cyan-400 placeholder:text-slate-700 rounded-xl"
                    />
                    <Button onClick={handleJoin} className="h-14 px-8 font-black bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                      JOIN
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
      <div className="flex flex-col h-screen bg-[#020205] text-slate-100 overflow-hidden font-sans">
        {/* Floating Ultra-Premium Header */}
        <motion.header
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
          className="absolute top-6 left-6 right-6 z-50 pointer-events-none"
        >
          <div className="max-w-full mx-auto flex items-center justify-between bg-slate-950/40 backdrop-blur-2xl border border-white/10 rounded-2xl px-6 py-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] pointer-events-auto">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-fuchsia-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(192,38,211,0.5)]">
                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-md">
                  Playwise
                </h1>
              </div>
              <Badge className="bg-white/5 hover:bg-white/10 text-cyan-400 border border-cyan-500/30 gap-2 px-4 py-1.5 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-bold tracking-wider">{useRoomStore.getState().users.length} LIVE</span>
              </Badge>
            </div>

            <div className="flex items-center gap-5">
              {useRoomStore.getState().hostId === userId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline"
                      size="icon"
                      className={`h-11 w-11 rounded-full border-white/10 transition-all duration-300 ${useRoomStore.getState().isLocked ? 'bg-fuchsia-500/20 border-fuchsia-500/50 shadow-[0_0_20px_rgba(192,38,211,0.4)]' : 'bg-black/40 hover:bg-white/10'}`}
                      onClick={() => send({ type: 'toggle-lock' })}
                    >
                      <span className="text-lg">{useRoomStore.getState().isLocked ? '🔒' : '🔓'}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 border-white/10 font-bold">
                    <p>{useRoomStore.getState().isLocked ? "Unlock Room Controls" : "Lock Room Controls"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-full pl-5 pr-1.5 py-1.5 shadow-inner">
                <span className="text-sm font-mono font-bold tracking-[0.2em] text-fuchsia-400">
                  {roomId}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-fuchsia-500/20 text-slate-400 hover:text-fuchsia-400 transition-colors" onClick={() => navigator.clipboard.writeText(roomId || '')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 border-white/10"><p className="font-bold">Copy Room Code</p></TooltipContent>
                </Tooltip>
              </div>

              <div className="w-[1px] h-8 bg-white/10 mx-2" />
              
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-black/40 border border-white/10 text-slate-400 hover:text-white hover:bg-rose-500 hover:border-rose-500 hover:shadow-[0_0_20px_rgba(244,63,94,0.5)] transition-all duration-300" onClick={resetRoom}>
                <LogOut className="h-5 w-5 ml-1" />
              </Button>
            </div>
          </div>
        </motion.header>

        {/* Main Content Layout */}
        <div className="flex flex-1 overflow-hidden relative">
          
          {/* Video Area */}
          <div className="flex-1 relative bg-[#020205] flex flex-col justify-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(192,38,211,0.05),transparent_70%)] pointer-events-none" />
            
            <VideoPlayer onSync={handleSync} />
            <ReactionOverlay />
            
            {/* Ultra-Stylized Hover Controls */}
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl"
              >
                <div className="flex items-center justify-between bg-slate-950/60 backdrop-blur-3xl border border-white/10 rounded-3xl p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,1)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                  
                  {/* Host Info & Reactions */}
                  <div className="flex items-center gap-6 pl-3 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-white/20">
                        <Wand2 className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base font-black tracking-wide text-white drop-shadow-md">THEATER LIVE</span>
                        <span className="text-xs font-bold text-cyan-400 tracking-wider uppercase">Host: {useRoomStore.getState().hostId === userId ? 'You' : 'Participant'}</span>
                      </div>
                    </div>
                    
                    <div className="w-[1px] h-10 bg-white/10 mx-2" />
                    
                    <div className="flex gap-2 bg-black/40 p-1.5 rounded-full border border-white/5 shadow-inner">
                      {['❤️', '🔥', '😂', '😮', '👏'].map(emoji => (
                        <Button 
                          key={emoji}
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-full text-xl hover:bg-white/10 hover:scale-125 hover:-translate-y-2 transition-all duration-300 ease-out active:scale-95 shadow-sm"
                          onClick={() => send({ type: 'reaction', emoji })}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pr-2 relative z-10">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-black/50 border-white/10 hover:bg-fuchsia-500 hover:border-fuchsia-500 hover:text-white text-slate-300 transition-all duration-300 hover:shadow-[0_0_20px_rgba(192,38,211,0.5)]" onClick={() => setShowSourceDialog(true)}>
                          <Video className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 border-white/10 font-bold"><p>Change Video Source</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className={`h-12 w-12 rounded-full border-white/10 transition-all duration-300 ${sidebarHidden ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-black/50 text-slate-300 hover:bg-white/10'}`}
                          onClick={() => setSidebarHidden(!sidebarHidden)}
                        >
                          {sidebarHidden ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 border-white/10 font-bold"><p>{sidebarHidden ? "Show Sidebar" : "Cinema Mode"}</p></TooltipContent>
                    </Tooltip>

                    <div className="w-[1px] h-8 bg-white/10 mx-1" />

                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-black/50 border-white/10 hover:bg-white/10 text-slate-300 transition-all duration-300">
                      <Settings2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Hyper-Stylized Sidebar */}
          <motion.div 
            animate={{ 
              width: sidebarHidden ? 0 : 420,
              opacity: sidebarHidden ? 0 : 1,
              x: sidebarHidden ? 50 : 0
            }}
            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
            className="h-full bg-slate-950/70 backdrop-blur-3xl border-l border-white/10 flex flex-col pt-32 pb-6 overflow-hidden shrink-0 z-40 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] relative"
          >
            <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-cyan-500/30 to-transparent" />
            
            <div className="px-6 pb-4 shrink-0">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                <h2 className="text-lg font-black text-white uppercase tracking-widest drop-shadow-md">The Audience</h2>
              </div>
              <ParticipantGrid streams={streams} />
            </div>
            
            <div className="px-6 py-4">
              <Separator className="bg-white/10" />
            </div>
            
            <div className="flex-1 overflow-hidden px-4 flex flex-col">
              <Chat onSendMessage={handleChat} />
            </div>
          </motion.div>
        </div>

        {/* Cinematic Source Dialog */}
        <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
          <DialogContent className="bg-slate-950/90 backdrop-blur-2xl border border-white/10 text-white sm:max-w-lg rounded-3xl shadow-[0_0_100px_rgba(0,0,0,1)]">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 rounded-3xl pointer-events-none" />
            <DialogHeader className="relative z-10 pt-4">
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                <Video className="w-6 h-6 text-fuchsia-400" /> Source Selection
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-base font-medium pt-2">
                Drop a YouTube URL or direct link to start streaming.
              </DialogDescription>
            </DialogHeader>
            <div className="py-8 relative z-10">
              <Input 
                placeholder="https://youtube.com/watch?v=..." 
                value={sourceUrlInput}
                onChange={(e) => setSourceUrlInput(e.target.value)}
                className="bg-black/60 border-white/10 focus-visible:ring-fuchsia-500 focus-visible:border-fuchsia-500 h-14 text-lg font-medium placeholder:text-slate-600 rounded-xl"
              />
            </div>
            <DialogFooter className="relative z-10 pb-2">
              <Button variant="ghost" onClick={() => setShowSourceDialog(false)} className="h-12 px-6 rounded-xl font-bold hover:bg-white/10 text-slate-300">Cancel</Button>
              <Button onClick={handleUpdateSource} className="h-12 px-8 rounded-xl font-black tracking-wide bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white border-none shadow-[0_0_20px_rgba(192,38,211,0.4)]">Play Source</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}

export default App;
