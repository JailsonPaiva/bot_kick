/**
 * Rotas de autenticação.
 */

import { Router } from "express";
import { generateToken, isLoginRateLimited, authMiddleware } from "../auth.js";
import type { ApiResponse } from "../types.js";
import { logger } from "../../utils/logger.js";
import {
  findAdminUserByEmail,
  findAdminUserByUsername,
  verifyAdminPassword,
  updateAdminLastLogin,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  countActiveAdmins,
} from "../../db/repositories/adminUserRepository.js";

export function createAuthRouter(): Router {
  const router = Router();

  // Login via email ou username
  router.post("/login", async (req, res) => {
    const { identifier, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    if (isLoginRateLimited(ip)) {
      res.status(429).json({ success: false, error: "Muitas tentativas de login" });
      return;
    }

    if (!identifier || !password) {
      res.status(400).json({ 
        success: false, 
        error: "Email/username e senha são obrigatórios" 
      });
      return;
    }

    try {
      // Buscar por email ou username
      let user = await findAdminUserByEmail(identifier);
      if (!user) {
        user = await findAdminUserByUsername(identifier);
      }

      if (!user) {
        logger.warn("[API] Tentativa de login - usuário não encontrado", { identifier });
        res.status(401).json({ success: false, error: "Credenciais inválidas" });
        return;
      }

      if (!user.isActive) {
        logger.warn("[API] Tentativa de login - usuário inativo", { userId: user.id });
        res.status(401).json({ success: false, error: "Usuário inativo" });
        return;
      }

      const isValid = await verifyAdminPassword(user, password);

      if (!isValid) {
        logger.warn("[API] Tentativa de login - senha incorreta", { userId: user.id });
        res.status(401).json({ success: false, error: "Credenciais inválidas" });
        return;
      }

      // Atualizar último login
      await updateAdminLastLogin(user.id);

      const token = generateToken({ userId: user.id, role: user.role });

      const response: ApiResponse<{ token: string; user: { id: string; username: string; email: string; role: string } }> = {
        success: true,
        data: { 
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          }
        },
        message: "Login realizado com sucesso",
      };

      logger.info("[API] Login realizado com sucesso", { userId: user.id });
      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro no login";
      logger.error("[API] Erro no login", error);
      res.status(500).json({ success: false, error: message });
    }
  });

  // Listar usuários admin (requer autenticação)
  router.get("/users", authMiddleware, async (_req, res) => {
    try {
      const users = await listAdminUsers();
      const sanitized = users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      }));

      res.json({ success: true, data: sanitized });
    } catch (error) {
      logger.error("[API] Erro ao listar usuários", error);
      res.status(500).json({ success: false, error: "Erro ao listar usuários" });
    }
  });

  // Criar usuário admin (requer autenticação)
  router.post("/users", authMiddleware, async (req, res) => {
    const { email, username, password, role } = req.body;

    if (!email || !username || !password) {
      res.status(400).json({ 
        success: false, 
        error: "Email, username e senha são obrigatórios" 
      });
      return;
    }

    try {
      const user = await createAdminUser({ email, username, password, role });
      
      res.json({ 
        success: true, 
        data: { 
          id: user.id, 
          email: user.email, 
          username: user.username,
          role: user.role 
        },
        message: "Usuário criado com sucesso"
      });
    } catch (error) {
      logger.error("[API] Erro ao criar usuário", error);
      res.status(500).json({ success: false, error: "Erro ao criar usuário" });
    }
  });

  // Atualizar usuário admin (requer autenticação)
  router.put("/users/:id", authMiddleware, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { email, username, password, role, isActive } = req.body;

    try {
      const user = await updateAdminUser(id, { email, username, password, role, isActive });
      
      res.json({ 
        success: true, 
        data: { 
          id: user.id, 
          email: user.email, 
          username: user.username,
          role: user.role,
          isActive: user.isActive
        },
        message: "Usuário atualizado com sucesso"
      });
    } catch (error) {
      logger.error("[API] Erro ao atualizar usuário", error);
      res.status(500).json({ success: false, error: "Erro ao atualizar usuário" });
    }
  });

  // Deletar usuário admin (requer autenticação)
  router.delete("/users/:id", authMiddleware, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      // Impedir deletar se for o último admin ativo
      const activeCount = await countActiveAdmins();
      if (activeCount <= 1) {
        res.status(400).json({ 
          success: false, 
          error: "Não é possível deletar o último administrador ativo" 
        });
        return;
      }

      await deleteAdminUser(id);
      res.json({ success: true, message: "Usuário deletado com sucesso" });
    } catch (error) {
      logger.error("[API] Erro ao deletar usuário", error);
      res.status(500).json({ success: false, error: "Erro ao deletar usuário" });
    }
  });

  return router;
}
