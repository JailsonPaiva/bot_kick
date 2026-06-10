/**
 * Busca informações do usuário autenticado via API da Kick.
 * Retorna broadcaster_user_id da conta que fez OAuth.
 */

import axios from "axios";
import { getValidToken } from "./authManager.js";
import { logger } from "../utils/logger.js";

const USERS_API_URL = "https://api.kick.com/public/v1/users";

interface UserInfo {
  user_id: number;
  name: string;
}

interface UsersResponse {
  data: UserInfo[];
  message: string;
}

let cachedUserId: number | null = null;

export async function getAuthenticatedBroadcasterId(): Promise<number> {
  if (cachedUserId !== null) {
    return cachedUserId;
  }

  const token = await getValidToken();

  try {
    const response = await axios.get<UsersResponse>(USERS_API_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const users = response.data.data;
    if (!users || users.length === 0) {
      throw new Error("Nenhum usuário retornado pela API");
    }

    const user = users[0];
    const userId = user.user_id;
    const username = user.name;

    logger.info(`User ID do usuário autenticado (${username}): ${userId}`);
    
    cachedUserId = userId;
    return userId;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;

      throw new Error(
        `Falha ao buscar informações do usuário autenticado (HTTP ${status ?? "?"}): ${detail}`
      );
    }
    throw error;
  }
}
