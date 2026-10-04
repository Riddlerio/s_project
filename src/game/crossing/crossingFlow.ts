import type { Acoustic } from '../../shared/types'

/*
 * '대구대 건너기' 진행 규칙(2026-10-05 데모 설계안 2절). 실제 판정·진행은 서버가 정하고 화면은 그 결과만 따른다.
 * 여기의 미리보기 진행·근사 판정은 개발 검토 화면(서버 없이)에서만 쓴다. 같은 규칙을 서버 지시서(CODEX_DEMO_TASK)에 적었다.
 */
export type CrossingResult = 'success' | 'retry' | 'uncertain' | 'no_speech'
export interface CrossingItem {
  itemId: string; text: string; level: 'syllable' | 'word'
  roundIndex: number; itemIndexInRound: number; stripeIndex: number
  /** 두두가 먼저 들려주는 줄(1라운드). */
  modelCue: boolean
}

export const STRIPES = 20
export const ITEMS_PER_ROUND = 4
export const MAX_TRIES = 3
export const MAX_QUIET = 3
export const ROUND_TITLES = ['두두 따라 건너기', '혼자 건너기', '모음 바꿔 건너기', '낱말 건너기', '정문까지'] as const

const SYLLABLES = ['사', '소', '수', '시']
const WORDS = ['사과', '수박', '소리', '시소']

/** 목표 /ㅅ/의 미리보기 계획(5라운드 × 4줄). 낱말 단계면 1~3라운드도 낱말이다. */
export function previewPlan(level: 'syllable' | 'word' = 'syllable'): CrossingItem[] {
  const word = level === 'word'
  const rounds: string[][] = [
    word ? ['사과', '사과', '수박', '수박'] : ['사', '사', '사', '사'],
    word ? ['소리', '소리', '시소', '시소'] : ['사', '사', '사', '사'],
    word ? ['수박', '시소', '사과', '소리'] : ['소', '시', '사', '수'],
    WORDS,
    ['수', '사과', '시', '수박'],
  ]
  return rounds.flatMap((texts, r) => texts.map((text, i) => ({
    itemId: `preview-${r + 1}-${i + 1}`, text, level: SYLLABLES.includes(text) ? 'syllable' as const : 'word' as const,
    roundIndex: r + 1, itemIndexInRound: i + 1, stripeIndex: r * ITEMS_PER_ROUND + i + 1, modelCue: r === 0,
  })))
}

/**
 * 줄 진행(서버 규칙과 같음): 성공이면 다음 줄, 다시는 시도를 하나 쓰고 3번이면 다음 줄,
 * 불확실·무발화는 시도를 쓰지 않고 같은 줄을 다시 내며 3번 연속이면 다음 줄.
 */
export class CrossingProgress {
  private index = 0
  private tries = 0
  private quiet = 0
  constructor(private readonly items: readonly CrossingItem[]) {}
  get current(): CrossingItem | null { return this.items[this.index] ?? null }
  get triesLeft(): number { return MAX_TRIES - this.tries }
  record(result: CrossingResult): { advanced: boolean; next: CrossingItem | null } {
    if (result === 'success') return this.advance()
    if (result === 'retry') { this.quiet = 0; return ++this.tries >= MAX_TRIES ? this.advance() : { advanced: false, next: this.current } }
    return ++this.quiet >= MAX_QUIET ? this.advance() : { advanced: false, next: this.current }
  }
  private advance() { this.index++; this.tries = 0; this.quiet = 0; return { advanced: true, next: this.current } }
}

/**
 * 미리보기용 음향 근사 판정(ONSET_FRICATION): 소리 시작의 마찰 구간과 그 뒤 유성 구간이 기준 이상이면 성공.
 * 기준값은 사용자 실제 마이크 측정 뒤 서버 heuristic으로 정한다. 정확한 발음 평가가 아니다.
 */
export const ONSET_RULE = { onsetFricationMs: 60, voicedAfterMs: 80, minDurationMs: 120 }
export function judgeOnset(acoustic: Partial<Acoustic>, rule = ONSET_RULE): CrossingResult {
  if (acoustic.source === 'keyboard') return (acoustic.durationMs ?? 0) >= 250 ? 'success' : 'no_speech'
  if (!acoustic.activeMs) return 'no_speech'
  if ((acoustic.durationMs ?? 0) < rule.minDurationMs) return 'uncertain'
  return (acoustic.onsetFricationMs ?? 0) >= rule.onsetFricationMs && (acoustic.voicedAfterFricationMs ?? 0) >= rule.voicedAfterMs ? 'success' : 'retry'
}

/** 서버 응답의 사건 목록을 결과로 바꾼다(기존 활동 API 사건 이름). */
export function resultFromEvents(events: readonly { type: string }[]): CrossingResult {
  const types = new Set(events.map(event => event.type))
  if (types.has('TARGET_SUCCESS')) return 'success'
  if (types.has('TARGET_RETRY')) return 'retry'
  if (types.has('NO_SPEECH')) return 'no_speech'
  return 'uncertain'
}

/**
 * 속도: 처음엔 말풍선이 5초 동안 다가오고 4초 기다린다. 최근 8번 중 성공이 80% 이상이면 한 번에 하나만 0.5초씩 빠르게,
 * 2번 연속 어려우면 0.5초씩 느리게(시작값까지). 말더듬·마비말장애 아동은 allowFaster=false(치료사 설정).
 */
export interface Pace { approachMs: number; windowMs: number }
export const START_PACE: Pace = { approachMs: 5000, windowMs: 4000 }
export const FASTEST_PACE: Pace = { approachMs: 2500, windowMs: 2500 }
export type PaceEvent = CrossingResult | 'miss'

export function nextPace(pace: Pace, history: readonly PaceEvent[], allowFaster = true): Pace {
  const last2 = history.slice(-2)
  if (last2.length === 2 && last2.every(event => event !== 'success')) {
    return { approachMs: Math.min(START_PACE.approachMs, pace.approachMs + 500), windowMs: Math.min(START_PACE.windowMs, pace.windowMs + 500) }
  }
  const last8 = history.slice(-8)
  if (allowFaster && last8.length === 8 && last8.filter(event => event === 'success').length >= 7) {
    if (pace.approachMs > FASTEST_PACE.approachMs) return { ...pace, approachMs: pace.approachMs - 500 }
    if (pace.windowMs > FASTEST_PACE.windowMs) return { ...pace, windowMs: pace.windowMs - 500 }
  }
  return pace
}

const PRAISE = ['정말 잘했어!', '좋아!', '멋져!', '최고야!']
export const praiseLine = (count: number) => PRAISE[count % PRAISE.length]
/** 다시: 실패라고 하지 않고 소리 단서를 하나 준다(/ㅅ/: 바람 소리). */
export const RETRY_LINE = "바람 소리 '스~'를 먼저 내 볼까?"
export const listenAgainLine = (text: string) => `두두가 다시 들려줄게. ${text}!`
export const MISS_LINE = '앗, 지나가 버렸네! 한 번 더 온다!'
export const modelLine = (text: string) => `두두 따라 해 봐. ${text}!`
