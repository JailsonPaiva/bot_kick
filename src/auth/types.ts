/**
 * Tipos relacionados à autenticação OAuth 2.1 da Kick.
 * Define as interfaces de configuração e tokens persistidos localmente.
 */

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  /** Timestamp Unix (segundos) de expiração do access_token */
  expires_at: number;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}
