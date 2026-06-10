/**
 * Tipos relacionados ao chat da Kick via Pusher WebSocket e API REST.
 * Define estruturas de mensagens e eventos emitidos pelo listener.
 */

export interface ChatSenderIdentity {
  color: string;
  badges: Array<{ type: string; text: string }>;
}

export interface ChatSender {
  id: number;
  username: string;
  slug: string;
  identity: ChatSenderIdentity;
}

export interface ChatMessage {
  id: string;
  content: string;
  chatroom_id: number;
  created_at: string;
  sender: ChatSender;
}

export interface KickEvent {
  event: string;
  data: string;
  channel?: string;
}

export interface PusherConnectionData {
  socket_id: string;
  activity_timeout?: number;
}

export interface ChannelResponse {
  chatroom: {
    id: number;
  };
}
