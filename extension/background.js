"use strict";
/**
 * Playwise Background Service Worker v2.0
 * Manages WebSocket connection, room state, and relays messages between
 * the popup, content scripts, and the Playwise server.
 */
const WS_URL = "wss://playwise-4.onrender.com";
let socket = null;
let currentRoomId = null;
let extensionUserId = null;
let extensionUserName = "Extension User";
let retryTimeout = null;
let retryDelay = 3000;
const MAX_RETRY_DELAY = 30000;
// --- WebSocket Connection Management ---
function connect() {
    if (!currentRoomId)
        return;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING))
        return;
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
                name: extensionUserName
            }));
        }
        broadcastToContentScript({ type: "PW_CONNECTED", roomId: currentRoomId });
    };
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === "sync") {
                broadcastToContentScript({ type: "UPDATE_VIDEO", state: data.payload });
            }
            else if (data.type === "room-state") {
                // Full room state broadcast to content script for UI updates
                broadcastToContentScript({ type: "ROOM_STATE", payload: data.payload });
            }
            else if (data.type === "chat") {
                broadcastToContentScript({ type: "PW_CHAT", payload: data.payload });
            }
            else if (data.type === "reaction") {
                broadcastToContentScript({ type: "PW_REACTION", payload: data.payload });
            }
            else if (data.type === "user-joined" || data.type === "user-left") {
                broadcastToContentScript({ type: "ROOM_STATE_UPDATE", payload: data });
            }
        }
        catch (e) {
            console.error("[Playwise BG] Failed to parse message", e);
        }
    };
    socket.onclose = () => {
        console.log(`[Playwise BG] Disconnected. Retrying in ${retryDelay / 1000}s...`);
        broadcastToContentScript({ type: "PW_DISCONNECTED" });
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
function broadcastToContentScript(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {
                // Tab may not have content script, ignore silently
            });
        }
    });
}
// --- Message Handler ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "JOIN_ROOM") {
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }
        currentRoomId = msg.roomId;
        extensionUserName = msg.name || "Playwise User";
        if (!extensionUserId) {
            extensionUserId = `ext_${Math.random().toString(36).substr(2, 9)}`;
        }
        retryDelay = 3000;
        chrome.storage.local.set({ currentRoomId: msg.roomId, userName: extensionUserName, userId: extensionUserId });
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "join", roomId: msg.roomId, userId: extensionUserId, name: extensionUserName }));
            broadcastToContentScript({ type: "PW_CONNECTED", roomId: currentRoomId });
        }
        else {
            connect();
        }
        sendResponse({ ok: true });
    }
    else if (msg.type === "LEAVE_ROOM") {
        currentRoomId = null;
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }
        socket?.close();
        socket = null;
        chrome.storage.local.remove(["currentRoomId"]);
        broadcastToContentScript({ type: "PW_DISCONNECTED" });
        sendResponse({ ok: true });
    }
    else if (msg.type === "SYNC_STATE") {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "sync", state: msg.state }));
        }
    }
    else if (msg.type === "SEND_CHAT") {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "chat", message: msg.message }));
        }
    }
    else if (msg.type === "SEND_REACTION") {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "reaction", emoji: msg.emoji }));
        }
    }
    else if (msg.type === "GET_STATE") {
        sendResponse({
            roomId: currentRoomId,
            userId: extensionUserId,
            userName: extensionUserName,
            connected: socket?.readyState === WebSocket.OPEN
        });
    }
    return true; // keep message channel open for async sendResponse
});
