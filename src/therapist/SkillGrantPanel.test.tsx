import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SkillGrantView } from './SkillGrantPanel'
import type { SkillStatus } from '../api/adventure'

const status: SkillStatus = { skill: 'magic_beam', granted: false, therapistName: null, grantedAt: null, evidenceKind: null, note: '', history: [] }
const render = (value: SkillStatus | null, evidence: 'APP_OBSERVATION' | '') => renderToStaticMarkup(<SkillGrantView status={value} busy={false}
  evidence={evidence} note="" onEvidence={() => undefined} onNote={() => undefined} onDecision={() => undefined} />)

describe('치료사 매직빔 결정', () => {
  it('권한을 읽기 전과 근거 선택 전에는 승인할 수 없다', () => {
    expect(render(null, 'APP_OBSERVATION')).toContain('disabled="">매직빔 승인')
    expect(render(status, '')).toContain('disabled="">매직빔 승인')
    expect(render(status, 'APP_OBSERVATION')).toContain('<button>매직빔 승인')
  })
  it('승인된 스킬은 새 승인 대신 철회를 제공하고 결정 이력을 보여 준다', () => {
    const html = render({ ...status, granted: true, therapistName: '샘플 치료사', grantedAt: '2026-10-03T00:00:00Z',
      history: [{ action: 'GRANT', therapistName: '샘플 치료사', at: '2026-10-03T00:00:00Z', evidenceKind: 'APP_OBSERVATION', note: '시연 확인' }] }, 'APP_OBSERVATION')
    expect(html).toContain('disabled="">매직빔 승인')
    expect(html).toContain('class="quiet">승인 철회')
    expect(html).toContain('스킬 결정 이력')
    expect(html).toContain('시연 확인')
  })
  it('기본 공격 클리어와 별도 사람 결정을 설명한다', () => {
    const html = render(status, '')
    expect(html).toContain('기본 공격으로도 같은 모험을 끝낼 수 있습니다')
    expect(html).toContain('점수·자동 판정·게임 완료로 자동 승인되지 않습니다')
  })
})
