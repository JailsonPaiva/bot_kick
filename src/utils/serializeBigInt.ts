/**
 * Converte valores BigInt para string antes de res.json().
 * JSON.stringify nativo não suporta BigInt (comum em modelos Prisma).
 */

export function serializeBigInts<T>(value: T): T {
  if (typeof value === "bigint") {
    return value.toString() as unknown as T;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeBigInts(item)) as unknown as T;
  }

  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      output[key] = serializeBigInts(val);
    }
    return output as T;
  }

  return value;
}

/** Garante que o payload pode ser serializado em JSON (útil em testes). */
export function assertJsonSerializable(value: unknown): void {
  JSON.stringify(serializeBigInts(value));
}
