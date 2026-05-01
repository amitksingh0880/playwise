import { create } from 'zustand';

export type SourceType = "youtube" | "local" | "url" | "ott";

export interface VideoState {
  sourceType: SourceType;
  sourceUrl?: string;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  lastUpdated: number;
}

export interface User {
  id: string;
  name: string;
  color?: string;
  role: "host" | "mod" | "user";
  avatarUrl?: string;
}

export interface Poll {
  id: string;
  question: string;
  options: { text: string; votes: number }[];
  totalVotes: number;
  voters: string[];
}

export interface RoomState {
  roomId: string | null;
  hostId: string | null;
  users: User[];
  videoState: VideoState;
  polls: Poll[];
  userId: string | null;
  userName: string | null;
  userColor: string | null;
  userAvatar: string | null;
  isLocked: boolean;
  isJoined: boolean;
  
  setRoom: (room: any) => void;
  updateVideoState: (state: Partial<VideoState>) => void;
  setUser: (id: string, name: string, color?: string, avatar?: string) => void;
  resetRoom: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  roomId: null,
  hostId: null,
  users: [],
  polls: [],
  isLocked: false,
  isJoined: false,
  videoState: {
    sourceType: "youtube",
    currentTime: 0,
    isPlaying: false,
    playbackRate: 1.0,
    lastUpdated: Date.now(),
  },
  userId: localStorage.getItem('playwise_userId') || `user_${Math.random().toString(36).substr(2, 9)}`,
  userName: localStorage.getItem('playwise_userName') || 'Guest',
  userColor: localStorage.getItem('playwise_userColor') || `#${Math.floor(Math.random()*16777215).toString(16)}`,
  userAvatar: localStorage.getItem('playwise_userAvatar') || null,

  setRoom: (room) => {
    // Deduplicate: first by ID, then by name (in case two sockets sent same user)
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueUsers = (room.users as any[]).filter((u) => {
      if (seenIds.has(u.id) || seenNames.has(u.name.toLowerCase())) return false;
      seenIds.add(u.id);
      seenNames.add(u.name.toLowerCase());
      return true;
    });

    set({
      roomId: room.id,
      hostId: room.hostId,
      users: uniqueUsers,
      isLocked: room.isLocked || false,
      videoState: room.videoState,
      polls: room.polls || [],
      isJoined: true,
    });
  },

  updateVideoState: (state) => set((prev) => ({
    videoState: { ...prev.videoState, ...state, lastUpdated: Date.now() },
  })),

  setUser: (id, name, color, avatar) => {
    localStorage.setItem('playwise_userId', id);
    localStorage.setItem('playwise_userName', name);
    if (color) localStorage.setItem('playwise_userColor', color);
    if (avatar) localStorage.setItem('playwise_userAvatar', avatar);
    set({ 
      userId: id, 
      userName: name, 
      userColor: color || get().userColor,
      userAvatar: avatar || get().userAvatar 
    });
  },

  resetRoom: () => set({
    roomId: null,
    hostId: null,
    users: [],
    isJoined: false,
  }),
}));
