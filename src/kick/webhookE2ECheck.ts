/**
 * Checklist automatizado para Parte 6 — teste end-to-end do webhook Kick.
 */

import {
  findChatMessageSentSubscription,
  listEventSubscriptions,
  type EventSubscriptionsDeps,
} from "./eventSubscriptions.js";

export interface E2ECheckItem {
  name: string;
  ok: boolean;
  detail: string;
}

export interface WebhookE2ECheckOptions {
  publicApiUrl?: string;
  webhookPath?: string;
  localApiUrl?: string;
  skipVerify?: boolean;
  fetchFn?: typeof fetch;
  listSubscriptions?: (
    deps?: EventSubscriptionsDeps
  ) => Promise<Awaited<ReturnType<typeof listEventSubscriptions>>>;
}

const DEFAULT_WEBHOOK_PATH = "/api/kick/webhooks/events";

export function buildWebhookPublicUrl(
  publicApiUrl: string,
  webhookPath: string = DEFAULT_WEBHOOK_PATH
): string {
  const base = publicApiUrl.trim().replace(/\/+$/, "");
  const path = webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`;
  return `${base}${path}`;
}

export function summarizeE2EChecks(checks: readonly E2ECheckItem[]): {
  allOk: boolean;
  failed: E2ECheckItem[];
} {
  const failed = checks.filter((item) => !item.ok);
  return { allOk: failed.length === 0, failed };
}

async function checkHttpOk(
  fetchFn: typeof fetch,
  url: string,
  label: string
): Promise<E2ECheckItem> {
  try {
    const response = await fetchFn(url, { method: "GET" });
    if (!response.ok) {
      return {
        name: label,
        ok: false,
        detail: `HTTP ${response.status} em ${url}`,
      };
    }

    return {
      name: label,
      ok: true,
      detail: url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name: label,
      ok: false,
      detail: `${url} — ${message}`,
    };
  }
}

async function probeWebhookEndpoint(
  fetchFn: typeof fetch,
  webhookUrl: string,
  skipVerify: boolean
): Promise<E2ECheckItem> {
  if (!skipVerify) {
    return {
      name: "Probe webhook (tunnel → bot)",
      ok: true,
      detail:
        "Ignorado — KICK_WEBHOOK_SKIP_VERIFY=false (use mensagem real no chat Kick)",
    };
  }

  const body = JSON.stringify({
    message_id: "e2e-probe",
    content: "probe",
    created_at: new Date().toISOString(),
    broadcaster: { user_id: 1, username: "broadcaster" },
    sender: { user_id: 2, username: "probe" },
  });

  try {
    const response = await fetchFn(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Kick-Event-Message-Id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        "Kick-Event-Message-Timestamp": new Date().toISOString(),
        "Kick-Event-Type": "chat.message.sent",
        "Kick-Event-Version": "1",
        "Kick-Event-Signature": "dGVzdA==",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        name: "Probe webhook (tunnel → bot)",
        ok: false,
        detail: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    return {
      name: "Probe webhook (tunnel → bot)",
      ok: true,
      detail: "POST retornou 200 — confira log [WEBHOOK] no terminal do bot",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name: "Probe webhook (tunnel → bot)",
      ok: false,
      detail: `${webhookUrl} — ${message}`,
    };
  }
}

export async function runWebhookE2EChecks(
  options: WebhookE2ECheckOptions = {}
): Promise<E2ECheckItem[]> {
  const fetchFn = options.fetchFn ?? fetch;
  const publicApiUrl = options.publicApiUrl ?? process.env.PUBLIC_API_URL ?? "";
  const webhookPath =
    options.webhookPath ?? process.env.KICK_WEBHOOK_PATH ?? DEFAULT_WEBHOOK_PATH;
  const localPort = process.env.API_PORT ?? "3001";
  const localApiUrl =
    options.localApiUrl ?? `http://127.0.0.1:${localPort}`;
  const skipVerify =
    options.skipVerify ?? process.env.KICK_WEBHOOK_SKIP_VERIFY === "true";
  const listSubscriptions = options.listSubscriptions ?? listEventSubscriptions;

  const checks: E2ECheckItem[] = [];

  if (!publicApiUrl.trim()) {
    checks.push({
      name: "PUBLIC_API_URL",
      ok: false,
      detail: "Defina PUBLIC_API_URL no .env (URL do cloudflared)",
    });
  } else {
    checks.push({
      name: "PUBLIC_API_URL",
      ok: true,
      detail: publicApiUrl.trim(),
    });

    const webhookUrl = buildWebhookPublicUrl(publicApiUrl, webhookPath);
    checks.push({
      name: "Webhook URL (portal Kick)",
      ok: true,
      detail: webhookUrl,
    });

    checks.push(
      await checkHttpOk(
        fetchFn,
        `${publicApiUrl.replace(/\/+$/, "")}/api/health`,
        "Health via tunnel"
      )
    );

    checks.push(await probeWebhookEndpoint(fetchFn, webhookUrl, skipVerify));
  }

  checks.push(
    await checkHttpOk(fetchFn, `${localApiUrl}/api/health`, "Health local (bot)")
  );

  try {
    const subscriptions = await listSubscriptions();
    const chatSub = findChatMessageSentSubscription(subscriptions);
    checks.push({
      name: "Inscrição chat.message.sent",
      ok: Boolean(chatSub),
      detail: chatSub
        ? `ativa — id=${chatSub.id}`
        : "Ausente — execute npm run kick:subscribe-chat",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      name: "Inscrição chat.message.sent",
      ok: false,
      detail: message,
    });
  }

  checks.push({
    name: "Verificação de assinatura",
    ok: true,
    detail: skipVerify
      ? "KICK_WEBHOOK_SKIP_VERIFY=true (dev) — desative em produção"
      : "Ativa — eventos reais da Kick serão validados via RSA",
  });

  return checks;
}

export function formatE2ECheckReport(checks: readonly E2ECheckItem[]): string {
  const lines = checks.map((item) => {
    const icon = item.ok ? "[OK]" : "[FALHA]";
    return `${icon} ${item.name}: ${item.detail}`;
  });

  const { allOk } = summarizeE2EChecks(checks);
  lines.push("");
  lines.push(
    allOk
      ? "Checklist pré-voo OK — envie uma mensagem no chat Kick e confira [WEBHOOK] no terminal do bot."
      : "Corrija os itens [FALHA] antes do teste no chat ao vivo."
  );

  return lines.join("\n");
}
