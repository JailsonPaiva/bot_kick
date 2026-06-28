const COOKIE_NAME = 'kick_token'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 dias

export function getToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setToken(token: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; SameSite=Strict; max-age=${MAX_AGE}`
}

export function clearToken(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
