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
  const cameraRequesting = useRef(false); // prevent concurrent getUserMedia calls

  // 1. Initialize camera — with deduplication guard
  const initCamera = useCallback(async () => {
    if (localStream.current) return localStream.current;
    if (cameraRequesting.current) return null; // already requesting, skip
    cameraRequesting.current = true;
    try {
      console.log('WebRTC: Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true 
      });
      localStream.current = stream;
      setStreams(prev => ({ ...prev, [userId!]: stream }));
      
      // Push tracks to any existing peer connections
      Object.values(peers.current).forEach(pc => {
        if (pc.getSenders().length === 0) {
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }
      });
      
      return stream;
    } catch (err) {
      console.error('WebRTC: Camera access denied', err);
      return null;
    } finally {
      cameraRequesting.current = false;
    }
  }, [userId]);

  // 2. Create connection to a peer
  const connectToPeer = useCallback(async (targetId: string, isInitiator: boolean) => {
    if (peers.current[targetId]) {
      // If connection exists but is failed, close it so we can retry
      const state = peers.current[targetId].connectionState;
      if (state !== 'failed' && state !== 'closed') return;
      peers.current[targetId].close();
    }

    console.log(`WebRTC: Connecting to ${targetId} (initiator: ${isInitiator})`);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peers.current[targetId] = pc;

    // Attach local tracks if available
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current!));
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal({ type: 'webrtc-ice', targetId, candidate: e.candidate });
    };

    pc.onnegotiationneeded = async () => {
      console.log(`WebRTC: Negotiation needed for ${targetId}`);
      if (isInitiator) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: 'webrtc-offer', targetId, offer });
        } catch (err) {
          console.error('WebRTC: Negotiation error', err);
        }
      }
    };

    pc.ontrack = (e) => {
      console.log(`WebRTC: Received remote track from ${targetId}`);
      setStreams(prev => ({ ...prev, [targetId]: e.streams[0] }));
    };

    pc.onconnectionstatechange = () => {
      console.log(`WebRTC: Connection state with ${targetId} is ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        // Retry logic: delete and let syncPeers recreate it
        delete peers.current[targetId];
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({ type: 'webrtc-offer', targetId, offer });
      } catch (err) {
        console.error('WebRTC: Failed to create offer', err);
      }
    }
  }, [sendSignal]);

  // 3. Handle incoming signals
  useEffect(() => {
    const handleOffer = async (e: any) => {
      const { from, offer } = e.detail;
      console.log(`WebRTC: Received offer from ${from}`);
      if (!peers.current[from]) await connectToPeer(from, false);
      const pc = peers.current[from];
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: 'webrtc-answer', targetId: from, answer });
      } catch (err) {
        console.error('WebRTC: Error handling offer', err);
      }
    };

    const handleAnswer = async (e: any) => {
      const { from, answer } = e.detail;
      console.log(`WebRTC: Received answer from ${from}`);
      const pc = peers.current[from];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('WebRTC: Error handling answer', err);
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
          // Candidates can fail if signaling happens before setRemoteDescription, usually ignorable
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

      // Connect to users (the person with the "higher" lexicographical ID initiates)
      // Sorting ensures consistent initiator roles even with complex strings
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
