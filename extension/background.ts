const WS_URL = "wss://playwise-4.onrender.com";
let socket: WebSocket | null = null;
let currentRoomId: string | null = null;
let extensionUserId: string | null = null;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 3000;
const MAX_RETRY_DELAY = 30000;

function connect() {
  // Don't connect if not in a room
  if (!currentRoomId) return;

  // Don't create a new socket if one already exists and is open/connecting
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log("[Playwise] Connecting to server...");
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log("[Playwise] Connected to server");
    retryDelay = 3000; // reset backoff on successful connection
    if (currentRoomId && extensionUserId && socket) {
      socket.send(JSON.stringify({
        type: "join",
        roomId: currentRoomId,
        userId: extensionUserId,
        name: "Extension User"
      }));
    }
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "sync") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "UPDATE_VIDEO", state: data.payload });
          }
        });
      }
    } catch (e) {
      console.error("[Playwise] Failed to parse message", e);
    }
  };

  socket.onclose = () => {
    console.log(`[Playwise] Disconnected. Retrying in ${retryDelay / 1000}s...`);
    // Only retry if we are still in a room
    if (currentRoomId) {
      retryTimeout = setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY); // exponential backoff
        connect();
      }, retryDelay);
    }
  };

  socket.onerror = () => {
    // onclose will handle the retry; suppress the error log to avoid console spam
    socket?.close();
  };
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "JOIN_ROOM") {
    // Clear any pending retry
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }

    currentRoomId = msg.roomId;
    // Generate a stable ID per session
    if (!extensionUserId) {
      extensionUserId = `ext_${Math.random().toString(36).substr(2, 9)}`;
    }

    retryDelay = 3000; // reset backoff

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "join",
        roomId: msg.roomId,
        userId: extensionUserId,
        name: "Extension User"
      }));
    } else {
      connect();
    }
  } else if (msg.type === "LEAVE_ROOM") {
    currentRoomId = null;
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    socket?.close();
    socket = null;
  } else if (msg.type === "SYNC_STATE") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "sync", state: msg.state }));
    }
  }
});

// Do NOT auto-connect on startup — only connect when user joins a room
