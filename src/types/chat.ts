
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isStreaming?: boolean;
}

export interface WebSocketMessage {
  type: 'USER_MESSAGE' | 'STREAM_START' | 'STREAM_CHUNK' | 'STREAM_END' | 'ERROR';
  content: {
    type: string;
    content: string;
  };
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface GitHubLink {
  id: string;
  url: string;
}
