import { create } from 'zustand';

export type SourceType = "youtube" | "local" | "url" | "ott";

export interface VideoState {
  sourceType: SourceType;
  sourceUrl?: string;
  currentTime: number;
  isPlaying: boolean;
  lastUpdated: number;
}

export interface User {
  id: string;
  name: string;
}

export interface RoomState {
  roomId: string | null;
  hostId: string | null;
  users: User[];
  videoState: VideoState;
  userId: string | null;
  userName: string | null;
  
  setRoom: (room: any) => void;
  updateVideoState: (state: Partial<VideoState>) => void;
  setUser: (id: string, name: string) => void;
  resetRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  hostId: null,
  users: [],
  videoState: {
    sourceType: "youtube",
    currentTime: 0,
    isPlaying: false,
    lastUpdated: Date.now(),
  },
  userId: localStorage.getItem('playwise_userId') || `user_${Math.random().toString(36).substr(2, 9)}`,
  userName: localStorage.getItem('playwise_userName') || 'Guest',

  setRoom: (room) => {
    // Deduplicate: first by ID, then by name (in case two sockets sent same user)
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueUsers = (room.users as User[]).filter((u) => {
      if (seenIds.has(u.id) || seenNames.has(u.name.toLowerCase())) return false;
      seenIds.add(u.id);
      seenNames.add(u.name.toLowerCase());
      return true;
    });

    set({
      roomId: room.id,
      hostId: room.hostId,
      users: uniqueUsers,
      videoState: room.videoState,
    });
  },

  updateVideoState: (state) => set((prev) => ({
    videoState: { ...prev.videoState, ...state, lastUpdated: Date.now() },
  })),

  setUser: (id, name) => {
    localStorage.setItem('playwise_userId', id);
    localStorage.setItem('playwise_userName', name);
    set({ userId: id, userName: name });
  },

  resetRoom: () => set({
    roomId: null,
    hostId: null,
    users: [],
  }),
}));
