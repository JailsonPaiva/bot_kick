import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { openApiSpec } from "./spec.js";
import { setupSwagger } from "../swagger.js";

const REQUIRED_PATHS = [
  "/api/auth/login",
  "/api/health",
  "/api/status",
  "/api/games",
  "/api/players",
  "/api/play/session",
  "/api/play/move",
  "/api/commands",
  "/api/timers",
  "/api/moderation",
  "/api/moderation/logs",
  "/api/loyalty/top",
  "/api/loyalty/transactions",
  "/api/alerts/overlay-token",
  "/api/alerts/config",
  "/api/alerts/test",
  "/api/chat/send",
  "/api/giveaways",
  "/api/giveaways/draw",
  "/api/giveaways/reroll",
  "/api/polls",
  "/api/polls/end",
  "/api/public/ranking/{channelSlug}",
];

describe("openApiSpec", () => {
  it("define metadados básicos da API", () => {
    assert.equal(openApiSpec.openapi, "3.0.3");
    assert.equal(openApiSpec.info.title, "Kick Bot API");
    assert.equal(openApiSpec.info.version, "4.0.0");
  });

  it("documenta esquemas de autenticação admin e jogador", () => {
    assert.ok(openApiSpec.components.securitySchemes.bearerAuth);
    assert.ok(openApiSpec.components.securitySchemes.playerToken);
  });

  it("inclui todos os endpoints REST principais", () => {
    for (const path of REQUIRED_PATHS) {
      assert.ok(
        path in openApiSpec.paths,
        `path ausente na spec: ${path}`
      );
    }
  });

  it("marca login como endpoint público", () => {
    const login = openApiSpec.paths["/api/auth/login"].post;
    assert.ok(login);
    assert.equal(login?.security, undefined);
  });

  it("marca ranking público sem security", () => {
    const ranking = openApiSpec.paths["/api/public/ranking/{channelSlug}"].get;
    assert.ok(ranking);
    assert.equal(ranking?.security, undefined);
  });
});

describe("setupSwagger", () => {
  it("expõe JSON da spec e UI em /api/docs", async () => {
    const app = express();
    setupSwagger(app);

    const jsonRes = await fetchJson(app, "GET", "/api/docs/openapi.json");
    assert.equal(jsonRes.status, 200);
    const body = jsonRes.body as { info: { title: string } };
    assert.equal(body.info.title, "Kick Bot API");

    const uiRes = await fetchRaw(app, "GET", "/api/docs/");
    assert.equal(uiRes.status, 200);
    assert.match(uiRes.headers.get("content-type") ?? "", /html/i);
  });
});

function fetchJson(
  app: express.Express,
  method: string,
  path: string
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("porta indisponível"));
        return;
      }

      const url = `http://127.0.0.1:${address.port}${path}`;
      fetch(url, { method })
        .then(async (res) => {
          const body = await res.json();
          server.close();
          resolve({ status: res.status, body });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

function fetchRaw(
  app: express.Express,
  method: string,
  path: string
): Promise<{ status: number; headers: Headers }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("porta indisponível"));
        return;
      }

      const url = `http://127.0.0.1:${address.port}${path}`;
      fetch(url, { method })
        .then((res) => {
          server.close();
          resolve({ status: res.status, headers: res.headers });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}
