/**
 * Rotas de autenticação.
 */

import { Router } from "express";
import { verifyPassword, generateToken } from "../auth.js";
import type { ApiResponse } from "../types.js";
import { logger } from "../../utils/logger.js";

export function createAuthRouter(): Router {
  const router = Router();

  router.post("/login", async (req, res) => {
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ success: false, error: "Senha não fornecida" });
      return;
    }

    try {
      const isValid = await verifyPassword(password);

      if (!isValid) {
        logger.warn("[API] Tentativa de login falhou");
        res.status(401).json({ success: false, error: "Senha incorreta" });
        return;
      }

      const token = generateToken({ userId: "admin", role: "admin" });

      const response: ApiResponse<{ token: string }> = {
        success: true,
        data: { token },
        message: "Login realizado com sucesso",
      };

      logger.info("[API] Login realizado com sucesso");
      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro no login";
      logger.error("[API] Erro no login", error);
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
