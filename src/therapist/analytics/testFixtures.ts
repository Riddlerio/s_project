/* 건너기 분석 테스트용 예시 자료(서버 응답 형식). 화면 코드에서는 쓰지 않는다. */
import type { CrossingAnalytics } from '../../api/therapist'
import type { CrossingSession } from './crossingAnalytics'

export const crossingSession = (over: Partial<CrossingSession> = {}): CrossingSession => ({
  sessionId: 's1', startedAt: '2026-10-01T01:00:00', source: 'REAL', rhythm: { startBpm: 84, allowFaster: true },
  attemptN: 10, deferredN: 1, reviewedN: 8, confirmedSuccessN: 6, confirmedRate: .75,
  byLevel: { syllable: { reviewedN: 4, confirmedSuccessN: 3 }, word: { reviewedN: 4, confirmedSuccessN: 3 } },
  autoReasons: { ok: 6, noFrication: 1, shortFrication: 1, noVowel: 0 }, ...over,
})

export const crossingData = (sessions: CrossingSession[], met = false): CrossingAnalytics => ({
  sessions, mastery: { threshold: .8, consecutiveSessions: 3, met },
  notes: ['회기 간 변화는 치료 효과의 증명이 아닙니다.', 'DEMO·샘플 회기는 확인 비율과 숙달 계산에서 제외합니다.'],
})
