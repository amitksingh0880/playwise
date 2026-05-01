import { WebSocketServer, WebSocket } from "ws";
import { roomService } from "../modules/room.service";
import { WSEvent, User } from "../types";
import { Server } from "http";

interface ExtendedWebSocket extends WebSocket {
  userId: string;
  roomId?: string;
  name?: string;
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
        
        // Kick any existing WS connections for the same userId to prevent duplicates
        wss.clients.forEach((client: any) => {
          if (client !== ws && client.userId === userId) {
            console.log(`Closing stale connection for userId: ${userId}`);
            if (client.roomId) {
              roomService.leaveRoom(client.roomId, client.userId);
            }
            client.terminate();
          }
        });

        // If this socket was already in a room, leave it first
        if (ws.roomId && ws.userId) {
          roomService.leaveRoom(ws.roomId, ws.userId);
        }

        ws.userId = userId || ws.userId || `user_${Math.random().toString(36).substr(2, 9)}`;
        ws.roomId = roomId;
        ws.name = name;

        let room = roomService.getRoom(roomId);
        if (!room) {
          // Create room WITH the requested roomId so others can join using the same code
          room = roomService.createRoom(ws.userId, name, roomId);
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
        const room = roomService.getRoom(ws.roomId);
        // If locked, only host can sync
        if (room?.isLocked && room.hostId !== ws.userId) {
          console.log("Blocked non-host sync in locked room");
          return;
        }
        
        const updatedRoom = roomService.updateVideoState(ws.roomId, event.state);
        if (updatedRoom) {
          broadcastToRoom(ws.roomId, {
            type: "sync",
            payload: updatedRoom.videoState,
          }, ws.userId);
        }
        break;
      }

      case "toggle-lock": {
        if (!ws.roomId) return;
        const room = roomService.toggleLock(ws.roomId, ws.userId);
        if (room) {
          broadcastToRoom(ws.roomId, {
            type: "room-state",
            payload: room,
          });
        }
        break;
      }

      case "chat": {
        if (!ws.roomId) return;
        const chatPayload = {
          type: "chat",
          payload: { userId: ws.userId, userName: ws.name || "Guest", message: event.message },
        };
        // Broadcast to others
        broadcastToRoom(ws.roomId, chatPayload, ws.userId);
        // Echo back to sender so they see their own message
        ws.send(JSON.stringify(chatPayload));
        break;
      }

      case "reaction": {
        if (!ws.roomId) return;
        broadcastToRoom(ws.roomId, {
          type: "reaction",
          payload: { userId: ws.userId, emoji: event.emoji },
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
