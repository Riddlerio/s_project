import type { GameKind, HoyaAction } from '../control/speechGameSignal'
import { Hoya3D } from '../tiger/Hoya3D'
import './duduAdventure.css'

/** 승인된 데모 장면만 바꾼다. 재료 지급·임상 판정은 서버 응답을 따른다. */
export function ActivityScene({ game, action, magicBeam = false }: { game: GameKind; action: HoyaAction; magicBeam?: boolean }) {
  const farming = game === 'magic_beam'
  const fishing = game === 'monster_adventure'
  const moving = ['CHARGE', 'BEAM', 'CAST', 'ATTACK', 'CHEER', 'RELEASE'].includes(action)
  return <div className={`activity-stage-art dudu-scene ${farming ? 'dudu-farm' : fishing ? 'dudu-beach' : ''}`}>
    <div className="activity-art-ring" aria-hidden="true" />
    {farming && <svg className={`dudu-rice-field ${moving ? 'moving' : ''}`} viewBox="0 0 360 180" role="img" aria-label="소풍에 쓸 밥을 준비하는 벼 수확 장면">
      <ellipse cx="180" cy="160" rx="170" ry="16" fill="#aec57e" />
      {[35, 85, 135, 225, 275, 325].map(x => <g key={x} transform={`translate(${x} 0)`}>
        <path d="M0 160 Q18 95 5 52 M1 132 Q-24 107 -29 88 M6 110 Q32 88 34 68" fill="none" stroke="#668b46" strokeWidth="5" strokeLinecap="round" />
        {[0, 1, 2, 3].map(y => <ellipse key={y} cx={5 + y * 4} cy={55 + y * 13} rx="7" ry="11" fill="#e8bd61" transform={`rotate(-25 ${5 + y * 4} ${55 + y * 13})`} />)}
      </g>)}
    </svg>}
    {fishing && <>
      <svg className={`dudu-fishing-art ${moving ? 'moving' : ''}`} viewBox="0 0 360 220" role="img" aria-label="소풍에 쓸 참치를 모으는 해변 낚시 장면">
        <path d="M0 142 Q50 124 100 142 T200 142 T300 142 T400 142 V220 H0Z" fill="#74c6d3" />
        <path d="M0 176 Q50 158 100 176 T200 176 T300 176 T400 176" fill="none" stroke="#def3ee" strokeWidth="5" />
        <path d="M82 158 Q80 83 150 48" fill="none" stroke="#89634c" strokeWidth="6" strokeLinecap="round" />
        <path d="M150 48 Q245 72 260 157" fill="none" stroke="#fbfaf2" strokeWidth="2" />
        <g className="dudu-tuna"><ellipse cx="270" cy="176" rx="31" ry="17" fill="#647eac" /><path d="M242 176 L223 162 V190Z" fill="#647eac" /><circle cx="287" cy="173" r="3" fill="#24354c" /><path d="M265 160 L279 148 L281 164" fill="#465f8c" /></g>
      </svg>
      {magicBeam && action === 'ATTACK' && <span className="dudu-approved-beam" aria-label="승인된 매직빔" />}
    </>}
    <div className="activity-character"><Hoya3D action={action} /></div>
    <span className="activity-art-caption">{farming ? '벼 수확 · 2·4라운드에 밥' : fishing ? '해변 낚시 · 2·4라운드에 참치' : '두두가 함께해요'}</span>
  </div>
}

export function RoundFeedback({ stars, praise, material }: { stars: number; praise: string; material?: 'rice' | 'tuna' }) {
  return <aside className="dudu-round-feedback" role="status">
    <span className="dudu-stars" aria-label={`참여 별 ${stars}개`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</span>
    <strong>{praise}</strong>
    {material && <span>{material === 'rice' ? '밥' : '참치'} 1개를 소풍 가방에 넣었어!</span>}
  </aside>
}
