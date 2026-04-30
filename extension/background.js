"use strict";
(() => {
  // background.ts
  var WS_URL = "wss://playwise-4.onrender.com";
  var socket = null;
  var currentRoomId = null;
  var extensionUserId = null;
  var retryTimeout = null;
  var retryDelay = 3e3;
  var MAX_RETRY_DELAY = 3e4;
  function connect() {
    if (!currentRoomId) return;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    console.log("[Playwise] Connecting to server...");
    socket = new WebSocket(WS_URL);
    socket.onopen = () => {
      console.log("[Playwise] Connected to server");
      retryDelay = 3e3;
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
      console.log(`[Playwise] Disconnected. Retrying in ${retryDelay / 1e3}s...`);
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
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "JOIN_ROOM") {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      currentRoomId = msg.roomId;
      if (!extensionUserId) {
        extensionUserId = `ext_${Math.random().toString(36).substr(2, 9)}`;
      }
      retryDelay = 3e3;
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
})();
