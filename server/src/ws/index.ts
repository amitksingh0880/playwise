import { WebSocketServer, WebSocket } from "ws";
import { roomService } from "../modules/room.service";
import type { WSEvent, User } from "../types";
import { Server } from "http";

interface ExtendedWebSocket extends WebSocket {
  userId: string;
  roomId?: string;
  name?: string;
  color?: string;
}

export function setupWS(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: ExtendedWebSocket) => {
    console.log("New client connected");

    ws.on("message", async (data) => {
      try {
        const event: WSEvent = JSON.parse(data.toString());
        await handleEvent(ws, event);
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

  async function handleEvent(ws: ExtendedWebSocket, event: WSEvent) {
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
        ws.color = event.color;
        (ws as any).avatarUrl = (event as any).avatarUrl;

        try {
          let room = roomService.getRoom(roomId);
          if (!room) {
            room = roomService.createRoom(ws.userId, name, roomId, event.password, event.color, (event as any).avatarUrl);
          } else {
            room = roomService.joinRoom(roomId, ws.userId, name, event.password, event.color, (event as any).avatarUrl);
          }

          if (!room) {
             ws.send(JSON.stringify({ type: "error", payload: { message: "Room not found" } }));
             return;
          }

          ws.roomId = room.id;
          
          // Notify user about current state
          ws.send(JSON.stringify({ type: "room-state", payload: room }));

          // Notify others in room
          broadcastToRoom(room.id, {
            type: "user-joined",
            payload: { userId: ws.userId, name, room },
          }, ws.userId);
        } catch (err: any) {
          ws.send(JSON.stringify({ type: "error", payload: { message: err.message } }));
          return;
        }
        break;
      }

      case "sync": {
        if (!ws.roomId) return;
        const room = roomService.getRoom(ws.roomId);
        // Only host/mods can sync if locked
        const user = room?.users.find((u: any) => u.id === ws.userId);
        if (room?.isLocked && room.hostId !== ws.userId && user?.role !== "mod") {
          console.log("Blocked non-host/non-mod sync in locked room");
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
          payload: { 
            userId: ws.userId, 
            userName: ws.name || "Guest", 
            userColor: ws.color,
            message: event.message 
          },
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

      case "create-poll": {
        if (!ws.roomId) return;
        const room = roomService.createPoll(ws.roomId, event.question, event.options);
        if (room) {
          broadcastToRoom(ws.roomId, {
            type: "room-state",
            payload: room,
          });
        }
        break;
      }

      case "vote-poll": {
        if (!ws.roomId) return;
        const room = roomService.votePoll(ws.roomId, event.pollId, event.optionIndex, ws.userId);
        if (room) {
          broadcastToRoom(ws.roomId, {
            type: "room-state",
            payload: room,
          });
        }
        break;
      }

      case "update-role": {
        if (!ws.roomId) return;
        const room = roomService.getRoom(ws.roomId);
        if (room?.hostId !== ws.userId) return; // Only host can change roles

        const updatedRoom = roomService.updateRole(ws.roomId, (event as any).targetId, (event as any).role);
        if (updatedRoom) {
          broadcastToRoom(ws.roomId, {
            type: "room-state",
            payload: updatedRoom,
          });
        }
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
