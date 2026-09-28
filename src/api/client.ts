export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const csrf = token || sessionStorage.getItem('speechHero.csrf') || ''
  const response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...options.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `요청 실패 (${response.status})`)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
