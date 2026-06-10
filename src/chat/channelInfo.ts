/**
 * Busca informações do canal via API oficial da Kick.
 * Retorna broadcaster_user_id necessário para envio de mensagens.
 */

import axios from "axios";
import { getValidToken } from "../auth/authManager.js";
import { logger } from "../utils/logger.js";

const CHANNELS_API_URL = "https://api.kick.com/public/v1/channels";

interface ChannelInfo {
  broadcaster_user_id: number;
  slug: string;
}

export async function fetchBroadcasterUserId(channelSlug: string): Promise<number> {
  const token = await getValidToken();
  
  try {
    const response = await axios.get<{ data: ChannelInfo[] }>(
      `${CHANNELS_API_URL}?slug=${encodeURIComponent(channelSlug)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const channels = response.data.data;
    if (!channels || channels.length === 0) {
      throw new Error(`Canal "${channelSlug}" não encontrado na API oficial`);
    }

    const broadcasterId = channels[0].broadcaster_user_id;
    logger.info(`Broadcaster User ID do canal "${channelSlug}": ${broadcasterId}`);
    return broadcasterId;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;

      throw new Error(
        `Falha ao buscar broadcaster_user_id do canal "${channelSlug}" (HTTP ${status ?? "?"}): ${detail}`
      );
    }
    throw error;
  }
}
