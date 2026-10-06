import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ConversationInsightsData } from '../api/therapist'
import { ConversationSessionList } from './ConversationInsights'

const empty: ConversationInsightsData = { sessions: [], limitation: '읽기 전용 기록입니다.' }

describe('치료사 대화 기록 목록', () => {
  it('숨긴 기록만 있으면 빈 목록 문구와 숨김 안내를 함께 보여 준다', () => {
    const html = renderToStaticMarkup(<ConversationSessionList data={{ ...empty, hiddenEmptyN: 2 }} />)
    expect(html).toContain('대화 기록이 없습니다.')
    expect(html).toContain('대화 없이 끝난 기록 2건은 숨겼습니다.')
  })

  it('숨긴 기록이 없거나 필드가 없으면 안내를 보여 주지 않는다', () => {
    for (const data of [empty, { ...empty, hiddenEmptyN: 0 }]) {
      const html = renderToStaticMarkup(<ConversationSessionList data={data} />)
      expect(html).not.toContain('숨겼습니다.')
    }
  })
})
