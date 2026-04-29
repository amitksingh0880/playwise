import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomStore } from '../features/room/RoomStore';

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useWebRTC(sendSignal: (data: any) => void) {
  const { userId, users, roomId } = useRoomStore();
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const peers = useRef<Record<string, RTCPeerConnection>>({});
  const localStream = useRef<MediaStream | null>(null);

  const initLocalStream = async () => {
    if (localStream.current) return localStream.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      setStreams((prev) => ({ ...prev, [userId!]: stream }));
      return stream;
    } catch (err) {
      console.error('Error accessing media devices', err);
      return null;
    }
  };

  const createPeerConnection = useCallback((targetId: string) => {
    if (peers.current[targetId]) return peers.current[targetId];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peers.current[targetId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: 'webrtc-ice', targetId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setStreams((prev) => ({ ...prev, [targetId]: event.streams[0] }));
    };

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });
    }

    return pc;
  }, [sendSignal, userId]);

  useEffect(() => {
    const handleOffer = async (e: any) => {
      const { from, offer } = e.detail;
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal({ type: 'webrtc-answer', targetId: from, answer });
    };

    const handleAnswer = async (e: any) => {
      const { from, answer } = e.detail;
      const pc = peers.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleIce = async (e: any) => {
      const { from, candidate } = e.detail;
      const pc = peers.current[from];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    window.addEventListener('webrtc-webrtc-offer', handleOffer as any);
    window.addEventListener('webrtc-webrtc-answer', handleAnswer as any);
    window.addEventListener('webrtc-webrtc-ice', handleIce as any);

    return () => {
      window.removeEventListener('webrtc-webrtc-offer', handleOffer as any);
      window.removeEventListener('webrtc-webrtc-answer', handleAnswer as any);
      window.removeEventListener('webrtc-webrtc-ice', handleIce as any);
    };
  }, [createPeerConnection, sendSignal]);

  useEffect(() => {
    if (!roomId || !userId) return;

    const initPeers = async () => {
      await initLocalStream();
      
      // Clean up peers for users who are no longer in the room
      const currentUsers = new Set(users.map(u => u.id));
      Object.keys(peers.current).forEach(id => {
        if (!currentUsers.has(id)) {
          peers.current[id].close();
          delete peers.current[id];
          setStreams(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      });

      // Initiate offers to new users
      users.forEach(async (user) => {
        if (user.id !== userId && !peers.current[user.id]) {
          const pc = createPeerConnection(user.id);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: 'webrtc-offer', targetId: user.id, offer });
        }
      });
    };

    initPeers();

    return () => {
      // Don't close local stream on every user change, but close peers if hook unmounts?
      // Actually, we keep localStream.current. 
    };
  }, [users, userId, roomId, createPeerConnection, sendSignal]);

  return { streams, localStream: localStream.current };
}
