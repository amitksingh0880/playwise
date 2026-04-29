console.log("Playwise Content Script Loaded");

let videoElement = null;
let lastState = { currentTime: 0, isPlaying: false };

function findVideo() {
  return document.querySelector("video");
}

function injectOverlay() {
  const div = document.createElement("div");
  div.id = "playwise-overlay";
  div.innerHTML = `
    <div class="playwise-card">
      <h3>Playwise</h3>
      <div id="pw-status">Disconnected</div>
      <button id="pw-join">Join Room</button>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById("pw-join").onclick = () => {
    const roomId = prompt("Enter Room ID:");
    if (roomId) {
      chrome.runtime.sendMessage({ type: "JOIN_ROOM", roomId });
    }
  };
}

setInterval(() => {
  const video = findVideo();
  if (video && video !== videoElement) {
    videoElement = video;
    setupListeners(video);
  }
}, 2000);

function setupListeners(video) {
  video.onplay = () => syncState();
  video.onpause = () => syncState();
  video.onseeked = () => syncState();
}

function syncState() {
  if (!videoElement) return;
  chrome.runtime.sendMessage({
    type: "SYNC_STATE",
    state: {
      currentTime: videoElement.currentTime,
      isPlaying: !videoElement.paused,
      timestamp: Date.now()
    }
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "UPDATE_VIDEO") {
    if (!videoElement) return;
    const { currentTime, isPlaying } = msg.state;
    const drift = Math.abs(videoElement.currentTime - currentTime);
    if (drift > 1.5) {
      videoElement.currentTime = currentTime;
    }
    if (isPlaying && videoElement.paused) videoElement.play();
    else if (!isPlaying && !videoElement.paused) videoElement.pause();
  }
});

injectOverlay();
