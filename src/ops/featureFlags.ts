/**
 * Feature flags por canal (default: ligado). Persistência em memória + Prisma quando disponível.
 */

export const FLAG_MODULES = [
  "commands",
  "moderation",
  "loyalty",
  "giveaways",
  "polls",
  "timers",
  "overlays",
  "chat",
] as const;

export type FlagModule = (typeof FLAG_MODULES)[number];

type FlagMap = Map<string, boolean>;

const store = new Map<string, FlagMap>();

function keyOf(channelSlug: string, module: string): string {
  return `${channelSlug}::${module}`;
}

export function isKnownModule(module: string): module is FlagModule {
  return (FLAG_MODULES as readonly string[]).includes(module);
}

export function isModuleEnabled(channelSlug: string, module: string): boolean {
  const channel = store.get(channelSlug);
  if (!channel) return true;
  const value = channel.get(module);
  return value !== false;
}

export function setModuleFlag(
  channelSlug: string,
  module: string,
  enabled: boolean
): void {
  const channel = store.get(channelSlug) ?? new Map<string, boolean>();
  channel.set(module, enabled);
  store.set(channelSlug, channel);
}

export function listFlags(channelSlug: string): Record<FlagModule, boolean> {
  const result = {} as Record<FlagModule, boolean>;
  for (const module of FLAG_MODULES) {
    result[module] = isModuleEnabled(channelSlug, module);
  }
  return result;
}

export function exportFlagState(channelSlug: string): Record<string, boolean> {
  return { ...listFlags(channelSlug) };
}

export function importFlagState(
  channelSlug: string,
  flags: Record<string, boolean>
): void {
  for (const [module, enabled] of Object.entries(flags)) {
    if (isKnownModule(module)) {
      setModuleFlag(channelSlug, module, Boolean(enabled));
    }
  }
}

export function snapshotKey(_channelSlug: string, _module: string): string {
  return keyOf(_channelSlug, _module);
}
