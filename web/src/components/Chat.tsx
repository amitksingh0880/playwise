import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomStore } from '../features/room/RoomStore';
import { Flex, Text, TextField, IconButton, Box, Card, ScrollArea, Avatar } from '@radix-ui/themes';
import { PaperPlaneIcon } from '@radix-ui/react-icons';

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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
    <Flex direction="column" style={{ height: '100%', gap: '12px' }}>
      <Flex align="center" justify="between">
        <Heading size="3">Live Chat</Heading>
        <Text size="1" color="gray">{messages.length} messages</Text>
      </Flex>
      
      <Card variant="surface" style={{ flexGrow: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ScrollArea scrollbars="vertical" style={{ flexGrow: 1 }}>
          <Flex direction="column" gap="4" p="4" ref={scrollRef}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Flex gap="3" align="start">
                    <Avatar 
                      size="1" 
                      radius="full" 
                      fallback={msg.userName.charAt(0)} 
                      color="orange"
                      variant="soft"
                    />
                    <Box style={{ flex: 1 }}>
                      <Flex align="center" gap="2" mb="1">
                        <Text size="1" weight="bold">{msg.userName}</Text>
                        <Text size="1" color="gray" style={{ opacity: 0.5 }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </Flex>
                      <Card variant="ghost" style={{ padding: '8px 12px', backgroundColor: 'var(--gray-a3)', borderRadius: '0 12px 12px 12px' }}>
                        <Text size="2" style={{ lineHeight: '1.4' }}>{msg.message}</Text>
                      </Card>
                    </Box>
                  </Flex>
                </motion.div>
              ))}
            </AnimatePresence>
          </Flex>
        </ScrollArea>

        <Box p="3" style={{ borderTop: '1px solid var(--gray-a4)', background: 'var(--gray-a2)' }}>
          <form onSubmit={handleSubmit}>
            <Flex gap="2">
              <TextField.Root
                style={{ flex: 1 }}
                size="2"
                variant="soft"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a message..."
              />
              <IconButton type="submit" size="2" variant="solid" radius="full" style={{ cursor: 'pointer' }}>
                <PaperPlaneIcon />
              </IconButton>
            </Flex>
          </form>
        </Box>
      </Card>
    </Flex>
  );
};

const Heading = ({ children, size, mb }: any) => (
  <Text size={size} weight="bold" style={{ marginBottom: mb }}>{children}</Text>
);
