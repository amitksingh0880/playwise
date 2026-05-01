import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chat } from './components/Chat';
import { ParticipantGrid } from './components/ParticipantGrid';
import { ReactionOverlay } from './components/ReactionOverlay';
import { useWebSocket } from './hooks/useWebSocket';
import { useWebRTC } from './hooks/useWebRTC';
import { useRoomStore } from './features/room/RoomStore';
import type { VideoState } from './features/room/RoomStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  LogOut, 
  Maximize2, 
  Minimize2,
  Wand2,
  Copy,
  MicOff,
  VideoOff,
  Settings2,
  Video,
  Bookmark,
  Tv,
  Play,
  Mic,
  Lock,
  Unlock
} from 'lucide-react';
import { Polls } from './components/Polls';
import { VideoPlayer } from './components/VideoPlayer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function App() {
  const { roomId, userId, userName, userColor, resetRoom } = useRoomStore();
  const { send } = useWebSocket();
  const { streams, isMuted, isCameraOff, toggleMute, toggleCamera } = useWebRTC(send);
  const [roomInput, setRoomInput] = useState('');
  const [nameInput, setNameInput] = useState(userName || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [sourceUrlInput, setSourceUrlInput] = useState('');
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theaterMode, setTheaterMode] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedAvatar, setSelectedAvatar] = useState(useRoomStore.getState().userAvatar || '🤖');
  const avatars = ['🤖', '🐱', '🥷', '👽', '👨‍🚀', '🦄', '🐲', '👻'];
  const [bookmarks, setBookmarks] = useState<{ time: number; label: string }[]>(() => {
    const saved = localStorage.getItem(`playwise_bookmarks_${roomId}`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (roomId) {
      localStorage.setItem(`playwise_bookmarks_${roomId}`, JSON.stringify(bookmarks));
    }
  }, [bookmarks, roomId]);

  // Auto-fill room from URL
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomInput(roomParam.toUpperCase());
    }
  });

  useState(() => {
    const handler = (e: any) => {
      setError(e.detail.message);
      setTimeout(() => setError(null), 5000);
    };
    window.addEventListener('playwise-error', handler);
    return () => window.removeEventListener('playwise-error', handler);
  });

  const handleJoin = () => {
    if (roomInput && nameInput) {
      useRoomStore.getState().setUser(userId!, nameInput, userColor || undefined, selectedAvatar);
      send({ type: 'join', roomId: roomInput, name: nameInput, password: passwordInput, color: userColor || undefined, avatarUrl: selectedAvatar });
    }
  };

  const handleCreate = () => {
    if (nameInput) {
      const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase();
      useRoomStore.getState().setUser(userId!, nameInput, userColor || undefined, selectedAvatar);
      send({ type: 'join', roomId: newRoomId, name: nameInput, password: passwordInput, color: userColor || undefined, avatarUrl: selectedAvatar });
    }
  };

  const handleSync = (state: Partial<VideoState>) => {
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

  const handleCopyInvite = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
  };

  const handleRaiseHand = () => {
    send({ type: 'reaction', emoji: '✋' });
  };

  const handleAddBookmark = () => {
    const { videoState } = useRoomStore.getState();
    const time = videoState.currentTime;
    const label = `Mark at ${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
    setBookmarks([...bookmarks, { time, label }]);
  };

  const handleJumpToBookmark = (time: number) => {
    handleSync({ currentTime: time });
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
                <div className="flex flex-col items-center gap-6 mb-10">
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="w-32 h-32 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 flex items-center justify-center border-2 border-white/10 shadow-[0_0_50px_rgba(192,38,211,0.2)] relative group overflow-hidden"
                  >
                    <span className="text-6xl drop-shadow-2xl z-10">{selectedAvatar}</span>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>

                  <div className="flex flex-wrap justify-center gap-3 max-w-xs">
                    {avatars.map((av) => (
                      <motion.button
                        key={av}
                        whileHover={{ scale: 1.1, y: -2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSelectedAvatar(av)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all border ${
                          selectedAvatar === av 
                            ? 'bg-fuchsia-500/20 border-fuchsia-500 shadow-[0_0_20px_rgba(192,38,211,0.4)]' 
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {av}
                      </motion.button>
                    ))}
                  </div>

                  <div className="w-full space-y-4">
                    <Input 
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="YOUR ALIAS"
                      className="bg-black/40 border-white/10 focus-visible:ring-fuchsia-500 focus-visible:border-fuchsia-500 h-14 text-center font-black tracking-widest text-lg text-white rounded-xl placeholder:text-slate-700"
                    />
                  </div>
                  <Input 
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Room Password (Optional)"
                    className="bg-black/50 border-white/10 focus-visible:ring-fuchsia-500 focus-visible:border-fuchsia-500 h-14 text-lg text-center font-bold text-white placeholder:text-slate-600 rounded-xl transition-all shadow-inner"
                  />
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-400 text-sm font-bold text-center"
                  >
                    {error}
                  </motion.div>
                )}

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
      <div className={`flex flex-col h-screen ${theaterMode ? 'bg-black' : 'bg-[#020205]'} text-slate-100 overflow-hidden font-sans transition-colors duration-1000`}>
        {/* Floating Ultra-Premium Header */}
        <motion.header
          initial={{ y: -100 }}
          animate={{ y: theaterMode ? -120 : 0 }}
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
                  <TooltipTrigger>
                    <Button 
                      variant="ghost"
                      size="icon"
                      className={`h-11 w-11 rounded-full border transition-all duration-300 ${useRoomStore.getState().isLocked ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 'bg-white/10 text-white border-white/20 hover:bg-white/20 shadow-lg'}`}
                      onClick={() => send({ type: 'toggle-lock' })}
                    >
                      {useRoomStore.getState().isLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 border-white/10 font-bold">
                    <p>{useRoomStore.getState().isLocked ? "Unlock Room Controls" : "Lock Room Controls"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
                <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-full px-5 py-2 shadow-inner group">
                  <span className="text-[10px] font-black tracking-[0.2em] text-fuchsia-400 uppercase animate-pulse">Room</span>
                  <span className="text-sm font-mono font-bold text-white group-hover:text-cyan-400 transition-colors">
                    {roomId}
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/20 text-slate-400 hover:text-white transition-colors ml-2" onClick={handleCopyInvite}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Copy Invite Link</p></TooltipContent>
                  </Tooltip>
                </div>

              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`h-11 w-11 rounded-full border transition-all duration-300 ${isMuted ? 'bg-rose-500 text-white border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 'bg-white/10 text-white border-white/20 hover:bg-white/20 shadow-lg'}`} 
                      onClick={toggleMute}
                    >
                      {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isMuted ? "Unmute Mic" : "Mute Mic"}</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`h-11 w-11 rounded-full border transition-all duration-300 ${isCameraOff ? 'bg-rose-500 text-white border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 'bg-white/10 text-white border-white/20 hover:bg-white/20 shadow-lg'}`} 
                      onClick={toggleCamera}
                    >
                      {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isCameraOff ? "Turn Camera On" : "Turn Camera Off"}</p></TooltipContent>
                </Tooltip>
              </div>

              <div className="w-[1px] h-8 bg-white/20 mx-2" />
              
              <Tooltip>
                <TooltipTrigger>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-11 w-11 rounded-full border transition-all duration-300 ${theaterMode ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.6)]' : 'bg-white/10 text-white border-white/20 hover:bg-white/20 shadow-lg'}`} 
                    onClick={() => setTheaterMode(!theaterMode)}
                  >
                    <Tv className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Theater Mode</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-500 transition-all duration-300 shadow-lg" onClick={resetRoom}>
                    <LogOut className="h-5 w-5 ml-1" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Leave Session</p></TooltipContent>
              </Tooltip>
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
                      <div className="w-[1px] h-6 bg-white/10 mx-1" />
                      <Tooltip>
                        <TooltipTrigger>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 rounded-full text-xl hover:bg-white/10 hover:scale-125 hover:-translate-y-2 transition-all duration-300 ease-out active:scale-95 shadow-sm"
                            onClick={handleRaiseHand}
                          >
                            ✋
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 border-white/10 font-bold"><p>Raise Hand</p></TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pr-2 relative z-10">
                    <Tooltip>
                      <TooltipTrigger>
                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-black/50 border-white/10 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white text-slate-300 transition-all duration-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]" onClick={handleAddBookmark}>
                          <Bookmark className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 border-white/10 font-bold"><p>Bookmark Moment</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger>
                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-full bg-black/50 border-white/10 hover:bg-fuchsia-500 hover:border-fuchsia-500 hover:text-white text-slate-300 transition-all duration-300 hover:shadow-[0_0_20px_rgba(192,38,211,0.5)]" onClick={() => setShowSourceDialog(true)}>
                          <Video className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-900 border-white/10 font-bold"><p>Change Video Source</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger>
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
                <ParticipantGrid streams={streams} send={send} />
            </div>
            
            <div className="px-6 py-4">
              <Separator className="bg-white/10" />
            </div>
            
            <div className="flex-1 overflow-hidden px-4 flex flex-col pt-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="bg-white/5 border border-white/10 rounded-xl p-1 mb-6">
                  <TabsTrigger value="chat" className="flex-1 rounded-lg data-[state=active]:bg-cyan-500 data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">Chat</TabsTrigger>
                  <TabsTrigger value="polls" className="flex-1 rounded-lg data-[state=active]:bg-fuchsia-500 data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">Polls</TabsTrigger>
                </TabsList>
                <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
                  <Chat onSendMessage={handleChat} />
                </TabsContent>
                <TabsContent value="polls" className="flex-1 overflow-hidden mt-0">
                  <Polls send={send} />
                </TabsContent>
              </Tabs>
            </div>
            
            {bookmarks.length > 0 && (
              <div className="px-6 py-4 bg-black/40 border-t border-white/10">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Bookmarks</h3>
                 <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                    {bookmarks.map((b, i) => (
                      <button
                        key={i}
                        onClick={() => handleJumpToBookmark(b.time)}
                        className="whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 rounded-lg text-[10px] font-bold text-slate-300 hover:text-emerald-400 transition-all"
                      >
                        {b.label}
                      </button>
                    ))}
                 </div>
              </div>
            )}
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
