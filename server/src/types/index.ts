export type SourceType = "youtube" | "local" | "url" | "ott";

export interface VideoState {
  sourceType: SourceType;
  sourceUrl?: string;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  lastUpdated: number;
}

export type UserRole = "host" | "mod" | "user";

export interface User {
  id: string;
  name: string;
  color?: string;
  role: UserRole;
  avatarUrl?: string;
  roomId?: string;
}

export interface Poll {
  id: string;
  question: string;
  options: { text: string; votes: number }[];
  totalVotes: number;
  voters: string[]; // userIds
}

export interface Room {
  id: string;
  hostId: string;
  users: User[];
  videoState: VideoState;
  isLocked: boolean;
  password?: string;
  polls: Poll[];
}

export type WSEvent =
  | { type: "join"; roomId: string; name: string; color?: string; password?: string; userId?: string }
  | { type: "leave" }
  | { type: "sync"; state: Partial<VideoState> }
  | { type: "chat"; message: string }
  | { type: "reaction"; emoji: string }
  | { type: "toggle-lock" }
  | { type: "create-poll"; question: string; options: string[] }
  | { type: "vote-poll"; pollId: string; optionIndex: number }
  | { type: "update-role"; targetId: string; role: "mod" | "user" }
  | { type: "webrtc-offer"; targetId: string; offer: any }
  | { type: "webrtc-answer"; targetId: string; answer: any }
  | { type: "webrtc-ice"; targetId: string; candidate: any };

export interface ServerToClientEvent {
  type: string;
  payload: any;
}
