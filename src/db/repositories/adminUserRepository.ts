/**
 * Repository para gerenciamento de usuários administradores.
 */

import { prisma } from "../../infra/prisma/client.js";
import bcrypt from "bcryptjs";
import type { AdminUser } from "@prisma/client";

export interface CreateAdminUserInput {
  email: string;
  username: string;
  password: string;
  role?: string;
}

export interface UpdateAdminUserInput {
  email?: string;
  username?: string;
  password?: string;
  role?: string;
  isActive?: boolean;
}

/**
 * Cria um novo usuário administrador.
 */
export async function createAdminUser(
  input: CreateAdminUserInput
): Promise<AdminUser> {
  const passwordHash = await bcrypt.hash(input.password, 10);

  return prisma.adminUser.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
      role: input.role || "admin",
    },
  });
}

/**
 * Busca usuário por email.
 */
export async function findAdminUserByEmail(
  email: string
): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({
    where: { email },
  });
}

/**
 * Busca usuário por username.
 */
export async function findAdminUserByUsername(
  username: string
): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({
    where: { username },
  });
}

/**
 * Busca usuário por ID.
 */
export async function findAdminUserById(
  id: string
): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({
    where: { id },
  });
}

/**
 * Verifica se a senha está correta.
 */
export async function verifyAdminPassword(
  user: AdminUser,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

/**
 * Atualiza último login do usuário.
 */
export async function updateAdminLastLogin(userId: string): Promise<void> {
  await prisma.adminUser.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

/**
 * Lista todos os usuários administradores.
 */
export async function listAdminUsers(): Promise<AdminUser[]> {
  return prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Atualiza um usuário administrador.
 */
export async function updateAdminUser(
  userId: string,
  input: UpdateAdminUserInput
): Promise<AdminUser> {
  const data: Record<string, unknown> = {};

  if (input.email) data.email = input.email;
  if (input.username) data.username = input.username;
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 10);
  if (input.role) data.role = input.role;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  return prisma.adminUser.update({
    where: { id: userId },
    data,
  });
}

/**
 * Deleta um usuário administrador.
 */
export async function deleteAdminUser(userId: string): Promise<void> {
  await prisma.adminUser.delete({
    where: { id: userId },
  });
}

/**
 * Conta quantos admins ativos existem.
 */
export async function countActiveAdmins(): Promise<number> {
  return prisma.adminUser.count({
    where: { isActive: true },
  });
}
