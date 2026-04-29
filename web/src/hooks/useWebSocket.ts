import { useEffect, useRef, useCallback } from 'react';
import { useRoomStore } from '../features/room/RoomStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export function useWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const { roomId, userName, userId, setRoom, updateVideoState } = useRoomStore();

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'room-state':
        setRoom(data.payload);
        break;
      case 'user-joined':
      case 'user-left':
        setRoom(data.payload.room);
        break;
      case 'sync':
        updateVideoState(data.payload);
        break;
      case 'chat':
        window.dispatchEvent(new CustomEvent('playwise-chat', { detail: data.payload }));
        break;
      case 'webrtc-webrtc-offer':
      case 'webrtc-webrtc-answer':
      case 'webrtc-webrtc-ice':
        window.dispatchEvent(new CustomEvent(data.type, { detail: data.payload }));
        break;
    }
  }, [setRoom, updateVideoState]);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to server');
      // If we already have a roomId, join it immediately on reconnect
      const currentRoomId = useRoomStore.getState().roomId;
      if (currentRoomId) {
        ws.send(JSON.stringify({ 
          type: 'join', 
          roomId: currentRoomId, 
          name: useRoomStore.getState().userName || 'Guest' 
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      setTimeout(connect, 3000); // Auto-reconnect
    };
  }, [handleMessage]);

  const send = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.warn('Socket not open, message not sent', data);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent auto-reconnect on unmount
        socketRef.current.close();
      }
    };
  }, [connect]);

  // Handle room joining when roomId changes from the UI
  useEffect(() => {
    if (roomId && socketRef.current?.readyState === WebSocket.OPEN) {
      send({ type: 'join', roomId, name: userName || 'Guest' });
    }
  }, [roomId, userName, send]);

  return { send };
}
