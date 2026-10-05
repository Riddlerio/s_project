import type { Acoustic } from '../../shared/types'

/*
 * '대구대 건너기' 진행 규칙(2026-10-05 데모 설계안 2절, 같은 날 사용자 피드백으로 20줄 → 10줄).
 * 실제 판정·진행은 서버가 정하고 화면은 그 결과만 따른다. 두두는 서버가 성공이라고 할 때마다 한 줄씩 건넌다.
 * 여기의 미리보기 진행·근사 판정은 개발 검토 화면(서버 없이)에서만 쓴다. 같은 규칙을 서버 지시서(CODEX_DEMO_TASK)에 적었다.
 */
export type CrossingResult = 'success' | 'retry' | 'uncertain' | 'no_speech'
export interface CrossingItem {
  itemId: string; text: string; level: 'syllable' | 'word'
  roundIndex: number; itemIndexInRound: number; stripeIndex: number
  /** 두두가 먼저 들려주는 줄(1라운드). */
  modelCue: boolean
}

export const STRIPES = 10
// 치료사 타임라인의 5라운드 구조는 유지한다(5라운드 × 2줄).
export const ITEMS_PER_ROUND = 2
export const MAX_TRIES = 3
export const MAX_QUIET = 3
export const ROUND_TITLES = ['두두 따라 건너기', '혼자 건너기', '모음 바꿔 건너기', '낱말 건너기', '정문까지'] as const

const SYLLABLES = ['사', '소', '수', '시']

/** 목표 /ㅅ/의 미리보기 계획(5라운드 × 2줄). 낱말 단계면 1~3라운드도 낱말이다. 서버 사양과 같다. */
export function previewPlan(level: 'syllable' | 'word' = 'syllable'): CrossingItem[] {
  const word = level === 'word'
  // 서버(backend/app/games/crossing.py build_stages)와 같은 구성. 설계 근거는 shared/daegu_crossing_rationale.json.
  const rounds: string[][] = [
    word ? ['사과', '사과'] : ['사', '사'],
    word ? ['사과', '사과'] : ['사', '사'],
    word ? ['소리', '시소'] : ['소', '시'],
    ['사과', '수박'],
    word ? ['수박', '시소'] : ['수', '시소'],
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
 * 음향 근사 판정(ONSET_FRICATION): 소리 시작의 마찰 구간과 그 뒤 유성 구간(모음)이 기준 이상이면 성공. 정확한 발음 평가가 아니다.
 * 기준값(2026-10-05 사용자 실측 31개, docs/handoff/MIC_MEASUREMENT_2026-10-05.md):
 * - 시작 마찰 70ms 이상(20ms 프레임 4개). 바르게 낸 '사'는 79~80ms였다. 60ms(3프레임)는 'ㅊ·ㅈ'처럼 짧은 마찰도 통과시킬 수 있어 올렸다.
 * - 마찰 뒤 모음 80ms 이상. 바람 소리만 길게 낸 것('스~~')은 '사'가 아니다.
 * - 소리가 잡음보다 15dB 이상 크지 않으면 판단하지 않는다(불확실). 작게 말한 것을 틀렸다고 하지 않기 위해서다.
 * - 길이 300ms 미만·8초 초과, 소리 깨짐 1% 이상도 판단하지 않는다(서버 공용 음질 검사 assess_audio_quality와 같다).
 * 서버 판정도 같은 값을 쓴다(backend/app/games/evaluation.py, HEURISTIC_REGISTER). 혀 위치 차이(치간음 등)는 이 근사로 구분할 수 없어 치료사가 확인한다.
 */
export const ONSET_RULE = { onsetFricationMs: 70, voicedAfterMs: 80, minDurationMs: 300, maxDurationMs: 8000, maxClippingRatio: 0.01, minSnrDb: 15 }
/** 판정 이유. success·retry·uncertain을 정하고, '다시'일 때 두두가 줄 단서를 고른다. */
export type OnsetReason = 'ok' | 'no_frication' | 'short_frication' | 'no_vowel' | 'quiet' | 'too_short' | 'poor_audio' | 'no_speech'
export function onsetReason(acoustic: Partial<Acoustic>, rule = ONSET_RULE): OnsetReason {
  if (!acoustic.activeMs) return 'no_speech'
  if ((acoustic.durationMs ?? 0) < rule.minDurationMs) return 'too_short'
  if ((acoustic.durationMs ?? 0) > rule.maxDurationMs || (acoustic.clippingRatio ?? 0) >= rule.maxClippingRatio) return 'poor_audio'
  if (acoustic.noiseFloorDb !== undefined && acoustic.meanRmsDb !== undefined && acoustic.meanRmsDb - acoustic.noiseFloorDb < rule.minSnrDb) return 'quiet'
  const onset = acoustic.onsetFricationMs ?? 0
  if (onset === 0) return 'no_frication'
  if (onset < rule.onsetFricationMs) return 'short_frication'
  return (acoustic.voicedAfterFricationMs ?? 0) >= rule.voicedAfterMs ? 'ok' : 'no_vowel'
}
export function judgeOnset(acoustic: Partial<Acoustic>, rule = ONSET_RULE): CrossingResult {
  if (acoustic.source === 'keyboard') return (acoustic.durationMs ?? 0) >= 250 ? 'success' : 'no_speech'
  const reason = onsetReason(acoustic, rule)
  if (reason === 'ok') return 'success'
  if (reason === 'no_speech') return 'no_speech'
  return reason === 'quiet' || reason === 'too_short' || reason === 'poor_audio' ? 'uncertain' : 'retry'
}

/** 서버 응답의 사건 목록을 결과로 바꾼다(기존 활동 API 사건 이름). */
export function resultFromEvents(events: readonly { type: string }[]): CrossingResult {
  const types = new Set(events.map(event => event.type))
  if (types.has('TARGET_SUCCESS')) return 'success'
  if (types.has('TARGET_RETRY')) return 'retry'
  if (types.has('NO_SPEECH')) return 'no_speech'
  return 'uncertain'
}

/** 빠르기 조정에 쓰는 결과 기록. 'miss'는 박 안에 말이 없었던 것이다. 빠르기 규칙은 rhythm.ts(박자)에 있다. */
export type PaceEvent = CrossingResult | 'miss'

const PRAISE = ['정말 잘했어!', '좋아!', '멋져!', '최고야!']
export const praiseLine = (count: number) => PRAISE[count % PRAISE.length]
/** 다시: 실패라고 하지 않고 소리 단서를 하나 준다(/ㅅ/: 바람 소리). */
export const RETRY_LINE = "바람 소리 '스~'를 먼저 내 볼까?"
/** 무엇이 달랐는지에 맞춘 단서 하나(수행에 대한 피드백). 이유를 모르면 기본 단서. 문장은 두두 음성 파일(duduClips)과 같다. */
export function retryLine(reason: OnsetReason | null, text: string): string {
  if (reason === 'short_frication') return `바람 소리를 조금 더 길게 내 볼까? ${text}!`
  if (reason === 'no_vowel') return `바람 소리 좋아! 끝까지 이어서 말해 볼까? ${text}!`
  return RETRY_LINE
}
/** 두두가 먼저 들려주기 전에 하는 말. 이어서 박에 맞춰 낱말만 부른다(리듬, rhythm.ts). */
export const MODEL_LEAD = '두두 따라 해 봐.'
export const LISTEN_AGAIN_LEAD = '두두가 다시 들려줄게.'
export const listenAgainLine = (text: string) => `${LISTEN_AGAIN_LEAD} ${text}!`
export const MISS_LINE = '앗, 지나가 버렸네! 한 번 더 온다!'
export const modelLine = (text: string) => `${MODEL_LEAD} ${text}!`
/** 두두가 박에 맞춰 부르는 말(음성 파일 '사!' 등). */
export const callWord = (text: string) => `${text}!`
