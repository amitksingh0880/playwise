import { WebSocketServer, WebSocket } from "ws";
import { roomService } from "../modules/room.service";
import { WSEvent, User } from "../types";
import { Server } from "http";

interface ExtendedWebSocket extends WebSocket {
  userId: string;
  roomId?: string;
}

export function setupWS(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: ExtendedWebSocket) => {
    console.log("New client connected");

    ws.on("message", (data) => {
      try {
        const event: WSEvent = JSON.parse(data.toString());
        handleEvent(ws, event);
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    });

    ws.on("close", () => {
      if (ws.roomId && ws.userId) {
        const room = roomService.leaveRoom(ws.roomId, ws.userId);
        if (room) {
          broadcastToRoom(ws.roomId, {
            type: "user-left",
            payload: { userId: ws.userId, room },
          });
        }
      }
    });
  });

  function handleEvent(ws: ExtendedWebSocket, event: WSEvent) {
    switch (event.type) {
      case "join": {
        const { roomId, name, userId } = event;
        ws.userId = userId || ws.userId || `user_${Math.random().toString(36).substr(2, 9)}`;
        ws.roomId = roomId;

        let room = roomService.getRoom(roomId);
        if (!room) {
          room = roomService.createRoom(ws.userId, name);
        } else {
          roomService.joinRoom(roomId, ws.userId, name);
        }

        ws.roomId = room.id;
        
        // Notify user about current state
        ws.send(JSON.stringify({ type: "room-state", payload: room }));

        // Notify others in room
        broadcastToRoom(room.id, {
          type: "user-joined",
          payload: { userId: ws.userId, name, room },
        }, ws.userId);
        break;
      }

      case "sync": {
        if (!ws.roomId) return;
        const room = roomService.updateVideoState(ws.roomId, event.state);
        if (room) {
          broadcastToRoom(ws.roomId, {
            type: "sync",
            payload: room.videoState,
          }, ws.userId);
        }
        break;
      }

      case "chat": {
        if (!ws.roomId) return;
        broadcastToRoom(ws.roomId, {
          type: "chat",
          payload: { userId: ws.userId, message: event.message },
        });
        break;
      }

      case "webrtc-offer":
      case "webrtc-answer":
      case "webrtc-ice": {
        if (!ws.roomId) return;
        sendToUser(event.targetId, {
          type: event.type,
          payload: { from: ws.userId, ...event },
        });
        break;
      }
    }
  }

  function broadcastToRoom(roomId: string, data: any, excludeUserId?: string) {
    wss.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN && client.roomId === roomId) {
        if (!excludeUserId || client.userId !== excludeUserId) {
          client.send(JSON.stringify(data));
        }
      }
    });
  }

  function sendToUser(userId: string, data: any) {
    wss.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN && client.userId === userId) {
        client.send(JSON.stringify(data));
      }
    });
  }
}
