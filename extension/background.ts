const WS_URL = "wss://playwise-4.onrender.com";
let socket: WebSocket | null = null;
let currentRoomId: string | null = null;

function connect() {
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log("Extension connected to server");
    if (currentRoomId && socket) {
      socket.send(JSON.stringify({ type: "join", roomId: currentRoomId, name: "Extension User" }));
    }
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "sync") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "UPDATE_VIDEO", state: data.payload });
        }
      });
    }
  };

  socket.onclose = () => {
    setTimeout(connect, 3000);
  };
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "JOIN_ROOM") {
    currentRoomId = msg.roomId;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "join", roomId: msg.roomId, name: "Extension User" }));
    } else {
      connect();
    }
  } else if (msg.type === "SYNC_STATE") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "sync", state: msg.state }));
    }
  }
});

connect();
