/**
 * Eventos Socket.io para alertas em tempo real (overlay/dashboard).
 */

import type { Server, Socket } from "socket.io";
import { logger } from "../utils/logger.js";
import { verifyOverlayToken } from "./overlayAuth.js";

let io: Server | null = null;

function alertsRoom(channelSlug: string): string {
  return `alerts:${channelSlug}`;
}

export function initAlertEvents(server: Server): void {
  io = server;

  io.on("connection", (socket: Socket) => {
    socket.on("join:alerts", (data: { channelSlug?: string; token?: string }) => {
      const token = data?.token?.trim();
      const tokenPayload = token ? verifyOverlayToken(token) : null;
      const channelSlug = tokenPayload?.channelSlug ?? data?.channelSlug?.trim();
      if (!channelSlug) return;
      const room = alertsRoom(channelSlug);
      socket.join(room);
      logger.info(`[ALERTS] ${socket.id} entrou em ${room}`);
    });
  });
}

export interface LiveAlertPayload {
  type: string;
  channelSlug: string;
  title: string;
  message: string;
  imageUrl?: string | null;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface GiveawayDrawEventPayload {
  channelSlug: string;
  giveawayId: string;
  prize: string;
  winner: { kickUserId: number; username: string } | null;
  participants: Array<{ username: string; weight: number }>;
  entries: number;
  tickets: number;
  widgetOptions?: {
    animationDurationMs: number;
    confettiEnabled: boolean;
    soundEnabled: boolean;
    showTopParticipants: boolean;
    topParticipantsLimit: number;
  };
  timestamp?: number;
  source?: "draw" | "reroll";
}

export interface PollLiveResultOption {
  option: number;
  text: string;
  score: number;
  percentage: number;
}

export interface PollUpdateEventPayload {
  channelSlug: string;
  pollId: string;
  question: string;
  options: string[];
  status: "open" | "closed";
  totalVotes: number;
  weightedSubs: boolean;
  results: PollLiveResultOption[];
  winnerOption: number | null;
  winnerText: string | null;
  closesAt?: string | null;
  closedAt?: string | null;
  source?: "created" | "vote" | "closed";
  timestamp?: number;
}

export function broadcastAlert(payload: LiveAlertPayload): void {
  if (!io) return;
  io.to(alertsRoom(payload.channelSlug)).emit("alert:event", {
    ...payload,
    timestamp: Date.now(),
  });
}

export function broadcastGiveawayDraw(payload: GiveawayDrawEventPayload): void {
  if (!io) return;
  io.to(alertsRoom(payload.channelSlug)).emit("giveaway:draw", {
    ...payload,
    source: payload.source ?? "draw",
    timestamp: payload.timestamp ?? Date.now(),
  });
}

export function broadcastPollUpdate(payload: PollUpdateEventPayload): void {
  if (!io) return;
  io.to(alertsRoom(payload.channelSlug)).emit("poll:update", {
    ...payload,
    source: payload.source ?? "vote",
    timestamp: payload.timestamp ?? Date.now(),
  });
}
