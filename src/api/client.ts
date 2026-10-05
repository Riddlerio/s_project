/** 서버 응답 코드를 함께 담는다. 화면은 메시지 문자열 대신 코드로 분기한다. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const csrf = token || sessionStorage.getItem('speechHero.csrf') || ''
  const response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...options.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(body.detail || `요청 실패 (${response.status})`, response.status)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
