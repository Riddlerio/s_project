import './attackChoice.css'

export type Attack = 'basic' | 'magic_beam'

/**
 * 몬스터 모험(해변 낚시)의 공격 선택 카드. 기본 공격만으로도 끝까지 진행할 수 있다.
 * 매직빔은 서버가 이번 라운드에 쓸 수 있다고 알려 줄 때만 고를 수 있다. 잠긴 상태를 벌이나 실패로 표현하지 않는다.
 */
export function AttackChoice({ value, magicBeam, disabled, onChange }: {
  value: Attack; magicBeam: boolean; disabled: boolean; onChange(value: Attack): void
}) {
  return <fieldset className="dudu-attack-choice dudu-tools">
    <legend>어떤 힘으로 낚시할까?</legend>
    <div className="dudu-tool-row">
      <label className={`dudu-tool dudu-tool-basic${value === 'basic' ? ' selected' : ''}`}>
        <input className="sr-only" type="radio" name="attack" checked={value === 'basic'} onChange={() => onChange('basic')} disabled={disabled} />
        <span className="dudu-tool-icon" aria-hidden="true"><RodIcon /></span>
        <span className="dudu-tool-text"><strong>기본 공격</strong><small>언제든 쓸 수 있어</small></span>
      </label>
      <label className={`dudu-tool dudu-tool-beam${value === 'magic_beam' ? ' selected' : ''}${magicBeam ? '' : ' locked'}`}>
        <input className="sr-only" type="radio" name="attack" checked={value === 'magic_beam'} onChange={() => onChange('magic_beam')} disabled={!magicBeam || disabled} />
        <span className="dudu-tool-icon" aria-hidden="true"><BeamIcon /></span>
        <span className="dudu-tool-text"><strong>매직빔</strong><small>{magicBeam ? '선생님이 열어 준 힘' : '선생님과 함께 열어요'}</small></span>
      </label>
    </div>
    <p className="dudu-tool-hint">기본 공격으로도 끝까지 갈 수 있어요.</p>
  </fieldset>
}

function RodIcon() {
  return <svg viewBox="0 0 48 48" width="34" height="34">
    <path d="M10 40 L34 8" stroke="#8a5d3b" strokeWidth="4" strokeLinecap="round" />
    <path d="M34 8 Q42 20 38 34" fill="none" stroke="#f7f5ea" strokeWidth="2" />
    <circle cx="38" cy="36" r="3.5" fill="#ff8a65" stroke="#fff" strokeWidth="1.5" />
    <circle cx="14" cy="35" r="4" fill="#5d4433" />
  </svg>
}

function BeamIcon() {
  return <svg viewBox="0 0 48 48" width="34" height="34">
    <path d="M24 5 L28.5 18.5 L42 20 L31.5 28.5 L35 42 L24 34.5 L13 42 L16.5 28.5 L6 20 L19.5 18.5 Z" fill="#ffe27a" stroke="#f2b632" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="24" r="5" fill="#fffbe6" />
  </svg>
}
