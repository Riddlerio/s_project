import { api } from './client'
import { TurnRejectedError, type ChatReply, type TurnRequest } from '../child/hoyaChatController'

export interface HoyaChatSession { sessionId: string; mode: 'real' | 'demo'; status: string; turnCount: number; nextTurnIndex: number; maxTurns: number; openingText: string; lastHoyaText: string | null
  /** AI가 두두의 답을 만드는 대화. 이때는 인사부터 끝까지 브라우저 음성 하나로 말한다. */
  generatedReplies?: boolean }
export interface HoyaChatTurnReply extends ChatReply { status: 'COMPLETED'; turnIndex: number; clientRequestId: string; nextActivity: 'daegu_crossing' | null }

export const startHoyaChat = (mode: 'real' | 'demo') =>
  api<HoyaChatSession>('/hoya/chat/sessions', { method: 'POST', body: JSON.stringify({ mode }) })

export const getHoyaChat = (sessionId: string) => api<HoyaChatSession>(`/hoya/chat/sessions/${sessionId}`)

export const completeHoyaChat = (sessionId: string) =>
  api<HoyaChatSession>(`/hoya/chat/sessions/${sessionId}/complete`, { method: 'POST' })

export interface RecoveryOptions {
  fetcher?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  /** 연결 오류·5xx일 때 같은 요청을 다시 보내는 최대 횟수. */
  networkAttempts?: number
  /** 서버가 처리 중(202)이라고 할 때 기다리는 최대 횟수. 서버 제공자 timeout보다 길게 기다린다. */
  processingPolls?: number
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * 아동 발화 1회를 보낸다. 같은 요청 ID로만 재시도하며 끝없이 반복하지 않는다.
 * - 200: 서버가 끝낸 turn(외부 LLM 실패 뒤 DEMO 대체 응답도 여기). 그대로 쓴다.
 * - 202: 서버가 아직 처리 중. 제공자를 다시 부르지 않으므로 잠시 뒤 같은 요청으로 다시 묻는다.
 * - 연결 오류·5xx·429: 응답만 잃었을 수 있으니 같은 요청으로 다시 묻는다(서버가 저장된 결과를 돌려준다).
 * - 그 밖의 4xx: 재시도해도 같으므로 TurnRejectedError.
 */
export async function sendHoyaTurn(sessionId: string, request: TurnRequest, options: RecoveryOptions = {}): Promise<HoyaChatTurnReply> {
  const fetcher = options.fetcher ?? fetch
  const sleep = options.sleep ?? wait
  let networkLeft = options.networkAttempts ?? 4
  let pollsLeft = options.processingPolls ?? 40
  const body = JSON.stringify({ turnIndex: request.index, clientRequestId: request.requestId, ...request.utterance })
  let delay = 400
  for (;;) {
    let response: Response | null = null
    try {
      const csrf = (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('speechHero.csrf')) || ''
      response = await fetcher(`/api/hoya/chat/sessions/${sessionId}/turns`, { method: 'POST', body, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) } })
    } catch { response = null }
    if (response?.status === 200) return await response.json() as HoyaChatTurnReply
    if (response?.status === 202) {
      if (pollsLeft-- <= 0) break
      const info = await response.json().catch(() => ({})) as { retryAfterMs?: number }
      await sleep(Math.min(2000, Math.max(200, info.retryAfterMs ?? 500)))
      continue
    }
    if (response && response.status !== 429 && response.status < 500) {
      const detail = await response.json().catch(() => ({})) as { detail?: string }
      throw new TurnRejectedError(response.status, detail.detail || `요청 실패 (${response.status})`)
    }
    if (networkLeft-- <= 0) break
    await sleep(delay)
    delay = Math.min(4000, delay * 2)
  }
  throw new Error('HOYA_TURN_UNRESOLVED')
}
