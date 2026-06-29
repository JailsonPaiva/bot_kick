/**
 * Refaz OAuth localmente com todos os scopes (incl. events:subscribe).
 * Uso: npm run auth:relogin
 */

import "dotenv/config";
import { forceReauthenticate } from "../src/auth/reauthenticate.js";

forceReauthenticate()
  .then((result) => {
    console.log("Reautenticação OK.");
    console.log(`Scopes concedidos: ${result.scopes}`);
  })
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
