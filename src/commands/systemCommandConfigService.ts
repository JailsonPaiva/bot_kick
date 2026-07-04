/**
 * Configurações por canal dos comandos padrão (resposta customizada e ativo/inativo).
 */

import { prisma } from "../infra/prisma/client.js";
import {
  SYSTEM_COMMANDS_CATALOG,
  getSystemCommandDefinition,
  type SystemCommandDefinition,
} from "./systemCommandsCatalog.js";

export interface SystemCommandItem {
  id: string | null;
  trigger: string;
  description: string;
  permission: string;
  cooldown?: number;
  category: SystemCommandDefinition["category"];
  defaultResponse?: string;
  response: string;
  isActive: boolean;
  hasCustomResponse: boolean;
}

function effectiveResponse(
  def: SystemCommandDefinition,
  override: string | null | undefined
): string {
  if (override !== null && override !== undefined && override.trim() !== "") {
    return override;
  }
  return def.defaultResponse ?? def.description;
}

export async function listSystemCommands(channelSlug: string): Promise<SystemCommandItem[]> {
  const configs = await prisma.systemCommandConfig.findMany({
    where: { channelSlug },
  });
  const configByTrigger = new Map(configs.map((c) => [c.trigger, c]));

  return SYSTEM_COMMANDS_CATALOG.map((def) => {
    const config = configByTrigger.get(def.trigger);
    const override = config?.response ?? null;
    return {
      id: config?.id ?? null,
      trigger: def.trigger,
      description: def.description,
      permission: def.permission,
      cooldown: def.cooldown,
      category: def.category,
      defaultResponse: def.defaultResponse,
      response: effectiveResponse(def, override),
      isActive: config?.isActive ?? true,
      hasCustomResponse: override !== null && override.trim() !== "",
    };
  });
}

export async function isSystemCommandActive(
  channelSlug: string,
  trigger: string
): Promise<boolean> {
  if (!getSystemCommandDefinition(trigger)) {
    return true;
  }

  const config = await prisma.systemCommandConfig.findUnique({
    where: {
      channelSlug_trigger: { channelSlug, trigger: trigger.toLowerCase() },
    },
  });

  return config?.isActive ?? true;
}

export async function getSystemCommandResponseOverride(
  channelSlug: string,
  trigger: string
): Promise<string | null> {
  const config = await prisma.systemCommandConfig.findUnique({
    where: {
      channelSlug_trigger: { channelSlug, trigger: trigger.toLowerCase() },
    },
  });

  if (!config?.response?.trim()) {
    return null;
  }

  return config.response;
}

export async function updateSystemCommand(
  channelSlug: string,
  trigger: string,
  data: { response?: string; isActive?: boolean }
): Promise<SystemCommandItem> {
  const def = getSystemCommandDefinition(trigger);
  if (!def) {
    throw new Error("Comando padrão não encontrado");
  }

  const normalizedTrigger = trigger.toLowerCase();

  const config = await prisma.systemCommandConfig.upsert({
    where: {
      channelSlug_trigger: { channelSlug, trigger: normalizedTrigger },
    },
    create: {
      channelSlug,
      trigger: normalizedTrigger,
      response: data.response ?? null,
      isActive: data.isActive ?? true,
    },
    update: {
      ...(data.response !== undefined && { response: data.response || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  return {
    id: config.id,
    trigger: def.trigger,
    description: def.description,
    permission: def.permission,
    cooldown: def.cooldown,
    category: def.category,
    defaultResponse: def.defaultResponse,
    response: effectiveResponse(def, config.response),
    isActive: config.isActive,
    hasCustomResponse: !!config.response?.trim(),
  };
}

export async function toggleSystemCommand(
  channelSlug: string,
  trigger: string
): Promise<SystemCommandItem> {
  const def = getSystemCommandDefinition(trigger);
  if (!def) {
    throw new Error("Comando padrão não encontrado");
  }

  const normalizedTrigger = trigger.toLowerCase();
  const existing = await prisma.systemCommandConfig.findUnique({
    where: {
      channelSlug_trigger: { channelSlug, trigger: normalizedTrigger },
    },
  });

  const nextActive = existing ? !existing.isActive : false;

  return updateSystemCommand(channelSlug, normalizedTrigger, { isActive: nextActive });
}
