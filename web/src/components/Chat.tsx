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
      const { userId, message } = e.detail;
      const user = users.find((u) => u.id === userId);
      setMessages((prev) => [
        ...prev,
        { 
          id: Math.random().toString(36).substr(2, 9),
          userId, 
          userName: user?.name || 'Guest', 
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
      
      <div className="flex-1 flex flex-col bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 20 }}
                >
                  <div className="flex gap-3 items-start">
                    <Avatar className="w-8 h-8 border border-zinc-700">
                      <AvatarFallback className="bg-zinc-800 text-orange-400 text-xs font-bold">
                        {msg.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-zinc-300">{msg.userName}</span>
                        <span className="text-[10px] text-zinc-600">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="bg-zinc-800/80 rounded-2xl rounded-tl-none px-3 py-2 text-sm text-zinc-200 border border-zinc-700/50">
                        {msg.message}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>

        <div className="p-3 bg-zinc-950/50 border-t border-zinc-800/50">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 bg-zinc-900 border-zinc-800 focus-visible:ring-orange-500 rounded-full px-4"
            />
            <Button type="submit" size="icon" className="rounded-full bg-orange-600 hover:bg-orange-500 text-white shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
