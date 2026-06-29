import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  buildKickWebhookSignaturePayload,
  verifyKickWebhookSignature,
} from "./webhookSignature.js";

describe("webhookSignature", () => {
  it("monta payload no formato messageId.timestamp.body", () => {
    const payload = buildKickWebhookSignaturePayload(
      "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      "2025-01-14T16:08:06Z",
      '{"message_id":"abc"}'
    );
    assert.equal(
      payload,
      '01ARZ3NDEKTSV4RRFFQ69G5FAV.2025-01-14T16:08:06Z.{"message_id":"abc"}'
    );
  });

  it("valida assinatura RSA-SHA256 gerada com par de chaves de teste", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    const messageId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const timestamp = "2025-01-14T16:08:06Z";
    const rawBody = Buffer.from('{"message_id":"test"}');
    const payload = buildKickWebhookSignaturePayload(messageId, timestamp, rawBody);

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(payload);
    signer.end();
    const signatureBase64 = signer.sign(privateKey, "base64");

    const valid = verifyKickWebhookSignature(
      publicKey.export({ type: "spki", format: "pem" }).toString(),
      messageId,
      timestamp,
      rawBody,
      signatureBase64
    );

    assert.equal(valid, true);
  });

  it("rejeita assinatura inválida", () => {
    const { publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    const valid = verifyKickWebhookSignature(
      publicKey.export({ type: "spki", format: "pem" }).toString(),
      "msg-id",
      "2025-01-14T16:08:06Z",
      '{"x":1}',
      Buffer.from("invalid").toString("base64")
    );

    assert.equal(valid, false);
  });

  it("rejeita quando headers obrigatórios estão vazios", () => {
    const { publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();

    assert.equal(verifyKickWebhookSignature(pem, "", "ts", "{}", "sig"), false);
    assert.equal(verifyKickWebhookSignature(pem, "id", "", "{}", "sig"), false);
    assert.equal(verifyKickWebhookSignature(pem, "id", "ts", "{}", ""), false);
  });
});
