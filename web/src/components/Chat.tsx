import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomStore } from '../features/room/RoomStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send } from 'lucide-react';

interface Message {
  id: string;
  userId: string;
  userName: string;
  userColor?: string;
  message: string;
  timestamp: number;
}

export const Chat: React.FC<{ onSendMessage: (msg: string) => void }> = ({ onSendMessage }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { users } = useRoomStore();

  useEffect(() => {
    const handleChat = (e: any) => {
      const { userId, userName, userColor, message } = e.detail;
      setMessages((prev) => [
        ...prev,
        { 
          id: Math.random().toString(36).substr(2, 9),
          userId, 
          userName: userName || 'Guest', 
          userColor,
          message, 
          timestamp: Date.now() 
        },
      ]);
    };

    window.addEventListener('playwise-chat', handleChat);
    return () => window.removeEventListener('playwise-chat', handleChat);
  }, [users]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Live Chat</h3>
        <span className="text-xs text-zinc-500">{messages.length} messages</span>
      </div>
      
      <div className="flex-1 flex flex-col bg-black/40 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-inner">
        <ScrollArea className="flex-1 p-5" ref={scrollRef}>
          <div className="flex flex-col gap-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
                >
                  <div className="flex gap-4 items-start">
                    <Avatar className="w-10 h-10 border-2 shadow-lg" style={{ borderColor: msg.userColor || '#06b6d4' }}>
                      <AvatarFallback className="bg-slate-950 font-black text-sm" style={{ color: msg.userColor || '#06b6d4' }}>
                        {msg.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-black tracking-wide text-white drop-shadow-md">{msg.userName}</span>
                        <span className="text-[10px] font-bold text-slate-500 tracking-wider">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="bg-white/5 backdrop-blur-md rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200 border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                        {msg.message}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>

        <div className="p-4 bg-black/40 border-t border-white/10">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="bg-white/5 border-white/10 focus-visible:ring-fuchsia-500 text-white placeholder:text-slate-500 rounded-xl"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl shadow-[0_0_15px_rgba(192,38,211,0.4)]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
