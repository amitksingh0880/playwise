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
import { Card } from '@/components/ui/card';
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

  // const handleRaiseHand = () => {
  //   send({ type: 'reaction', emoji: '✋' });
  // };

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
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="relative z-10 w-full max-w-4xl p-4 md:p-8"
        >
          <Card className="p-0 gap-0 bg-slate-950/40 border border-white/10 backdrop-blur-3xl shadow-[0_0_80px_rgba(192,38,211,0.15)] rounded-3xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-cyan-500/10" />
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-fuchsia-500/50 to-transparent" />
            
            <div className="relative z-10 h-full">
              <div className="flex flex-col md:flex-row h-full">
                {/* Left Side: Branding */}
                <div className="md:w-[40%] bg-gradient-to-br from-fuchsia-600/20 to-cyan-600/20 p-8 md:p-12 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-white/10 relative overflow-hidden">
                  <div className="absolute inset-0 bg-slate-950/20 pointer-events-none" />
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                    className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-fuchsia-500 to-cyan-500 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(192,38,211,0.5)] mb-8 transform rotate-3 relative z-10"
                  >
                    <Play className="w-8 h-8 md:w-12 md:h-12 text-white fill-white ml-1" />
                  </motion.div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter bg-gradient-to-r from-white via-fuchsia-100 to-cyan-100 bg-clip-text text-transparent drop-shadow-lg relative z-10">
                    Playwise
                  </h1>
                  <p className="text-slate-400 font-bold tracking-[0.3em] uppercase text-[10px] md:text-xs mt-3 relative z-10 opacity-70">Next-Gen Watch Party</p>
                  
                  <div className="mt-8 hidden md:block relative z-10">
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Network Stable</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Setup & Join */}
                <div className="flex-1 p-6 md:p-10 flex flex-col gap-6 bg-slate-950/20">
                  <div className="flex flex-col md:flex-row gap-8">
                    {/* Profile Section */}
                    <div className="flex flex-col items-center gap-4">
                      <motion.div 
                        whileHover={{ scale: 1.05 }}
                        className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center border-2 border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative group overflow-hidden"
                      >
                        <span className="text-5xl drop-shadow-2xl z-10">{selectedAvatar}</span>
                        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 opacity-40" />
                      </motion.div>
                      <div className="grid grid-cols-4 gap-2">
                        {avatars.map((av) => (
                          <motion.button
                            key={av}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setSelectedAvatar(av)}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all border ${
                              selectedAvatar === av 
                                ? 'bg-fuchsia-500 text-white border-fuchsia-500 shadow-[0_0_15px_rgba(192,38,211,0.5)]' 
                                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                            }`}
                          >
                            {av}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Inputs Section */}
                    <div className="flex-1 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Display Name</label>
                        <Input 
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          placeholder="ENTER ALIAS..."
                          className="bg-black/60 border-white/10 focus-visible:ring-fuchsia-500 h-12 font-black tracking-widest text-base text-white rounded-xl placeholder:text-slate-800 shadow-inner"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Room Password (Optional)</label>
                        <Input 
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="••••••••"
                          className="bg-black/60 border-white/10 focus-visible:ring-fuchsia-500 h-12 text-sm text-white rounded-xl shadow-inner"
                        />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-2.5 px-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[11px] font-black text-center uppercase tracking-wider"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="flex flex-col gap-4 mt-2">
                    <Button 
                      onClick={handleCreate} 
                      className="w-full h-14 text-base font-black tracking-widest bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white border-none rounded-2xl shadow-[0_10px_30px_rgba(192,38,211,0.3)] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] uppercase"
                    >
                      <Wand2 className="mr-3 h-5 w-5" /> Start New Session
                    </Button>
                    
                    <div className="flex items-center gap-3">
                      <div className="h-[1px] flex-1 bg-white/10" />
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Join Existing</span>
                      <div className="h-[1px] flex-1 bg-white/10" />
                    </div>

                    <div className="flex gap-3">
                      <Input 
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value)}
                        placeholder="ROOM ID"
                        className="bg-black/60 border-white/10 focus-visible:ring-cyan-500 uppercase font-mono text-center tracking-[0.3em] h-14 text-base font-bold text-cyan-400 placeholder:text-slate-800 rounded-2xl flex-1 shadow-inner"
                      />
                      <Button 
                        onClick={handleJoin}
                        className="h-14 px-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                      >
                        Join
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="absolute top-0 left-0 right-0 z-50 p-4 md:p-6 pointer-events-none"
        >
          <div className="max-w-[1800px] mx-auto flex items-center justify-between bg-slate-950/40 backdrop-blur-3xl border border-white/10 rounded-2xl md:rounded-[2rem] px-4 md:px-8 py-3 md:py-4 shadow-2xl relative overflow-hidden pointer-events-auto">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />
            
            <div className="flex items-center gap-2 md:gap-6">
              <div className="flex items-center gap-2 md:gap-3 group cursor-pointer" onClick={resetRoom}>
                <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-fuchsia-600 to-cyan-600 flex items-center justify-center shadow-[0_0_20px_rgba(192,38,211,0.5)] group-hover:scale-110 transition-transform">
                  <Play className="h-4 w-4 md:h-6 md:w-6 text-white fill-current" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-sm md:text-2xl font-black text-white tracking-tighter">Playwise</h1>
                  <div className="hidden md:flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-500 tracking-[0.2em] uppercase">{useRoomStore.getState().users.length} LIVE</span>
                  </div>
                </div>
              </div>

              <div className="w-[1px] h-8 bg-white/10 hidden md:block" />
              
                <div className="flex items-center gap-1.5 md:gap-2 bg-black/60 border border-white/10 rounded-full px-3 md:px-5 py-1.5 md:py-2 shadow-inner group">
                  <span className="text-[8px] md:text-[10px] font-black tracking-[0.2em] text-fuchsia-400 uppercase md:animate-pulse">Room</span>
                  <span className="text-xs md:text-sm font-mono font-bold text-white group-hover:text-cyan-400 transition-colors">
                    {roomId}
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 rounded-full hover:bg-white/20 text-slate-400 hover:text-white transition-colors" onClick={handleCopyInvite}>
                        <Copy className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Copy Invite Link</p></TooltipContent>
                  </Tooltip>
                </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-4">
              {useRoomStore.getState().hostId === userId && (
                <Tooltip>
                  <TooltipTrigger>
                    <Button 
                      variant="ghost"
                      size="icon"
                      className={`h-9 w-9 md:h-11 md:w-11 rounded-full border transition-all duration-300 ${useRoomStore.getState().isLocked ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 'bg-white/10 text-white border-white/20 hover:bg-white/20 shadow-lg'}`}
                      onClick={() => send({ type: 'toggle-lock' })}
                    >
                      {useRoomStore.getState().isLocked ? <Lock className="h-4 w-4 md:h-5 md:w-5" /> : <Unlock className="h-4 w-4 md:h-5 md:w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{useRoomStore.getState().isLocked ? "Unlock Room Controls" : "Lock Room Controls"}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <div className="flex items-center gap-1.5 md:gap-3">
                <Tooltip>
                  <TooltipTrigger>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`h-9 w-9 md:h-11 md:w-11 rounded-full border transition-all duration-300 ${isMuted ? 'bg-rose-500 text-white border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 'bg-white/10 text-white border-white/20 hover:bg-white/20 shadow-lg'}`} 
                      onClick={toggleMute}
                    >
                      {isMuted ? <MicOff className="h-4 w-4 md:h-5 md:w-5" /> : <Mic className="h-4 w-4 md:h-5 md:w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isMuted ? "Unmute Mic" : "Mute Mic"}</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`h-9 w-9 md:h-11 md:w-11 rounded-full border transition-all duration-300 ${isCameraOff ? 'bg-rose-500 text-white border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 'bg-white/10 text-white border-white/20 hover:bg-white/20 shadow-lg'}`} 
                      onClick={toggleCamera}
                    >
                      {isCameraOff ? <VideoOff className="h-4 w-4 md:h-5 md:w-5" /> : <Video className="h-4 w-4 md:h-5 md:w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isCameraOff ? "Turn Camera On" : "Turn Camera Off"}</p></TooltipContent>
                </Tooltip>
              </div>

              <div className="w-[1px] h-6 md:h-8 bg-white/20 mx-1 hidden sm:block" />
              
              <Tooltip>
                <TooltipTrigger>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-9 w-9 md:h-11 md:w-11 rounded-full border transition-all duration-300 hidden sm:flex ${theaterMode ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.6)]' : 'bg-white/10 text-white border-white/20 hover:bg-white/20 shadow-lg'}`} 
                    onClick={() => setTheaterMode(!theaterMode)}
                  >
                    <Tv className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Theater Mode</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <Button variant="ghost" size="icon" className="h-9 w-9 md:h-11 md:w-11 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-500 transition-all duration-300 shadow-lg" onClick={resetRoom}>
                    <LogOut className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Leave Session</p></TooltipContent>
              </Tooltip>
            </div>
          </div>
        </motion.header>

        {/* Main Content Layout - Stacked on Mobile */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative pt-20 md:pt-28">
          
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
                <div className="flex flex-col md:flex-row items-center justify-between bg-slate-950/60 backdrop-blur-3xl border border-white/10 rounded-2xl md:rounded-3xl p-2 md:p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,1)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                  
                  {/* Host Info & Reactions */}
                  <div className="flex items-center gap-3 md:gap-6 pl-1 md:pl-3 relative z-10">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-white/20">
                        <Wand2 className="h-4 w-4 md:h-6 md:w-6 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] md:text-base font-black tracking-wide text-white drop-shadow-md">THEATER LIVE</span>
                        <span className="text-[8px] md:text-xs font-bold text-cyan-400 tracking-wider uppercase truncate max-w-[60px] md:max-w-none">Host: {useRoomStore.getState().hostId === userId ? 'You' : 'Participant'}</span>
                      </div>
                    </div>
                    
                    <div className="w-[1px] h-6 md:h-10 bg-white/10 mx-1 md:mx-2" />
                    
                    <div className="flex gap-1 md:gap-2 bg-black/40 p-1 md:p-1.5 rounded-full border border-white/5 shadow-inner overflow-x-auto max-w-[120px] md:max-w-none no-scrollbar">
                      {['❤️', '🔥', '😂', '😮', '👏'].map(emoji => (
                        <Button 
                          key={emoji}
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 md:h-10 md:w-10 rounded-full text-base md:text-xl hover:bg-white/10 hover:scale-125 hover:-translate-y-2 transition-all duration-300 ease-out active:scale-95 shadow-sm"
                          onClick={() => send({ type: 'reaction', emoji })}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 md:gap-3 pr-1 md:pr-2 relative z-10 mt-2 md:mt-0">
                    <Tooltip>
                      <TooltipTrigger>
                        <Button variant="outline" size="icon" className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-black/50 border-white/10 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white text-slate-300 transition-all duration-300" onClick={handleAddBookmark}>
                          <Bookmark className="h-4 w-4 md:h-5 md:w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Bookmark Moment</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger>
                        <Button variant="outline" size="icon" className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-black/50 border-white/10 hover:bg-fuchsia-500 hover:border-fuchsia-500 hover:text-white text-slate-300 transition-all duration-300" onClick={() => setShowSourceDialog(true)}>
                          <Video className="h-4 w-4 md:h-5 md:w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Change Video Source</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className={`h-10 w-10 md:h-12 md:w-12 rounded-full border-white/10 transition-all duration-300 hidden md:flex ${sidebarHidden ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-black/50 text-slate-300 hover:bg-white/10'}`}
                          onClick={() => setSidebarHidden(!sidebarHidden)}
                        >
                          {sidebarHidden ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>{sidebarHidden ? "Show Sidebar" : "Cinema Mode"}</p></TooltipContent>
                    </Tooltip>

                    <div className="w-[1px] h-6 md:h-8 bg-white/10 mx-1" />

                    <Button variant="outline" size="icon" className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-black/50 border-white/10 hover:bg-white/10 text-slate-300 transition-all duration-300">
                      <Settings2 className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Hyper-Stylized Sidebar */}
          <motion.div 
            animate={{ 
              width: sidebarHidden ? 0 : (window.innerWidth < 768 ? '100%' : 420),
              opacity: sidebarHidden ? 0 : 1,
              x: sidebarHidden ? 50 : 0
            }}
            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
            className="h-full md:h-full bg-slate-950/70 backdrop-blur-3xl border-l md:border-l border-white/10 flex flex-col pt-6 md:pt-32 pb-6 overflow-hidden shrink-0 z-40 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] relative"
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
