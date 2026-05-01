import type { Room, User, VideoState, Poll } from "../types";

class RoomService {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostId: string, hostName: string, roomId?: string, password?: string, color?: string, avatarUrl?: string): Room {
    const id = roomId || Math.random().toString(36).substr(2, 6).toUpperCase();
    const host: User = { id: hostId, name: hostName, color, role: "host", avatarUrl, roomId: id };
    const room: Room = {
      id,
      hostId,
      users: [host],
      isLocked: false,
      password,
      videoState: {
        sourceType: "youtube",
        currentTime: 0,
        isPlaying: false,
        playbackRate: 1.0,
        lastUpdated: Date.now(),
      },
      polls: [],
    };
    this.rooms.set(id, room);
    return room;
  }

  joinRoom(roomId: string, userId: string, userName: string, password?: string, color?: string, avatarUrl?: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    if (room.password && room.password !== password) {
      throw new Error("Invalid password");
    }

    const existingUser = room.users.find((u) => u.id === userId);
    if (!existingUser) {
      room.users.push({ id: userId, name: userName, color, role: "user", avatarUrl, roomId });
    } else {
      existingUser.name = userName;
      existingUser.color = color;
      existingUser.avatarUrl = avatarUrl;
    }
    return room;
  }

  updateRole(roomId: string, targetId: string, role: "mod" | "user"): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const user = room.users.find(u => u.id === targetId);
    if (user && user.role !== "host") {
      user.role = role;
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
      room.hostId = room.users[0]!.id;
    }

    return room;
  }

  updateVideoState(roomId: string, state: Partial<VideoState>): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.videoState = {
      ...room.videoState,
      ...(state as any),
      lastUpdated: Date.now(),
    };
    return room;
  }

  toggleLock(roomId: string, userId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.hostId !== userId) return null;
    room.isLocked = !room.isLocked;
    return room;
  }

  createPoll(roomId: string, question: string, options: string[]): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const poll: Poll = {
      id: Math.random().toString(36).substr(2, 9),
      question,
      options: options.map(text => ({ text, votes: 0 })),
      totalVotes: 0,
      voters: [],
    };

    room.polls.push(poll);
    return room;
  }

  votePoll(roomId: string, pollId: string, optionIndex: number, userId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const poll = room.polls.find(p => p.id === pollId);
    if (!poll || poll.voters.includes(userId)) return null;

    if (optionIndex >= 0 && poll.options && optionIndex < poll.options.length) {
      const option = poll.options[optionIndex];
      if (option) {
        option.votes++;
        poll.totalVotes++;
        poll.voters.push(userId);
      }
    }

    return room;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }
}

export const roomService = new RoomService();
