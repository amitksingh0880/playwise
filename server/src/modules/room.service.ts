import { Room, User, VideoState } from "../types";
import { nanoid } from "nanoid";

class RoomService {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostId: string, hostName: string): Room {
    const roomId = nanoid(10);
    const host: User = { id: hostId, name: hostName, roomId };
    const room: Room = {
      id: roomId,
      hostId,
      users: [host],
      videoState: {
        sourceType: "youtube",
        currentTime: 0,
        isPlaying: false,
        lastUpdated: Date.now(),
      },
    };
    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, userId: string, userName: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const existingUser = room.users.find((u) => u.id === userId);
    if (!existingUser) {
      room.users.push({ id: userId, name: userName, roomId });
    }
    return room;
  }

  leaveRoom(roomId: string, userId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.users = room.users.filter((u) => u.id !== userId);
    
    if (room.users.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    if (room.hostId === userId) {
      room.hostId = room.users[0].id;
    }

    return room;
  }

  updateVideoState(roomId: string, state: Partial<VideoState>): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.videoState = {
      ...room.videoState,
      ...state,
      lastUpdated: Date.now(),
    };
    return room;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }
}

export const roomService = new RoomService();
