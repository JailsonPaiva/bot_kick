/**
 * Especificação OpenAPI 3.0 — Kick Bot API v4
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Kick Bot API",
    version: "4.0.0",
    description: `
API REST do bot Kick.com para dashboard, mini-games e engajamento.

## Autenticação

- **Dashboard (admin):** \`POST /api/auth/login\` → JWT no header \`Authorization: Bearer <token>\`
- **Jogador web (!ttt web):** token de sessão no header \`Authorization: Bearer <token>\` ou query \`?token=\`
- **Público:** endpoints em \`/api/public/*\` não exigem autenticação

## WebSocket (Socket.io)

Mesma porta da API (\`API_PORT\`, padrão 3001):

| Evento | Direção | Descrição |
|--------|---------|-----------|
| \`join:game\` | Cliente → Servidor | \`{ token }\` — entra na sala da partida |
| \`game:update\` | Servidor → Cliente | Atualização de estado do jogo da velha |
| \`game:error\` | Servidor → Cliente | Erro na sessão de jogo |
| \`join:alerts\` | Cliente → Servidor | \`{ token }\` — overlay OBS |
| \`alert:event\` | Servidor → Cliente | Alerta em tempo real no overlay |

## Variáveis de ambiente

- \`API_PORT\` — porta da API (padrão 3001)
- \`CORS_ORIGIN\` — origem permitida do frontend
- \`KICK_CHANNEL_SLUG\` — slug padrão do canal quando não informado na requisição
    `.trim(),
    contact: {
      name: "Kick Bot",
    },
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Desenvolvimento local",
    },
  ],
  tags: [
    { name: "Auth", description: "Autenticação do dashboard" },
    { name: "Status", description: "Health check e status do bot" },
    { name: "Games", description: "Histórico e gestão de partidas" },
    { name: "Players", description: "Ranking de jogadores (mini-games)" },
    { name: "Play", description: "Interface web do jogo da velha" },
    { name: "Commands", description: "Comandos customizáveis do chat" },
    { name: "Timers", description: "Mensagens agendadas no chat" },
    { name: "Moderation", description: "Filtros e logs de moderação" },
    { name: "Loyalty", description: "Pontos de fidelidade" },
    { name: "Alerts", description: "Alertas em tempo real (OBS overlay)" },
    { name: "Giveaways", description: "Sorteios" },
    { name: "Polls", description: "Enquetes" },
    { name: "Public", description: "Endpoints públicos (sem auth)" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token JWT obtido em POST /api/auth/login",
      },
      playerToken: {
        type: "http",
        scheme: "bearer",
        description: "Token de sessão do jogador (comando !ttt web)",
      },
    },
    schemas: {
      ApiSuccess: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "object" },
          message: { type: "string" },
        },
      },
      ApiError: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["password"],
        properties: {
          password: { type: "string", example: "admin" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              token: { type: "string" },
            },
          },
          message: { type: "string" },
        },
      },
      BotStatus: {
        type: "object",
        properties: {
          online: { type: "boolean" },
          uptime: { type: "number", description: "Uptime em ms" },
          activeGames: { type: "integer" },
          totalPlayers: { type: "integer" },
          version: { type: "string" },
        },
      },
      GameHistoryItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          gameType: { type: "string", example: "ttt" },
          channelSlug: { type: "string" },
          playerXUsername: { type: "string" },
          playerOUsername: { type: "string" },
          winnerUsername: { type: "string", nullable: true },
          status: { type: "string", enum: ["waiting", "active", "finished"] },
          startedAt: { type: "string", format: "date-time" },
          finishedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      PlayerRankingItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          kickUserId: { type: "integer" },
          username: { type: "string" },
          wins: { type: "integer" },
          losses: { type: "integer" },
          draws: { type: "integer" },
          points: { type: "integer" },
          rank: { type: "integer" },
        },
      },
      Command: {
        type: "object",
        properties: {
          id: { type: "string" },
          channelSlug: { type: "string" },
          trigger: { type: "string" },
          response: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
          permission: { type: "string", example: "everyone" },
          cooldown: { type: "integer" },
          isActive: { type: "boolean" },
        },
      },
      CommandCreate: {
        type: "object",
        required: ["trigger", "response"],
        properties: {
          channelSlug: { type: "string" },
          trigger: { type: "string", example: "ola" },
          response: { type: "string", example: "Olá {user}!" },
          aliases: { type: "array", items: { type: "string" } },
          permission: { type: "string", default: "everyone" },
          cooldown: { type: "integer", default: 5 },
        },
      },
      Timer: {
        type: "object",
        properties: {
          id: { type: "string" },
          channelSlug: { type: "string" },
          name: { type: "string" },
          messages: { type: "array", items: { type: "string" } },
          intervalMinutes: { type: "integer" },
          minViewers: { type: "integer" },
          isActive: { type: "boolean" },
        },
      },
      TimerCreate: {
        type: "object",
        required: ["name", "messages"],
        properties: {
          channelSlug: { type: "string" },
          name: { type: "string" },
          messages: { type: "array", items: { type: "string" }, minItems: 1 },
          intervalMinutes: { type: "integer", default: 30 },
          minViewers: { type: "integer", default: 0 },
        },
      },
      ModerationConfig: {
        type: "object",
        properties: {
          channelSlug: { type: "string" },
          linksEnabled: { type: "boolean" },
          linksWhitelist: { type: "array", items: { type: "string" } },
          capsEnabled: { type: "boolean" },
          capsPercent: { type: "integer" },
          spamEnabled: { type: "boolean" },
          spamWindow: { type: "integer" },
          bannedWords: { type: "array", items: { type: "string" } },
          actionType: { type: "string", example: "warn" },
        },
      },
      PlayMoveRequest: {
        type: "object",
        required: ["position"],
        properties: {
          position: { type: "integer", minimum: 1, maximum: 9 },
        },
      },
      GiveawayCreate: {
        type: "object",
        required: ["prize"],
        properties: {
          channelSlug: { type: "string" },
          prize: { type: "string" },
          filterType: { type: "string", enum: ["everyone", "subs", "followers"], default: "everyone" },
          costPoints: { type: "integer", default: 0 },
        },
      },
      PollCreate: {
        type: "object",
        required: ["question", "options"],
        properties: {
          channelSlug: { type: "string" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 2 },
          durationS: { type: "integer", default: 60 },
          weightedSubs: { type: "boolean", default: false },
        },
      },
      AlertConfigUpdate: {
        type: "object",
        required: ["type"],
        properties: {
          channelSlug: { type: "string" },
          type: { type: "string", example: "follow" },
          isActive: { type: "boolean" },
          imageUrl: { type: "string", nullable: true },
          message: { type: "string" },
          durationMs: { type: "integer", default: 5000 },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Token ausente ou inválido",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiError" },
            example: { success: false, error: "Token não fornecido" },
          },
        },
      },
      BadRequest: {
        description: "Requisição inválida",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiError" },
          },
        },
      },
      NotFound: {
        description: "Recurso não encontrado",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiError" },
          },
        },
      },
    },
  },
  paths: {
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login do dashboard",
        description: "Em desenvolvimento, senha padrão `admin` se `ADMIN_PASSWORD_HASH` não estiver configurado.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["Status"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Servidor OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/status": {
      get: {
        tags: ["Status"],
        summary: "Status do bot",
        responses: {
          "200": {
            description: "Status atual",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiSuccess" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/BotStatus" },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/api/games": {
      get: {
        tags: ["Games"],
        summary: "Listar histórico de partidas",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": {
            description: "Lista de partidas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/GameHistoryItem" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/games/{id}": {
      delete: {
        tags: ["Games"],
        summary: "Cancelar partida ativa",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Partida cancelada" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/players": {
      get: {
        tags: ["Players"],
        summary: "Ranking de jogadores",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Ranking paginado" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/players/{id}": {
      get: {
        tags: ["Players"],
        summary: "Detalhes de um jogador",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Jogador encontrado" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/play/session": {
      get: {
        tags: ["Play"],
        summary: "Estado da partida (web)",
        security: [{ playerToken: [] }],
        parameters: [
          { name: "token", in: "query", schema: { type: "string" }, description: "Alternativa ao header Authorization" },
        ],
        responses: {
          "200": { description: "Estado do jogo da velha" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/play/move": {
      post: {
        tags: ["Play"],
        summary: "Realizar jogada",
        security: [{ playerToken: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PlayMoveRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Jogada registrada" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/commands": {
      get: {
        tags: ["Commands"],
        summary: "Listar comandos customizados",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Lista de comandos",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { type: "array", items: { $ref: "#/components/schemas/Command" } },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Commands"],
        summary: "Criar comando",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CommandCreate" },
            },
          },
        },
        responses: {
          "201": { description: "Comando criado" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "409": { description: "Trigger duplicado" },
        },
      },
    },
    "/api/commands/{id}": {
      put: {
        tags: ["Commands"],
        summary: "Atualizar comando",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  response: { type: "string" },
                  aliases: { type: "array", items: { type: "string" } },
                  permission: { type: "string" },
                  cooldown: { type: "integer" },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Comando atualizado" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      delete: {
        tags: ["Commands"],
        summary: "Remover comando",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Comando removido" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/commands/{id}/toggle": {
      patch: {
        tags: ["Commands"],
        summary: "Ativar/desativar comando",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Status alternado" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/timers": {
      get: {
        tags: ["Timers"],
        summary: "Listar timers",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Lista de timers" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Timers"],
        summary: "Criar timer",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TimerCreate" },
            },
          },
        },
        responses: {
          "201": { description: "Timer criado" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/timers/{id}": {
      put: {
        tags: ["Timers"],
        summary: "Atualizar timer",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Timer atualizado" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      delete: {
        tags: ["Timers"],
        summary: "Remover timer",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Timer removido" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/timers/{id}/toggle": {
      patch: {
        tags: ["Timers"],
        summary: "Ativar/desativar timer",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Status alternado" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/moderation": {
      get: {
        tags: ["Moderation"],
        summary: "Obter configuração de moderação",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Configuração do canal",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/ModerationConfig" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      put: {
        tags: ["Moderation"],
        summary: "Salvar configuração de moderação",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ModerationConfig" },
            },
          },
        },
        responses: {
          "200": { description: "Configuração salva" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/moderation/logs": {
      get: {
        tags: ["Moderation"],
        summary: "Logs de moderação",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          "200": { description: "Logs paginados" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/loyalty/top": {
      get: {
        tags: ["Loyalty"],
        summary: "Top viewers por pontos",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
        ],
        responses: {
          "200": { description: "Ranking de pontos" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/loyalty/transactions": {
      get: {
        tags: ["Loyalty"],
        summary: "Extrato de transações de pontos",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          "200": { description: "Transações paginadas" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/alerts/overlay-token": {
      get: {
        tags: ["Alerts"],
        summary: "Gerar token para overlay OBS",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Token e URL do overlay",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        token: { type: "string" },
                        overlayUrl: { type: "string" },
                        channelSlug: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/alerts/config": {
      get: {
        tags: ["Alerts"],
        summary: "Listar configurações de alertas",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Configurações por tipo" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      put: {
        tags: ["Alerts"],
        summary: "Criar/atualizar alerta por tipo",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AlertConfigUpdate" },
            },
          },
        },
        responses: {
          "200": { description: "Configuração salva" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/alerts/test": {
      post: {
        tags: ["Alerts"],
        summary: "Disparar alerta de teste",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  channelSlug: { type: "string" },
                  type: { type: "string", default: "follow" },
                  username: { type: "string", default: "viewer" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Alerta enviado via Socket.io" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/giveaways": {
      get: {
        tags: ["Giveaways"],
        summary: "Listar sorteios recentes",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Histórico de sorteios" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Giveaways"],
        summary: "Criar sorteio",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GiveawayCreate" },
            },
          },
        },
        responses: {
          "201": { description: "Sorteio criado" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/giveaways/draw": {
      post: {
        tags: ["Giveaways"],
        summary: "Sortear vencedor",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { channelSlug: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Vencedor sorteado" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/giveaways/reroll": {
      post: {
        tags: ["Giveaways"],
        summary: "Reroll do sorteio",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { channelSlug: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Novo vencedor" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/polls": {
      get: {
        tags: ["Polls"],
        summary: "Listar enquetes recentes",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Histórico de enquetes" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Polls"],
        summary: "Criar enquete",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PollCreate" },
            },
          },
        },
        responses: {
          "201": { description: "Enquete criada" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/polls/end": {
      post: {
        tags: ["Polls"],
        summary: "Encerrar enquete ativa",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { channelSlug: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Enquete encerrada" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/public/ranking/{channelSlug}": {
      get: {
        tags: ["Public"],
        summary: "Ranking público de pontos",
        description: "Endpoint público — não requer autenticação.",
        parameters: [
          { name: "channelSlug", in: "path", required: true, schema: { type: "string" } },
          {
            name: "period",
            in: "query",
            schema: { type: "string", enum: ["week", "month", "all"], default: "all" },
          },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
        ],
        responses: {
          "200": { description: "Ranking por período" },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
