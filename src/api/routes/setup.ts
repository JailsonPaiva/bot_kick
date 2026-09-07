/**
 * Rotas de setup inicial - criar primeiro admin.
 */

import { Router } from "express";
import { logger } from "../../utils/logger.js";
import {
  createAdminUser,
  countActiveAdmins,
} from "../../db/repositories/adminUserRepository.js";
import type { ApiResponse } from "../types.js";

export function createSetupRouter(): Router {
  const router = Router();

  /**
   * Endpoint para criar o primeiro administrador.
   * Só funciona se não existir nenhum admin no sistema.
   * 
   * POST /api/setup/first-admin
   * Body: { email, username, password }
   */
  router.post("/first-admin", async (req, res) => {
    try {
      // Verificar se já existe algum admin
      const adminCount = await countActiveAdmins();
      
      if (adminCount > 0) {
        res.status(403).json({ 
          success: false, 
          error: "Já existe pelo menos um administrador no sistema" 
        });
        return;
      }

      const { email, username, password } = req.body;

      if (!email || !username || !password) {
        res.status(400).json({ 
          success: false, 
          error: "Email, username e password são obrigatórios" 
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ 
          success: false, 
          error: "Senha deve ter pelo menos 6 caracteres" 
        });
        return;
      }

      // Criar primeiro admin
      const user = await createAdminUser({
        email,
        username,
        password,
        role: "admin",
      });

      logger.info("Primeiro admin criado via setup endpoint", { 
        userId: user.id,
        email: user.email,
        username: user.username 
      });

      const response: ApiResponse<{
        id: string;
        email: string;
        username: string;
        role: string;
      }> = {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
        message: "Primeiro administrador criado com sucesso",
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error("Erro ao criar primeiro admin", error);
      const message = error instanceof Error ? error.message : "Erro ao criar administrador";
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * Verificar status do setup.
   * GET /api/setup/status
   */
  router.get("/status", async (_req, res) => {
    try {
      const adminCount = await countActiveAdmins();
      
      res.json({
        success: true,
        data: {
          hasAdmin: adminCount > 0,
          adminCount,
          needsSetup: adminCount === 0,
        },
      });
    } catch (error) {
      logger.error("Erro ao verificar status do setup", error);
      res.status(500).json({ 
        success: false, 
        error: "Erro ao verificar status do setup" 
      });
    }
  });

  return router;
}
