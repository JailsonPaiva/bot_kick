/**
 * Validação de conteúdo para envio de mensagens no chat Kick.
 */

export const MAX_CHAT_MESSAGE_LENGTH = 500;

export interface ValidChatMessageContent {
  content: string;
}

export type ValidateChatContentResult =
  | { ok: true; value: ValidChatMessageContent }
  | { ok: false; error: string };

export function validateChatMessageContent(
  raw: unknown
): ValidateChatContentResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "content deve ser uma string" };
  }

  const content = raw.trim();
  if (!content) {
    return { ok: false, error: "content não pode ser vazio" };
  }

  if (content.length > MAX_CHAT_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `content excede ${MAX_CHAT_MESSAGE_LENGTH} caracteres`,
    };
  }

  return { ok: true, value: { content } };
}

export interface SendChatRequestBody {
  content?: unknown;
  channelSlug?: unknown;
}

export type ParseSendChatBodyResult =
  | { ok: true; content: string; channelSlug?: string }
  | { ok: false; error: string };

export function parseSendChatBody(body: SendChatRequestBody): ParseSendChatBodyResult {
  const validation = validateChatMessageContent(body.content);
  if (!validation.ok) {
    return validation;
  }

  const channelSlug =
    typeof body.channelSlug === "string" && body.channelSlug.trim()
      ? body.channelSlug.trim()
      : undefined;

  return {
    ok: true,
    content: validation.value.content,
    channelSlug,
  };
}
