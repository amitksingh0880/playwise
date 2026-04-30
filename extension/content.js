"use strict";
(() => {
  // content.ts
  console.log("Playwise Content Script Loaded");
  var videoElement = null;
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
    const joinBtn = document.getElementById("pw-join");
    if (joinBtn) {
      joinBtn.onclick = () => {
        const roomId = prompt("Enter Room ID:");
        if (roomId) {
          try {
            chrome.runtime.sendMessage({ type: "JOIN_ROOM", roomId });
          } catch (e) {
            alert("Extension updated. Please refresh the page to continue.");
          }
        }
      };
    }
  }
  setInterval(() => {
    const video = findVideo();
    if (video && video !== videoElement) {
      videoElement = video;
      setupListeners(video);
    }
  }, 2e3);
  function setupListeners(video) {
    video.onplay = () => syncState();
    video.onpause = () => syncState();
    video.onseeked = () => syncState();
  }
  function syncState() {
    if (!videoElement) return;
    if (!chrome.runtime?.id) {
      console.log("[Playwise] Context invalidated. Please refresh the page.");
      return;
    }
    try {
      chrome.runtime.sendMessage({
        type: "SYNC_STATE",
        state: {
          currentTime: videoElement.currentTime,
          isPlaying: !videoElement.paused,
          timestamp: Date.now()
        }
      });
    } catch (e) {
      console.debug("[Playwise] Failed to send sync state (likely context invalidated)");
    }
  }
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "UPDATE_VIDEO") {
      if (!videoElement) return;
      const { currentTime, isPlaying } = msg.state;
      const drift = Math.abs(videoElement.currentTime - currentTime);
      if (drift > 1.5) {
        videoElement.currentTime = currentTime;
      }
      if (isPlaying && videoElement.paused) {
        videoElement.play().catch(() => {
        });
      } else if (!isPlaying && !videoElement.paused) {
        videoElement.pause();
      }
    }
  });
  injectOverlay();
})();
