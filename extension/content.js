"use strict";
/**
 * Playwise Content Script v2.0
 * Injects a full floating sidebar (chat + participant cams + sync controls)
 * via Shadow DOM so styles never conflict with the host page.
 */
// ─── State ──────────────────────────────────────────────────────────────────
let videoElement = null;
let shadowRoot = null;
let localStream = null;
let peerConnections = {};
let roomId = null;
let userId = null;
let userName = "Guest";
let isConnected = false;
let messages = [];
let participants = [];
// ─── Shadow DOM Injection ────────────────────────────────────────────────────
function injectPanel() {
    if (document.getElementById("playwise-host"))
        return;
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
        background: rgba(5, 5, 15, 0.85);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border-left: 1px solid rgba(255,255,255,0.08);
        display: flex;
        flex-direction: column;
        pointer-events: all;
        transition: transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease;
        transform: translateX(100%);
        opacity: 0;
        box-shadow: -20px 0 60px rgba(0,0,0,0.8);
      }
      #pw-panel.open { transform: translateX(0); opacity: 1; }

      /* Neon top border */
      #pw-panel::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(192,38,211,0.6), rgba(6,182,212,0.6), transparent);
      }

      /* Toggle button */
      #pw-toggle {
        position: fixed;
        top: 50%;
        right: 0;
        transform: translateY(-50%);
        width: 36px;
        height: 64px;
        background: rgba(5,5,15,0.9);
        border: 1px solid rgba(255,255,255,0.1);
        border-right: none;
        border-radius: 12px 0 0 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: all;
        transition: all 0.3s ease;
        backdrop-filter: blur(12px);
        z-index: 1;
        font-size: 18px;
      }
      #pw-toggle:hover { background: rgba(192,38,211,0.2); border-color: rgba(192,38,211,0.4); }

      /* Header */
      #pw-header {
        padding: 16px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        flex-shrink: 0;
      }
      .pw-logo { display: flex; align-items: center; gap: 10px; }
      .pw-logo-icon {
        width: 30px; height: 30px;
        background: linear-gradient(135deg, #c026d3, #06b6d4);
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
        box-shadow: 0 0 16px rgba(192,38,211,0.5);
      }
      .pw-logo-text { font-size: 15px; font-weight: 800; color: white; letter-spacing: -0.5px; }
      .pw-badge {
        display: flex; align-items: center; gap: 6px;
        background: rgba(6,182,212,0.1);
        border: 1px solid rgba(6,182,212,0.3);
        border-radius: 999px;
        padding: 3px 10px;
        font-size: 10px; font-weight: 700;
        color: #06b6d4;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .pw-badge-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: #06b6d4;
        animation: pulse 2s infinite;
      }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

      /* Room Info */
      #pw-room-bar {
        padding: 10px 18px;
        background: rgba(255,255,255,0.03);
        border-bottom: 1px solid rgba(255,255,255,0.05);
        display: flex; align-items: center; gap: 8px;
        font-size: 11px; color: rgba(255,255,255,0.4);
        flex-shrink: 0;
      }
      #pw-room-bar span { color: #c026d3; font-weight: 700; letter-spacing: 2px; }

      /* Cams Section */
      #pw-cams {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        padding: 12px;
        flex-shrink: 0;
        max-height: 240px;
        overflow-y: auto;
      }
      .pw-cam-card {
        position: relative;
        aspect-ratio: 16/9;
        background: rgba(255,255,255,0.04);
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.08);
        transition: border-color 0.3s;
      }
      .pw-cam-card:hover { border-color: rgba(192,38,211,0.4); }
      .pw-cam-card video { width: 100%; height: 100%; object-fit: cover; }
      .pw-cam-label {
        position: absolute; bottom: 5px; left: 5px;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        border-radius: 6px; padding: 2px 8px;
        font-size: 9px; font-weight: 700; color: white;
        display: flex; align-items: center; gap: 4px;
      }
      .pw-cam-dot { width: 5px; height: 5px; border-radius: 50%; background: #06b6d4; animation: pulse 2s infinite; }
      .pw-cam-avatar {
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, rgba(192,38,211,0.2), rgba(6,182,212,0.2));
        font-size: 28px; font-weight: 800; color: rgba(192,38,211,0.8);
      }

      /* Reactions */
      #pw-reactions {
        display: flex; gap: 4px;
        padding: 8px 12px;
        flex-shrink: 0;
        border-top: 1px solid rgba(255,255,255,0.05);
      }
      .pw-emoji-btn {
        flex: 1; background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 8px; padding: 6px 4px;
        cursor: pointer; font-size: 16px;
        transition: all 0.2s; text-align: center;
      }
      .pw-emoji-btn:hover { background: rgba(192,38,211,0.2); border-color: rgba(192,38,211,0.4); transform: translateY(-2px) scale(1.1); }

      /* Chat */
      #pw-chat {
        flex: 1; overflow-y: auto;
        padding: 10px 12px;
        display: flex; flex-direction: column; gap: 10px;
        scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
      }
      .pw-msg { display: flex; gap: 8px; align-items: flex-start; }
      .pw-avatar {
        width: 28px; height: 28px; border-radius: 8px;
        background: linear-gradient(135deg, #c026d3, #06b6d4);
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 800; color: white;
        flex-shrink: 0;
        box-shadow: 0 0 10px rgba(192,38,211,0.3);
      }
      .pw-bubble { flex: 1; }
      .pw-bubble-name { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 3px; }
      .pw-bubble-text {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px; border-top-left-radius: 3px;
        padding: 7px 10px; font-size: 12px; color: rgba(255,255,255,0.9);
        line-height: 1.4;
      }

      /* Reaction Pop */
      .pw-reaction-pop {
        position: fixed; pointer-events: none;
        font-size: 36px; z-index: 2147483647;
        animation: floatUp 1.5s ease-out forwards;
      }
      @keyframes floatUp {
        from { transform: translateY(0) scale(0.5); opacity: 1; }
        to { transform: translateY(-120px) scale(1.3); opacity: 0; }
      }

      /* Input */
      #pw-input-area {
        padding: 10px 12px;
        border-top: 1px solid rgba(255,255,255,0.06);
        display: flex; gap: 8px; flex-shrink: 0;
      }
      #pw-chat-input {
        flex: 1;
        background: rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 8px 12px;
        color: white; font-size: 12px; font-family: inherit;
        outline: none;
        transition: border-color 0.2s;
      }
      #pw-chat-input:focus { border-color: rgba(6,182,212,0.5); }
      #pw-chat-input::placeholder { color: rgba(255,255,255,0.3); }
      #pw-send-btn {
        background: linear-gradient(135deg, #c026d3, #06b6d4);
        border: none; border-radius: 10px;
        width: 36px; height: 36px;
        cursor: pointer; color: white; font-size: 14px;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s;
        box-shadow: 0 0 12px rgba(192,38,211,0.4);
      }
      #pw-send-btn:hover { transform: scale(1.08); box-shadow: 0 0 20px rgba(192,38,211,0.6); }

      /* Disconnected overlay */
      #pw-disconnected {
        display: none;
        position: absolute; inset: 0;
        background: rgba(5,5,15,0.95);
        flex-direction: column;
        align-items: center; justify-content: center;
        gap: 16px; text-align: center; padding: 24px;
        z-index: 10;
      }
      #pw-disconnected.show { display: flex; }
      #pw-disconnected p { color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.6; }
      #pw-disconnected .pw-big { font-size: 40px; }
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
        Room: <span id="pw-room-label">—</span>
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
        <div class="pw-big">🎬</div>
        <p>Join a room from the <strong>Playwise popup</strong> to see the floating panel here.</p>
      </div>
    </div>
  `;
    setupPanelEvents();
}
// ─── Panel Event Bindings ────────────────────────────────────────────────────
function setupPanelEvents() {
    const sr = shadowRoot;
    // Toggle button
    const toggle = sr.getElementById("pw-toggle");
    const panel = sr.getElementById("pw-panel");
    toggle.addEventListener("click", () => {
        panel.classList.toggle("open");
        toggle.textContent = panel.classList.contains("open") ? "✕" : "🎬";
    });
    // Send chat message
    const input = sr.getElementById("pw-chat-input");
    const sendBtn = sr.getElementById("pw-send-btn");
    const doSend = () => {
        const text = input.value.trim();
        if (!text)
            return;
        chrome.runtime.sendMessage({ type: "SEND_CHAT", message: text });
        addChatMessage({ id: "me", user: userName, text });
        input.value = "";
    };
    sendBtn.addEventListener("click", doSend);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter")
        doSend(); });
    // Emoji reactions
    sr.querySelectorAll(".pw-emoji-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const emoji = btn.dataset.emoji;
            chrome.runtime.sendMessage({ type: "SEND_REACTION", emoji });
            showReactionPop(emoji);
        });
    });
}
// ─── UI Updates ──────────────────────────────────────────────────────────────
function setConnected(rid) {
    if (!shadowRoot)
        return;
    roomId = rid;
    isConnected = true;
    shadowRoot.getElementById("pw-room-label").textContent = rid;
    shadowRoot.getElementById("pw-disconnected").classList.remove("show");
    startCamera();
    renderCams();
}
function setDisconnected() {
    if (!shadowRoot)
        return;
    isConnected = false;
    shadowRoot.getElementById("pw-disconnected").classList.add("show");
    stopCamera();
    peerConnections = {};
    renderCams();
}
function addChatMessage(msg) {
    messages.push(msg);
    if (!shadowRoot)
        return;
    const chat = shadowRoot.getElementById("pw-chat");
    const el = document.createElement("div");
    el.className = "pw-msg";
    el.innerHTML = `
    <div class="pw-avatar">${msg.user.charAt(0).toUpperCase()}</div>
    <div class="pw-bubble">
      <div class="pw-bubble-name">${msg.user}</div>
      <div class="pw-bubble-text">${escapeHtml(msg.text)}</div>
    </div>
  `;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
}
function renderCams() {
    if (!shadowRoot)
        return;
    const grid = shadowRoot.getElementById("pw-cams");
    grid.innerHTML = "";
    // Local cam
    if (localStream) {
        const card = createCamCard("You", localStream, true);
        grid.appendChild(card);
    }
    // Remote cams
    Object.entries(peerConnections).forEach(([peerId, pc]) => {
        const remoteStream = pc._remoteStream;
        const peerName = participants.find(p => p.id === peerId)?.name || peerId;
        const card = createCamCard(peerName, remoteStream || null, false);
        grid.appendChild(card);
    });
}
function createCamCard(name, stream, mirror) {
    const card = document.createElement("div");
    card.className = "pw-cam-card";
    if (stream) {
        const video = document.createElement("video");
        video.autoplay = true;
        video.playsInline = true;
        video.muted = mirror;
        if (mirror)
            video.style.transform = "scaleX(-1)";
        video.srcObject = stream;
        card.appendChild(video);
    }
    else {
        const av = document.createElement("div");
        av.className = "pw-cam-avatar";
        av.textContent = name.charAt(0).toUpperCase();
        card.appendChild(av);
    }
    const label = document.createElement("div");
    label.className = "pw-cam-label";
    label.innerHTML = `<span class="pw-cam-dot"></span>${name}`;
    card.appendChild(label);
    return card;
}
function showReactionPop(emoji) {
    const el = document.createElement("div");
    el.className = "pw-reaction-pop";
    el.textContent = emoji;
    const x = Math.random() * (window.innerWidth - 100) + 50;
    const y = window.innerHeight - 100;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
}
// ─── Camera ──────────────────────────────────────────────────────────────────
async function startCamera() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        renderCams();
    }
    catch (e) {
        console.warn("[Playwise] Camera not available:", e);
    }
}
function stopCamera() {
    localStream?.getTracks().forEach(t => t.stop());
    localStream = null;
}
// ─── Smart Video Detection ───────────────────────────────────────────────────
function findMainVideo() {
    const all = getAllVideos(document);
    if (!all.length)
        return null;
    // Score by area and duration — biggest long-playing video wins
    return all.reduce((best, v) => {
        const area = v.videoWidth * v.videoHeight;
        const bestArea = best.videoWidth * best.videoHeight;
        const score = area + v.duration * 100;
        const bestScore = bestArea + best.duration * 100;
        return score > bestScore ? v : best;
    });
}
function getAllVideos(root) {
    const vids = Array.from(root.querySelectorAll("video"));
    root.querySelectorAll("*").forEach(el => {
        if (el.shadowRoot) {
            vids.push(...getAllVideos(el.shadowRoot));
        }
    });
    return vids;
}
function setupVideoListeners(video) {
    const sync = () => {
        if (!chrome.runtime?.id)
            return;
        chrome.runtime.sendMessage({
            type: "SYNC_STATE",
            state: { currentTime: video.currentTime, isPlaying: !video.paused }
        }).catch(() => { });
    };
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("seeked", sync);
}
// ─── Message Handler from Background ────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "PW_CONNECTED") {
        setConnected(msg.roomId);
    }
    else if (msg.type === "PW_DISCONNECTED") {
        setDisconnected();
    }
    else if (msg.type === "UPDATE_VIDEO") {
        const video = findMainVideo();
        if (!video)
            return;
        const { currentTime, isPlaying } = msg.state;
        if (Math.abs(video.currentTime - currentTime) > 1.5)
            video.currentTime = currentTime;
        if (isPlaying && video.paused)
            video.play().catch(() => { });
        else if (!isPlaying && !video.paused)
            video.pause();
    }
    else if (msg.type === "PW_CHAT") {
        addChatMessage({ id: msg.payload.userId, user: msg.payload.userName || "Guest", text: msg.payload.message });
    }
    else if (msg.type === "PW_REACTION") {
        showReactionPop(msg.payload.emoji);
    }
    else if (msg.type === "ROOM_STATE_UPDATE") {
        if (msg.payload.type === "user-joined") {
            participants.push({ id: msg.payload.userId, name: msg.payload.name || "Guest" });
        }
        else if (msg.payload.type === "user-left") {
            participants = participants.filter(p => p.id !== msg.payload.userId);
        }
        renderCams();
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
function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Restore connection state if already in a room
chrome.storage.local.get(["currentRoomId", "userId", "userName"], (result) => {
    if (result["userId"])
        userId = result["userId"];
    if (result["userName"])
        userName = result["userName"];
    if (result["currentRoomId"]) {
        chrome.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
            if (state?.roomId)
                setConnected(state.roomId);
        });
    }
});
injectPanel();
