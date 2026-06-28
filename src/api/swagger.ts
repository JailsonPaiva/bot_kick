/**
 * Configuração do Swagger UI para documentação interativa da API.
 */

import type { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi/spec.js";

export function setupSwagger(app: Express): void {
  app.get("/api/docs/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: "Kick Bot API — Swagger",
      customCss: ".swagger-ui .topbar { display: none }",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
      },
    })
  );
}
