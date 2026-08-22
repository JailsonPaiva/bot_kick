import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { metrics } from "../ops/metrics.js";

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  const started = Date.now();
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - started;
    metrics.recordApi(req.method, req.path, res.statusCode, durationMs);
    logger.info("http_request", {
      module: "api",
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
    });
  });

  next();
}
