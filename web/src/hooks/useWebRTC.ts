import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomStore } from '../features/room/RoomStore';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

interface PeerEntry {
  pc: RTCPeerConnection;
  iceCandidateQueue: RTCIceCandidate[];
  makingOffer: boolean;
  ignoreOffer: boolean;
}

export function useWebRTC(sendSignal: (data: any) => void) {
  const { userId, users, roomId, isJoined } = useRoomStore();
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const peersRef = useRef<Record<string, PeerEntry>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraInitializing = useRef(false);

  // ─── Camera Init ────────────────────────────────────────────────────────────
  const initCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current;
    if (cameraInitializing.current) return null;
    cameraInitializing.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;

      const currentUserId = useRoomStore.getState().userId;
      if (currentUserId) {
        setStreams(prev => ({ ...prev, [currentUserId]: stream }));
      }

      // Add tracks to any existing peer connections that don't have them yet
      Object.values(peersRef.current).forEach(({ pc }) => {
        if (pc.signalingState !== 'closed' && pc.getSenders().length === 0) {
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }
      });

      return stream;
    } catch (err) {
      console.error('[WebRTC] Camera/mic access denied:', err);
      return null;
    } finally {
      cameraInitializing.current = false;
    }
  }, []);

  // ─── Mute / Camera Toggle ────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(m => !m);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsCameraOff(c => !c);
    }
  }, []);

  // ─── Create / Get Peer ───────────────────────────────────────────────────────
  const getOrCreatePeer = useCallback((targetId: string): PeerEntry => {
    if (peersRef.current[targetId]) {
      const entry = peersRef.current[targetId];
      if (entry.pc.connectionState !== 'failed' && entry.pc.connectionState !== 'closed') {
        return entry;
      }
      entry.pc.close();
      delete peersRef.current[targetId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    const entry: PeerEntry = { pc, iceCandidateQueue: [], makingOffer: false, ignoreOffer: false };
    peersRef.current[targetId] = entry;

    // Attach local tracks immediately
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track =>
        pc.addTrack(track, localStreamRef.current!)
      );
    }

    // ICE candidates — send them out
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal({ type: 'webrtc-ice', targetId, candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state with ${targetId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce(); // attempt ICE restart before giving up
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${targetId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        delete peersRef.current[targetId];
        setStreams(prev => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      }
    };

    // Remote track received — display it
    pc.ontrack = ({ streams: remoteStreams }) => {
      const remoteStream = remoteStreams[0];
      if (remoteStream) {
        console.log(`[WebRTC] Got remote stream from ${targetId}`);
        // Store a ref on the pc for the extension content script compatibility
        (pc as any)._remoteStream = remoteStream;
        setStreams(prev => ({ ...prev, [targetId]: remoteStream }));
      }
    };

    return entry;
  }, [sendSignal]);

  // ─── Initiate offer to a peer ────────────────────────────────────────────────
  const callPeer = useCallback(async (targetId: string) => {
    const entry = getOrCreatePeer(targetId);
    const { pc } = entry;

    if (pc.signalingState !== 'stable' || entry.makingOffer) return;

    try {
      entry.makingOffer = true;
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      if (pc.signalingState !== 'stable') return; // abort if state changed
      await pc.setLocalDescription(offer);
      sendSignal({ type: 'webrtc-offer', targetId, offer: pc.localDescription });
      console.log(`[WebRTC] Sent offer to ${targetId}`);
    } catch (err) {
      console.error('[WebRTC] Failed to create offer:', err);
    } finally {
      entry.makingOffer = false;
    }
  }, [getOrCreatePeer, sendSignal]);

  // ─── Signal Handlers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const currentUserId = useRoomStore.getState().userId;

    // Perfect Negotiation pattern — polite peer defers to impolite
    const handleOffer = async (e: CustomEvent) => {
      const { from, offer } = e.detail;
      if (!from || from === currentUserId) return;

      const entry = getOrCreatePeer(from);
      const { pc } = entry;

      // "polite" = lower userId lexicographically — yields on offer collision
      const polite = (currentUserId ?? '') < from;
      const offerCollision = entry.makingOffer || pc.signalingState !== 'stable';
      entry.ignoreOffer = !polite && offerCollision;
      if (entry.ignoreOffer) {
        console.log(`[WebRTC] Ignoring colliding offer from ${from} (impolite)`);
        return;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Flush queued ICE candidates
        for (const candidate of entry.iceCandidateQueue) {
          await pc.addIceCandidate(candidate).catch(() => { });
        }
        entry.iceCandidateQueue = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: 'webrtc-answer', targetId: from, answer: pc.localDescription });
        console.log(`[WebRTC] Sent answer to ${from}`);
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    };

    const handleAnswer = async (e: CustomEvent) => {
      const { from, answer } = e.detail;
      if (!from || from === currentUserId) return;

      const entry = peersRef.current[from];
      if (!entry) return;

      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(answer));

        // Flush queued ICE candidates
        for (const candidate of entry.iceCandidateQueue) {
          await entry.pc.addIceCandidate(candidate).catch(() => { });
        }
        entry.iceCandidateQueue = [];

        console.log(`[WebRTC] Connection established with ${from}`);
      } catch (err) {
        if (!(err as any).message?.includes('setRemoteDescription')) {
          console.error('[WebRTC] Error handling answer:', err);
        }
      }
    };

    const handleIce = async (e: CustomEvent) => {
      const { from, candidate } = e.detail;
      if (!from || from === currentUserId || !candidate) return;

      const entry = peersRef.current[from];
      if (!entry) return;

      const iceCandidate = new RTCIceCandidate(candidate);

      // If remote description isn't set yet, queue the candidate
      if (!entry.pc.remoteDescription) {
        entry.iceCandidateQueue.push(iceCandidate);
        return;
      }

      try {
        await entry.pc.addIceCandidate(iceCandidate);
      } catch {
        if (!entry.ignoreOffer) {
          console.warn('[WebRTC] ICE candidate error (usually safe to ignore)');
        }
      }
    };

    window.addEventListener('webrtc-offer', handleOffer as EventListener);
    window.addEventListener('webrtc-answer', handleAnswer as EventListener);
    window.addEventListener('webrtc-ice', handleIce as EventListener);
    return () => {
      window.removeEventListener('webrtc-offer', handleOffer as EventListener);
      window.removeEventListener('webrtc-answer', handleAnswer as EventListener);
      window.removeEventListener('webrtc-ice', handleIce as EventListener);
    };
  }, [getOrCreatePeer, sendSignal]);

  // ─── Start camera when user joins ────────────────────────────────────────────
  useEffect(() => {
    if (isJoined && roomId && userId) {
      initCamera();
    }
  }, [isJoined, roomId, userId, initCamera]);

  // ─── Sync peers when user list changes ───────────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId) return;

    const syncPeers = async () => {
      const stream = await initCamera();
      if (!stream) return;

      const currentUserIds = new Set(users.map(u => u.id));

      // Disconnect from users who left
      Object.keys(peersRef.current).forEach(id => {
        if (!currentUserIds.has(id)) {
          peersRef.current[id].pc.close();
          delete peersRef.current[id];
          setStreams(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      });

      // Connect to new users
      // Initiator = lexicographically higher ID (consistent, deterministic)
      for (const user of users) {
        if (user.id === userId) continue;
        if (!peersRef.current[user.id]) {
          // Higher ID initiates — ensures exactly one side creates the offer
          if (userId > user.id) {
            await callPeer(user.id);
          } else {
            // Lower ID waits — still creates the peer entry to handle incoming offer
            getOrCreatePeer(user.id);
          }
        }
      }
    };

    syncPeers();
  }, [users, userId, roomId, initCamera, callPeer, getOrCreatePeer]);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      Object.values(peersRef.current).forEach(({ pc }) => pc.close());
      peersRef.current = {};
    };
  }, []);

  return { streams, isMuted, isCameraOff, toggleMute, toggleCamera };
}
