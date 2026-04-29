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
  roomId?: string;
}

export interface Room {
  id: string;
  hostId: string;
  users: User[];
  videoState: VideoState;
}

export type WSEvent =
  | { type: "join"; roomId: string; name: string }
  | { type: "leave" }
  | { type: "sync"; state: Partial<VideoState> }
  | { type: "chat"; message: string }
  | { type: "webrtc-offer"; targetId: string; offer: any }
  | { type: "webrtc-answer"; targetId: string; answer: any }
  | { type: "webrtc-ice"; targetId: string; candidate: any };

export interface ServerToClientEvent {
  type: string;
  payload: any;
}
