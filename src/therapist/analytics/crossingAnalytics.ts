/*
 * 대구대 건너기 분석 화면의 순수 함수(2026-10-06). 자료는 서버 집계(GET /api/therapist/children/{id}/crossing-analytics)만 쓴다.
 * - 확인 비율·숙달 표시는 서버가 계산한 값을 그대로 보인다. 화면은 다시 판정하지 않는다.
 * - DEMO·샘플 회기는 확인 비율과 숙달 계산에서 빠진다(서버와 같은 규칙). 화면은 '비교 제외'로만 보인다.
 * - 자동 추정 이유는 음향 기준에 따른 '의심'이며 발음의 정오나 임상 판단이 아니다.
 */
import type { CrossingAnalytics } from '../../api/therapist'
import { hasFinalConsonant } from '../../child/koreanText'
import RATIONALE from '../../../shared/daegu_crossing_rationale.json'
import { formatDate, formatDateTime } from '../formatTime'

export type CrossingSession = CrossingAnalytics['sessions'][number]
export type CrossingSource = CrossingSession['source']
export type CrossingLevel = 'syllable' | 'word'
/** 목표에서 쓰는 값만(목표 단계·제외 낱말·단서). */
export interface CrossingGoal { level: string; excluded_words: string[]; preferred_cue: string }

export const SOURCE_TEXT: Record<CrossingSource, string> = { REAL: '실제', DEMO: 'DEMO 연습', SAMPLE: '샘플·시연' }
/** 그래프 아래처럼 좁은 자리에 쓰는 짧은 이름 */
export const SOURCE_SHORT: Record<CrossingSource, string> = { REAL: '실제', DEMO: 'DEMO', SAMPLE: '샘플' }
export const LEVEL_TEXT: Record<CrossingLevel, string> = { syllable: '음절', word: '낱말' }

/** 서버 autoReasons의 이름과 화면 문구. 순서는 막대 순서다. */
export const REASONS = [
  { key: 'noFrication', label: '바람 소리 없음', suspect: '파열음화·생략 의심' },
  { key: 'shortFrication', label: '바람 소리 짧음', suspect: '파찰음화 의심' },
  { key: 'noVowel', label: '모음 없음', suspect: "'스~'만 내고 못 이음" },
  { key: 'ok', label: '기준 충족', suspect: '바람 소리·모음 기준 이상' },
] as const
export type ReasonKey = typeof REASONS[number]['key']

export const percent = (rate: number | null | undefined) => rate == null ? '자료 없음' : `${Math.round(rate * 100)}%`
export const isReal = (session: CrossingSession) => session.source === 'REAL'
export const realSessions = (data: CrossingAnalytics) => data.sessions.filter(isReal)

/** 서버 숙달 표시와 같은 범위: 최신 실제 회기 N개(자료 없는 회기도 건너뛰지 않는다). */
export const masteryWindow = (data: CrossingAnalytics) => realSessions(data).slice(-data.mastery.consecutiveSessions)

/** "2026. 10. 6." → "10.6" (그래프 아래 짧은 날짜, 서울 날짜) */
export function shortDate(value: string): string {
  const parts = formatDate(value).match(/\d+/g)
  return parts && parts.length >= 3 ? `${Number(parts[1])}.${Number(parts[2])}` : formatDate(value)
}

export const sessionLabel = (session: CrossingSession) => `${formatDateTime(session.startedAt)} · ${SOURCE_TEXT[session.source]}`

/** 단계별 치료사 확인 합계(실제 회기만). */
export function levelTotals(sessions: CrossingSession[]): Record<CrossingLevel, { reviewedN: number; confirmedSuccessN: number }> {
  const totals = { syllable: { reviewedN: 0, confirmedSuccessN: 0 }, word: { reviewedN: 0, confirmedSuccessN: 0 } }
  for (const session of sessions.filter(isReal)) {
    for (const level of ['syllable', 'word'] as const) {
      const row = session.byLevel[level]
      if (row) { totals[level].reviewedN += row.reviewedN; totals[level].confirmedSuccessN += row.confirmedSuccessN }
    }
  }
  return totals
}

export const reasonTotal = (session: CrossingSession) => REASONS.reduce((sum, reason) => sum + session.autoReasons[reason.key], 0)

const rhythmText = (session: CrossingSession) => session.rhythm
  ? `시작 박자 ${session.rhythm.startBpm}BPM, 잘하면 빨라지기 ${session.rhythm.allowFaster ? '켬' : '끔'}`
  : '박자 기록 없음'

/** 연습 낱말: 근거 데이터의 라운드 구성에서 목표 단계에 맞는 것, 제외 낱말은 뺀다. 음절 먼저. */
export function practiceItems(level: string | undefined, excluded: string[] = []): string[] {
  const key = level === 'word' ? 'wordLevelItems' : 'items'
  const items = [...new Set(RATIONALE.rounds.flatMap(round => round[key].split(' · ')))].filter(item => !excluded.includes(item))
  return [...items.filter(item => item.length === 1), ...items.filter(item => item.length > 1)]
}

/** 보호자에게 보낼 가정 연습 안내 초안. 치료사가 고쳐 쓴다. */
export function homePracticeDraft(goal: CrossingGoal | null): string {
  const items = practiceItems(goal?.level, goal?.excluded_words)
  const words = items.length ? `'${items.join('·')}'${hasFinalConsonant(items[items.length - 1]) ? '을' : '를'}` : '연습한 낱말을'
  return RATIONALE.homePractice.lines.map(line => line.replace('{words}', words)).join('\n')
}

/**
 * 회기 기록(SOAP) 초안. 서버 집계 수치만 옮기고 S·A·P는 치료사가 쓴다. LLM을 쓰지 않는다.
 * suggestion은 서버 계산 '다음 회기 제안' 문장(불러온 경우만).
 */
export function soapDraft(session: CrossingSession | null, data: CrossingAnalytics, goal: CrossingGoal | null, suggestion?: string | null): string {
  if (!session) return ''
  const level = goal?.level === 'word' ? '낱말' : goal?.level === 'syllable' ? '음절' : '목표 단계 미상'
  const observed = [`O(객관): 목표 /ㅅ/ 어두 · ${level}. 시도 ${session.attemptN}회, 판단 보류 ${session.deferredN}회(실패 아님).`]
  if (isReal(session)) {
    const levels = (['syllable', 'word'] as const).map(key => `${LEVEL_TEXT[key]} ${session.byLevel[key]?.confirmedSuccessN ?? 0}/${session.byLevel[key]?.reviewedN ?? 0}`).join(', ')
    observed.push(session.reviewedN
      ? `치료사 확인 ${session.reviewedN}회 중 성공 ${session.confirmedSuccessN}회(${percent(session.confirmedRate)}) · 단계별 ${levels}.`
      : '치료사가 확인한 평가 가능 기록이 아직 없다.')
  } else observed.push(`${SOURCE_TEXT[session.source]} 회기라 확인 비율과 숙달 계산에서 뺐다.`)
  observed.push(`자동 추정(의심, 임상 판단 아님): ${REASONS.map(reason => `${reason.label} ${session.autoReasons[reason.key]}`).join(' · ')}.`)
  observed.push(`${rhythmText(session)}.`)
  const window = masteryWindow(data)
  const recent = window.length ? `최근 실제 ${window.length}회기 확인 비율 ${window.map(item => percent(item.confirmedRate)).join(' → ')}.` : '비교할 실제 회기가 없다.'
  const mastery = `숙달 표시(최근 실제 ${data.mastery.consecutiveSessions}회기 각 ${Math.round(data.mastery.threshold * 100)}% 이상, 제품 규칙): ${data.mastery.met ? '충족' : '미충족'}.`
  return [
    `[회기 기록 초안] 대구대 건너기 · ${formatDateTime(session.startedAt)} · 자료: ${SOURCE_TEXT[session.source]}`,
    'S(주관): (치료사 작성: 아동 컨디션·참여·보호자 보고)',
    ...observed,
    `A(평가): (치료사 작성) 참고: ${recent} ${mastery} 회기 간 변화는 치료 효과의 증명이 아니다.`,
    `P(계획): ${suggestion ? `서버 제안: ${suggestion} ` : ''}(치료사 작성: 다음 회기 목표 단계·박자·단서)`,
  ].join('\n')
}
