/**
 * Snapshots de configuração por canal/módulo para rollback no piloto.
 */

export interface ConfigSnapshot {
  id: string;
  channelSlug: string;
  module: string;
  payload: unknown;
  createdAt: string;
  createdBy: string;
}

const snapshots: ConfigSnapshot[] = [];

function nextId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSnapshot(
  channelSlug: string,
  module: string,
  payload: unknown,
  createdBy = "admin"
): ConfigSnapshot {
  const snap: ConfigSnapshot = {
    id: nextId(),
    channelSlug,
    module,
    payload,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  snapshots.unshift(snap);
  if (snapshots.length > 200) snapshots.pop();
  return snap;
}

export function listSnapshots(
  channelSlug: string,
  module?: string
): ConfigSnapshot[] {
  return snapshots.filter(
    (s) => s.channelSlug === channelSlug && (!module || s.module === module)
  );
}

export function getSnapshot(id: string): ConfigSnapshot | undefined {
  return snapshots.find((s) => s.id === id);
}

export function __resetSnapshotsForTests(): void {
  snapshots.length = 0;
}
