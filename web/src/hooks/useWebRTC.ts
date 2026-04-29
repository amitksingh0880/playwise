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
  const makingOffer = useRef<Record<string, boolean>>({});

  const initLocalStream = async () => {
    if (localStream.current) return localStream.current;
    try {
      console.log('Requesting media devices for userId:', userId);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('Media stream captured successfully for userId:', userId);
      localStream.current = stream;
      setStreams((prev) => {
        console.log('Updating streams state with local stream for:', userId);
        return { ...prev, [userId!]: stream };
      });
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
      
      try {
        const isPolite = userId! < from; // Simple tie-breaker
        const readyForOffer = !makingOffer.current[from] && (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer');
        
        if (!readyForOffer && !isPolite) return;

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: 'webrtc-answer', targetId: from, answer });
      } catch (err) {
        console.error('Error handling offer', err);
      }
    };

    const handleAnswer = async (e: any) => {
      const { from, answer } = e.detail;
      const pc = peers.current[from];
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('Error handling answer', err);
        }
      }
    };

    const handleIce = async (e: any) => {
      const { from, candidate } = e.detail;
      const pc = peers.current[from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          // Ignore ICE candidates that arrive before remote description
        }
      }
    };

    window.addEventListener('webrtc-offer', handleOffer as any);
    window.addEventListener('webrtc-answer', handleAnswer as any);
    window.addEventListener('webrtc-ice', handleIce as any);

    return () => {
      window.removeEventListener('webrtc-offer', handleOffer as any);
      window.removeEventListener('webrtc-answer', handleAnswer as any);
      window.removeEventListener('webrtc-ice', handleIce as any);
    };
  }, [createPeerConnection, sendSignal, userId]);

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

      // Initiate offers to users with higher IDs (avoid double-offering)
      users.forEach(async (user) => {
        if (user.id !== userId && !peers.current[user.id] && userId! > user.id) {
          const pc = createPeerConnection(user.id);
          try {
            makingOffer.current[user.id] = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({ type: 'webrtc-offer', targetId: user.id, offer });
          } catch (err) {
            console.error('Error creating offer', err);
          } finally {
            makingOffer.current[user.id] = false;
          }
        }
      });
    };

    initPeers();
  }, [users, userId, roomId, createPeerConnection, sendSignal]);

  return { streams, localStream: localStream.current };
}
