/**
 * Playwise Content Script v2.1
 * Injects a full floating sidebar (chat + participant cams + sync controls)
 * via Shadow DOM so styles never conflict with the host page.
 *
 * Implements Perfect Negotiation WebRTC for stable video calls.
 */

// ─── State ──────────────────────────────────────────────────────────────────
let videoElement: HTMLVideoElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let localStream: MediaStream | null = null;
let roomId: string | null = null;
let userId: string | null = null;
let userName: string = "Guest";
let isConnected = false;
let messages: Array<{ id: string; user: string; text: string; avatar?: string }> = [];
let participants: Array<{ id: string; name: string; role: string; color?: string; avatar?: string }> = [];

interface PeerEntry {
  pc: RTCPeerConnection;
  iceCandidateQueue: RTCIceCandidate[];
  makingOffer: boolean;
  ignoreOffer: boolean;
}
let peers: Record<string, PeerEntry> = {};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

// ─── Shadow DOM Injection ────────────────────────────────────────────────────
function injectPanel() {
  if (document.getElementById("playwise-host")) return;

  const host = document.createElement("div");
  host.id = "playwise-host";
  host.style.cssText = "position:fixed;top:0;right:0;z-index:2147483647;pointer-events:none;";
  document.body.appendChild(host);

  shadowRoot = host.attachShadow({ mode: "open" });
  shadowRoot.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'JetBrains Mono', monospace; }

      #pw-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 360px;
        height: 100vh;
        background: rgba(5, 5, 15, 0.9);
        backdrop-filter: blur(32px);
        -webkit-backdrop-filter: blur(32px);
        border-left: 1px solid rgba(255,255,255,0.1);
        display: flex;
        flex-direction: column;
        pointer-events: all;
        transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
        transform: translateX(100%);
        opacity: 0;
        box-shadow: -20px 0 80px rgba(0,0,0,0.9);
      }
      #pw-panel.open { transform: translateX(0); opacity: 1; }

      /* Neon glow */
      #pw-panel::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #c026d3, #06b6d4, transparent);
        z-index: 10;
      }

      /* Toggle button */
      #pw-toggle {
        position: fixed;
        top: 50%;
        right: 0;
        transform: translateY(-50%);
        width: 42px;
        height: 72px;
        background: rgba(5,5,15,0.95);
        border: 1px solid rgba(255,255,255,0.15);
        border-right: none;
        border-radius: 16px 0 0 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: all;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        backdrop-filter: blur(12px);
        z-index: 2147483647;
        font-size: 20px;
        box-shadow: -5px 0 20px rgba(0,0,0,0.5);
      }
      #pw-toggle:hover { background: rgba(192,38,211,0.25); border-color: rgba(192,38,211,0.5); width: 48px; }

      /* Header */
      #pw-header {
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }
      .pw-logo { display: flex; align-items: center; gap: 12px; }
      .pw-logo-icon {
        width: 34px; height: 34px;
        background: linear-gradient(135deg, #c026d3, #06b6d4);
        border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px;
        box-shadow: 0 0 20px rgba(192,38,211,0.6);
        color: white;
      }
      .pw-logo-text { font-size: 18px; font-weight: 800; color: white; letter-spacing: -0.8px; }
      .pw-badge {
        display: flex; align-items: center; gap: 6px;
        background: rgba(6,182,212,0.15);
        border: 1px solid rgba(6,182,212,0.4);
        border-radius: 999px;
        padding: 4px 12px;
        font-size: 10px; font-weight: 800;
        color: #06b6d4;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .pw-badge-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: #06b6d4;
        box-shadow: 0 0 10px #06b6d4;
        animation: pulse 2s infinite;
      }
      @keyframes pulse { 0%,100%{opacity:1; transform:scale(1);} 50%{opacity:0.4; transform:scale(0.8);} }

      /* Room Info */
      #pw-room-bar {
        padding: 12px 24px;
        background: rgba(255,255,255,0.04);
        border-bottom: 1px solid rgba(255,255,255,0.06);
        display: flex; align-items: center; gap: 10px;
        font-size: 12px; color: rgba(255,255,255,0.5);
        flex-shrink: 0;
      }
      #pw-room-bar span { color: #c026d3; font-weight: 800; letter-spacing: 3px; }

      /* Cams Section */
      #pw-cams {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        padding: 16px;
        flex-shrink: 0;
        max-height: 280px;
        overflow-y: auto;
        scrollbar-width: none;
      }
      #pw-cams::-webkit-scrollbar { display: none; }

      .pw-cam-card {
        position: relative;
        aspect-ratio: 16/9;
        background: #020205;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.1);
        transition: all 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      }
      .pw-cam-card:hover { border-color: rgba(192,38,211,0.6); transform: scale(1.02); }
      .pw-cam-card video { width: 100%; height: 100%; object-fit: cover; }
      
      .pw-cam-label {
        position: absolute; bottom: 8px; left: 8px; right: 8px;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(10px);
        border-radius: 8px; padding: 4px 10px;
        font-size: 10px; font-weight: 800; color: white;
        display: flex; align-items: center; justify-content: space-between;
        border: 1px solid rgba(255,255,255,0.15);
        pointer-events: none;
        z-index: 5;
      }
      .pw-cam-dot { width: 6px; height: 6px; border-radius: 50%; background: #06b6d4; box-shadow: 0 0 5px #06b6d4; }
      .pw-cam-role { font-size: 8px; font-weight: 900; color: #06b6d4; background: rgba(6,182,212,0.15); padding: 2px 6px; border-radius: 5px; text-transform: uppercase; }
      
      .pw-cam-avatar {
        width: 100%; height: 100%;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: #05050f;
        font-size: 32px;
      }
      .pw-cam-no-video {
        font-size: 8px; font-weight: 800; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-top: 4px;
      }

      /* Reactions */
      #pw-reactions {
        display: flex; gap: 6px;
        padding: 10px 16px;
        flex-shrink: 0;
        border-top: 1px solid rgba(255,255,255,0.06);
      }
      .pw-emoji-btn {
        flex: 1; background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px; padding: 8px 4px;
        cursor: pointer; font-size: 20px;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .pw-emoji-btn:hover { 
        background: rgba(192,38,211,0.25); 
        border-color: rgba(192,38,211,0.5); 
        transform: translateY(-5px) scale(1.15);
        box-shadow: 0 10px 20px rgba(192,38,211,0.3);
      }

      /* Chat */
      #pw-chat {
        flex: 1; overflow-y: auto;
        padding: 16px;
        display: flex; flex-direction: column; gap: 12px;
        scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
      }
      .pw-msg { display: flex; gap: 12px; align-items: flex-start; }
      .pw-avatar {
        width: 32px; height: 32px; border-radius: 10px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; flex-shrink: 0;
      }
      .pw-bubble { flex: 1; }
      .pw-bubble-name { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.4); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
      .pw-bubble-text {
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 14px; border-top-left-radius: 4px;
        padding: 10px 14px; font-size: 13px; color: rgba(255,255,255,0.9);
        line-height: 1.5;
      }

      /* Input */
      #pw-input-area {
        padding: 16px;
        border-top: 1px solid rgba(255,255,255,0.08);
        display: flex; gap: 10px; flex-shrink: 0;
        background: rgba(255,255,255,0.02);
      }
      #pw-chat-input {
        flex: 1;
        background: rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 12px;
        padding: 12px 16px;
        color: white; font-size: 13px; font-family: inherit;
        outline: none;
        transition: border-color 0.3s;
      }
      #pw-chat-input:focus { border-color: #06b6d4; background: rgba(0,0,0,0.6); }
      #pw-send-btn {
        background: linear-gradient(135deg, #c026d3, #06b6d4);
        border: none; border-radius: 12px;
        width: 44px; height: 44px;
        cursor: pointer; color: white; font-size: 18px;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.3s;
        box-shadow: 0 0 15px rgba(192,38,211,0.5);
      }
      #pw-send-btn:hover { transform: scale(1.1); box-shadow: 0 0 25px rgba(192,38,211,0.7); }

      /* Disconnected overlay */
      #pw-disconnected {
        display: none;
        position: absolute; inset: 0;
        background: #05050f;
        flex-direction: column;
        align-items: center; justify-content: center;
        gap: 20px; text-align: center; padding: 40px;
        z-index: 100;
      }
      #pw-disconnected.show { display: flex; }
      #pw-disconnected p { color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.8; }
      .pw-big-icon {
         width: 80px; height: 80px;
         background: linear-gradient(135deg, rgba(192,38,211,0.1), rgba(6,182,212,0.1));
         border-radius: 24px;
         border: 1px solid rgba(255,255,255,0.1);
         display: flex; align-items: center; justify-content: center;
         font-size: 40px; margin-bottom: 10px;
      }
    </style>

    <button id="pw-toggle">🎬</button>

    <div id="pw-panel">
      <!-- Header -->
      <div id="pw-header">
        <div class="pw-logo">
          <div class="pw-logo-icon">▶</div>
          <span class="pw-logo-text">Playwise</span>
        </div>
        <div class="pw-badge" id="pw-status-badge">
          <div class="pw-badge-dot"></div>
          <span id="pw-badge-label">LIVE</span>
        </div>
      </div>

      <!-- Room ID bar -->
      <div id="pw-room-bar">
        ROOM: <span id="pw-room-label">—</span>
      </div>

      <!-- Participant camera grid -->
      <div id="pw-cams"></div>

      <!-- Emoji reactions -->
      <div id="pw-reactions">
        <button class="pw-emoji-btn" data-emoji="❤️">❤️</button>
        <button class="pw-emoji-btn" data-emoji="🔥">🔥</button>
        <button class="pw-emoji-btn" data-emoji="😂">😂</button>
        <button class="pw-emoji-btn" data-emoji="😮">😮</button>
        <button class="pw-emoji-btn" data-emoji="👏">👏</button>
      </div>

      <!-- Chat messages -->
      <div id="pw-chat"></div>

      <!-- Input -->
      <div id="pw-input-area">
        <input id="pw-chat-input" placeholder="Say something..." />
        <button id="pw-send-btn">➤</button>
      </div>

      <!-- Disconnected overlay -->
      <div id="pw-disconnected" class="show">
        <div class="pw-big-icon">🎬</div>
        <p>Join a room from the <strong>Playwise popup</strong> to see the floating panel here.</p>
      </div>
    </div>
  `;

  setupPanelEvents();
}

// ─── Panel Event Bindings ────────────────────────────────────────────────────
function setupPanelEvents() {
  const sr = shadowRoot!;

  // Toggle button
  const toggle = sr.getElementById("pw-toggle")!;
  const panel = sr.getElementById("pw-panel")!;
  toggle.addEventListener("click", () => {
    panel.classList.toggle("open");
    toggle.textContent = panel.classList.contains("open") ? "✕" : "🎬";
  });

  // Send chat message
  const input = sr.getElementById("pw-chat-input") as HTMLInputElement;
  const sendBtn = sr.getElementById("pw-send-btn")!;
  const doSend = () => {
    const text = input.value.trim();
    if (!text) return;
    chrome.runtime.sendMessage({ type: "SEND_CHAT", message: text });
    input.value = "";
  };
  sendBtn.addEventListener("click", doSend);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSend(); });

  // Emoji reactions
  sr.querySelectorAll(".pw-emoji-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const emoji = (btn as HTMLElement).dataset.emoji!;
      chrome.runtime.sendMessage({ type: "SEND_REACTION", emoji });
    });
  });
}

// ─── WebRTC Signal Handlers ──────────────────────────────────────────────────

async function handleOffer(from: string, offer: RTCSessionDescriptionInit) {
  const entry = getOrCreatePeer(from);
  const polite = userId! < from;
  const collision = entry.makingOffer || entry.pc.signalingState !== "stable";
  entry.ignoreOffer = !polite && collision;
  if (entry.ignoreOffer) return;

  try {
    await entry.pc.setRemoteDescription(new RTCSessionDescription(offer));
    for (const candidate of entry.iceCandidateQueue) {
      await entry.pc.addIceCandidate(candidate).catch(() => {});
    }
    entry.iceCandidateQueue = [];
    const answer = await entry.pc.createAnswer();
    await entry.pc.setLocalDescription(answer);
    chrome.runtime.sendMessage({ ...offer, type: "SEND_SIGNAL", targetId: from, signalType: "webrtc-answer" });
  } catch (err) {
    console.error("[Playwise] Offer error", err);
  }
}

async function handleAnswer(from: string, answer: RTCSessionDescriptionInit) {
  const entry = peers[from];
  if (!entry) return;
  try {
    await entry.pc.setRemoteDescription(new RTCSessionDescription(answer));
    for (const candidate of entry.iceCandidateQueue) {
      await entry.pc.addIceCandidate(candidate).catch(() => {});
    }
    entry.iceCandidateQueue = [];
  } catch (err) {
    console.error("[Playwise] Answer error", err);
  }
}

async function handleIce(from: string, candidate: RTCIceCandidateInit) {
  const entry = peers[from];
  if (!entry) return;
  const ice = new RTCIceCandidate(candidate);
  if (!entry.pc.remoteDescription) {
    entry.iceCandidateQueue.push(ice);
  } else {
    try {
      await entry.pc.addIceCandidate(ice);
    } catch {}
  }
}

function getOrCreatePeer(targetId: string): PeerEntry {
  if (peers[targetId]) {
    const entry = peers[targetId];
    if (entry.pc.connectionState !== "failed" && entry.pc.connectionState !== "closed") return entry;
    entry.pc.close();
  }

  const pc = new RTCPeerConnection(ICE_SERVERS);
  const entry: PeerEntry = { pc, iceCandidateQueue: [], makingOffer: false, ignoreOffer: false };
  peers[targetId] = entry;

  if (localStream) {
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream!));
  }

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) chrome.runtime.sendMessage({ type: "SEND_SIGNAL", targetId, signalType: "webrtc-ice", candidate });
  };

  pc.ontrack = ({ streams: remoteStreams }) => {
    const s = remoteStreams[0];
    if (s) {
      (pc as any)._remoteStream = s;
      renderCams();
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      delete peers[targetId];
      renderCams();
    }
  };

  return entry;
}

async function callPeer(targetId: string) {
  const entry = getOrCreatePeer(targetId);
  if (entry.pc.signalingState !== "stable" || entry.makingOffer) return;
  try {
    entry.makingOffer = true;
    const offer = await entry.pc.createOffer();
    await entry.pc.setLocalDescription(offer);
    chrome.runtime.sendMessage({ ...entry.pc.localDescription, type: "SEND_SIGNAL", targetId, signalType: "webrtc-offer" });
  } catch (err) {
    console.error("[Playwise] Call error", err);
  } finally {
    entry.makingOffer = false;
  }
}

// ─── UI Updates ──────────────────────────────────────────────────────────────
function setConnected(rid: string, avatar?: string) {
  if (!shadowRoot) return;
  roomId = rid;
  isConnected = true;
  (shadowRoot.getElementById("pw-room-label") as HTMLElement).textContent = rid;
  (shadowRoot.getElementById("pw-disconnected") as HTMLElement).classList.remove("show");
  startCamera();
}

function setDisconnected() {
  if (!shadowRoot) return;
  isConnected = false;
  (shadowRoot.getElementById("pw-disconnected") as HTMLElement).classList.add("show");
  stopCamera();
  Object.values(peers).forEach(e => e.pc.close());
  peers = {};
  renderCams();
}

function addChatMessage(msg: { id: string; user: string; text: string; avatar?: string }) {
  messages.push(msg);
  if (!shadowRoot) return;
  const chat = shadowRoot.getElementById("pw-chat")!;
  const el = document.createElement("div");
  el.className = "pw-msg";
  const avatar = msg.avatar || msg.user.charAt(0).toUpperCase();
  el.innerHTML = `
    <div class="pw-avatar">${avatar}</div>
    <div class="pw-bubble">
      <div class="pw-bubble-name">${msg.user}</div>
      <div class="pw-bubble-text">${escapeHtml(msg.text)}</div>
    </div>
  `;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

function renderCams() {
  if (!shadowRoot) return;
  const grid = shadowRoot.getElementById("pw-cams")!;
  grid.innerHTML = "";

  // Local cam
  if (localStream) {
    grid.appendChild(createCamCard("You", localStream, true, "me", participants.find(p => p.id === userId)?.avatar));
  }

  // Remote cams
  Object.entries(peers).forEach(([peerId, entry]) => {
    const remoteStream = (entry.pc as any)._remoteStream as MediaStream | undefined;
    const p = participants.find(p => p.id === peerId);
    grid.appendChild(createCamCard(p?.name || peerId, remoteStream || null, false, p?.role, p?.avatar));
  });
}

function createCamCard(name: string, stream: MediaStream | null, mirror: boolean, role?: string, avatarUrl?: string): HTMLElement {
  const card = document.createElement("div");
  card.className = "pw-cam-card";
  
  const hasVideo = stream && stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

  if (stream && hasVideo) {
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = mirror;
    if (mirror) video.style.transform = "scaleX(-1)";
    video.srcObject = stream;
    video.play().catch(() => {});
    card.appendChild(video);
  } else {
    const av = document.createElement("div");
    av.className = "pw-cam-avatar";
    av.innerHTML = `<span>${avatarUrl || name.charAt(0).toUpperCase()}</span><span class="pw-cam-no-video">CAM OFF</span>`;
    card.appendChild(av);
  }

  const label = document.createElement("div");
  label.className = "pw-cam-label";
  const roleTag = role && role !== 'user' ? `<span class="pw-cam-role">${role}</span>` : '';
  label.innerHTML = `<div style="display:flex;align-items:center;gap:6px;"><span class="pw-cam-dot"></span>${name}</div> ${roleTag}`;
  card.appendChild(label);
  return card;
}

// ─── Camera ──────────────────────────────────────────────────────────────────
async function startCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 360 }, 
      audio: true 
    });
    renderCams();
    syncPeers();
  } catch (e) {
    console.warn("[Playwise] Camera not available:", e);
  }
}

function stopCamera() {
  localStream?.getTracks().forEach(t => t.stop());
  localStream = null;
}

// ─── Smart Video Detection ───────────────────────────────────────────────────
function findMainVideo(): HTMLVideoElement | null {
  const all = getAllVideos(document);
  if (!all.length) return null;
  return all.reduce((best, v) => {
    const area = v.videoWidth * v.videoHeight;
    const bestArea = best.videoWidth * best.videoHeight;
    const score = area + v.duration * 100;
    const bestScore = bestArea + best.duration * 100;
    return score > bestScore ? v : best;
  });
}

function getAllVideos(root: Document | ShadowRoot): HTMLVideoElement[] {
  const vids: HTMLVideoElement[] = Array.from(root.querySelectorAll("video"));
  root.querySelectorAll("*").forEach(el => {
    if ((el as HTMLElement).shadowRoot) {
      vids.push(...getAllVideos((el as HTMLElement).shadowRoot!));
    }
  });
  return vids;
}

function setupVideoListeners(video: HTMLVideoElement) {
  const sync = () => {
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage({
      type: "SYNC_STATE",
      state: { currentTime: video.currentTime, isPlaying: !video.paused }
    }).catch(() => {});
  };
  video.addEventListener("play", sync);
  video.addEventListener("pause", sync);
  video.addEventListener("seeked", sync);
}

// ─── Sync Peers ───────────────────────────────────────────────────────────────
function syncPeers() {
  if (!userId || !isConnected) return;
  participants.forEach(p => {
    if (p.id !== userId && !peers[p.id]) {
       if (userId! > p.id) callPeer(p.id);
       else getOrCreatePeer(p.id);
    }
  });
}

// ─── Message Handler from Background ────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "PW_CONNECTED") {
    setConnected(msg.roomId, msg.avatar);
  } else if (msg.type === "PW_DISCONNECTED") {
    setDisconnected();
  } else if (msg.type === "UPDATE_VIDEO") {
    const video = findMainVideo();
    if (!video) return;
    const { currentTime, isPlaying, serverTime } = msg.state;
    
    let targetTime = currentTime;
    if (serverTime && isPlaying) {
      const delay = (Date.now() - serverTime) / 1000;
      targetTime += Math.min(delay, 5); // Cap at 5s
    }

    const drift = Math.abs(video.currentTime - targetTime);
    if (drift > 1.5) video.currentTime = targetTime;
    
    if (isPlaying && video.paused) video.play().catch(() => {});
    else if (!isPlaying && !video.paused) video.pause();
  } else if (msg.type === "PW_CHAT") {
    addChatMessage({ id: msg.payload.userId, user: msg.payload.userName || "Guest", text: msg.payload.message });
  } else if (msg.type === "PW_REACTION") {
    // Show on host page if possible or just log
  } else if (msg.type === "ROOM_STATE") {
    participants = msg.payload.users.map((u: any) => ({
      id: u.id, name: u.name, role: u.role, color: u.color, avatar: u.avatarUrl
    }));
    syncPeers();
    renderCams();
  } else if (msg.type === "ROOM_STATE_UPDATE") {
    // Already handled by ROOM_STATE in this v2.1 implementation
  } else if (msg.type === "webrtc-offer") {
    handleOffer(msg.payload.from, msg.payload.offer);
  } else if (msg.type === "webrtc-answer") {
    handleAnswer(msg.payload.from, msg.payload.answer);
  } else if (msg.type === "webrtc-ice") {
    handleIce(msg.payload.from, msg.payload.candidate);
  }
});

// ─── Polling ─────────────────────────────────────────────────────────────────
setInterval(() => {
  const v = findMainVideo();
  if (v && v !== videoElement) {
    videoElement = v;
    setupVideoListeners(v);
  }
}, 2000);

// ─── Init ─────────────────────────────────────────────────────────────────────
function escapeHtml(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function checkExistingSession() {
  chrome.storage.local.get(["currentRoomId", "userId", "userName"], (result) => {
    if (result["userId"]) userId = result["userId"] as string;
    if (result["userName"]) userName = result["userName"] as string;
    if (result["currentRoomId"]) {
      chrome.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
        if (chrome.runtime.lastError) {
          setTimeout(checkExistingSession, 2000);
          return;
        }
        if (state?.roomId) setConnected(state.roomId, state.userAvatar);
      });
    }
  });
}

checkExistingSession();
injectPanel();
