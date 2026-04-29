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

  // 1. Initialize camera
  const initCamera = useCallback(async () => {
    if (localStream.current) return localStream.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      setStreams(prev => ({ ...prev, [userId!]: stream }));
      return stream;
    } catch (err) {
      console.error('WebRTC: Camera access denied', err);
      return null;
    }
  }, [userId]);

  // 2. Create connection to a peer
  const connectToPeer = useCallback(async (targetId: string, isInitiator: boolean) => {
    if (peers.current[targetId]) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peers.current[targetId] = pc;

    // Attach local tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current!));
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal({ type: 'webrtc-ice', targetId, candidate: e.candidate });
    };

    pc.ontrack = (e) => {
      setStreams(prev => ({ ...prev, [targetId]: e.streams[0] }));
    };

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ type: 'webrtc-offer', targetId, offer });
    }
  }, [sendSignal]);

  // 3. Handle incoming signals
  useEffect(() => {
    const handleOffer = async (e: any) => {
      const { from, offer } = e.detail;
      if (!peers.current[from]) await connectToPeer(from, false);
      const pc = peers.current[from];
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal({ type: 'webrtc-answer', targetId: from, answer });
    };

    const handleAnswer = async (e: any) => {
      const { from, answer } = e.detail;
      const pc = peers.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleIce = async (e: any) => {
      const { from, candidate } = e.detail;
      const pc = peers.current[from];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    };

    window.addEventListener('webrtc-offer', handleOffer as any);
    window.addEventListener('webrtc-answer', handleAnswer as any);
    window.addEventListener('webrtc-ice', handleIce as any);
    return () => {
      window.removeEventListener('webrtc-offer', handleOffer as any);
      window.removeEventListener('webrtc-answer', handleAnswer as any);
      window.removeEventListener('webrtc-ice', handleIce as any);
    };
  }, [connectToPeer, sendSignal]);

  // 4. Manage peer connections based on room users
  useEffect(() => {
    if (!roomId || !userId) return;

    const syncPeers = async () => {
      await initCamera();
      
      const currentUsers = new Set(users.map(u => u.id));
      
      // Cleanup users who left
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

      // Connect to new users (the person with the "higher" ID initiates)
      users.forEach(user => {
        if (user.id !== userId && !peers.current[user.id]) {
          if (userId! > user.id) {
            connectToPeer(user.id, true);
          }
        }
      });
    };

    syncPeers();
  }, [users, userId, roomId, initCamera, connectToPeer]);

  return { streams };
}
