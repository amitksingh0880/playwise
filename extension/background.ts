/**
 * Playwise Background Service Worker v2.1
 * Manages WebSocket connection, room state, and relays messages between
 * the popup, content scripts, and the Playwise server.
 *
 * Key fixes:
 * - Restores userId from storage on startup (prevents new ID on service worker restart)
 * - Broadcasts to ALL tabs with the content script, not just the active one
 * - Sends a fresh room-state to any content script that requests GET_STATE
 */

const WS_URL = "wss://playwise-4.onrender.com";
let socket: WebSocket | null = null;
let currentRoomId: string | null = null;
let extensionUserId: string | null = null;
let extensionUserName: string = "Extension User";
let extensionUserAvatar: string = "🤖";
let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 3000;
const MAX_RETRY_DELAY = 30000;

// ─── Restore persisted state on service worker startup ────────────────────────
chrome.storage.local.get(["currentRoomId", "userId", "userName", "userAvatar"], (result) => {
  if (result["userId"]) extensionUserId = result["userId"] as string;
  if (result["userName"]) extensionUserName = result["userName"] as string;
  if (result["userAvatar"]) extensionUserAvatar = result["userAvatar"] as string;
  if (result["currentRoomId"]) {
    currentRoomId = result["currentRoomId"] as string;
    // Reconnect if we were already in a room
    connect();
  }
});

// ─── WebSocket Connection Management ─────────────────────────────────────────

function connect() {
  if (!currentRoomId) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  console.log("[Playwise BG] Connecting to server...");
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log("[Playwise BG] Connected.");
    retryDelay = 3000;
    if (currentRoomId && extensionUserId && socket) {
      socket.send(JSON.stringify({
        type: "join",
        roomId: currentRoomId,
        userId: extensionUserId,
        name: extensionUserName,
        avatarUrl: extensionUserAvatar
      }));
    }
    broadcastToAllTabs({ type: "PW_CONNECTED", roomId: currentRoomId, avatar: extensionUserAvatar });
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "sync") {
        broadcastToAllTabs({ type: "UPDATE_VIDEO", state: data.payload });
      } else if (data.type === "room-state") {
        broadcastToAllTabs({ type: "ROOM_STATE", payload: data.payload });
      } else if (data.type === "chat") {
        broadcastToAllTabs({ type: "PW_CHAT", payload: data.payload });
      } else if (data.type === "reaction") {
        broadcastToAllTabs({ type: "PW_REACTION", payload: data.payload });
      } else if (data.type === "user-joined" || data.type === "user-left") {
        broadcastToAllTabs({ type: "ROOM_STATE_UPDATE", payload: data.payload });
        // Also sync the full room state to keep UI up-to-date
        if (data.payload?.room) {
          broadcastToAllTabs({ type: "ROOM_STATE", payload: data.payload.room });
        }
      }
    } catch (e) {
      console.error("[Playwise BG] Failed to parse message", e);
    }
  };

  socket.onclose = () => {
    console.log(`[Playwise BG] Disconnected. Retrying in ${retryDelay / 1000}s...`);
    broadcastToAllTabs({ type: "PW_DISCONNECTED" });
    if (currentRoomId) {
      retryTimeout = setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
        connect();
      }, retryDelay);
    }
  };

  socket.onerror = () => {
    socket?.close();
  };
}

// ─── Broadcast to ALL tabs that have the content script ──────────────────────
// Fix: was previously only sending to the active/focused tab, which meant
// the video tab would miss messages if the user had switched to another tab.

function broadcastToAllTabs(message: object) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab may not have content script injected — ignore silently
        });
      }
    });
  });
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "JOIN_ROOM") {
    if (retryTimeout) { clearTimeout(retryTimeout); retryTimeout = null; }
    currentRoomId = msg.roomId;
    extensionUserName = msg.name || "Playwise User";
    extensionUserAvatar = msg.avatar || "🤖";

    // Generate a stable userId once, persist it
    if (!extensionUserId) {
      extensionUserId = `ext_${Math.random().toString(36).substr(2, 9)}`;
    }
    retryDelay = 3000;

    chrome.storage.local.set({
      currentRoomId: msg.roomId,
      userName: extensionUserName,
      userId: extensionUserId,
      userAvatar: extensionUserAvatar
    });

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "join",
        roomId: msg.roomId,
        userId: extensionUserId,
        name: extensionUserName,
        avatarUrl: extensionUserAvatar
      }));
      broadcastToAllTabs({ type: "PW_CONNECTED", roomId: currentRoomId, avatar: extensionUserAvatar });
    } else {
      connect();
    }
    sendResponse({ ok: true });

  } else if (msg.type === "LEAVE_ROOM") {
    currentRoomId = null;
    extensionUserId = null; // Reset so fresh ID on next join
    if (retryTimeout) { clearTimeout(retryTimeout); retryTimeout = null; }
    socket?.close();
    socket = null;
    chrome.storage.local.remove(["currentRoomId", "userId"]);
    broadcastToAllTabs({ type: "PW_DISCONNECTED" });
    sendResponse({ ok: true });

  } else if (msg.type === "SYNC_STATE") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "sync", state: msg.state }));
    }

  } else if (msg.type === "SEND_CHAT") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "chat", message: msg.message }));
    }

  } else if (msg.type === "SEND_REACTION") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "reaction", emoji: msg.emoji }));
    }

  } else if (msg.type === "GET_STATE") {
    sendResponse({
      roomId: currentRoomId,
      userId: extensionUserId,
      userName: extensionUserName,
      userAvatar: extensionUserAvatar,
      connected: socket?.readyState === WebSocket.OPEN
    });
  }

  return true; // keep message channel open for async sendResponse
});
