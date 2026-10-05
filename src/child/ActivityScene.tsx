import { useEffect, useRef, type CSSProperties } from 'react'
import type { GameKind, HoyaAction } from '../control/speechGameSignal'
import { Hoya3D } from '../tiger/Hoya3D'
import { MagicBeamScene } from '../game/magicBeam/MagicBeamScene'
import type { BeamVisualInput } from '../game/magicBeam/sceneState'
import './duduAdventure.css'
import './sceneFx.css'

/** 서버 응답 한 번에 맞춰 한 번만 재생하는 장면 효과. 판정·재료는 서버 응답을 그대로 옮긴다. */
export interface SceneFx {
  id: number
  result: 'hit' | 'retry' | 'none'
  attack: 'basic' | 'magic_beam'
  stars?: number
  material?: 'rice' | 'tuna'
}

type Point = [number, number]
// 장면 안의 위치(%). 두두 손과 목표물 사이를 효과가 잇는다.
const BEACH = { hand: [45, 52] as Point, target: [75, 84] as Point }
const FARM = { hand: [56, 55] as Point, target: [17, 74] as Point }
const at = ([x, y]: Point, extra: CSSProperties = {}): CSSProperties => ({ left: `${x}%`, top: `${y}%`, ...extra })
const vars = (values: Record<string, string | number>) => values as CSSProperties

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** 승인된 데모 장면만 바꾼다. 재료 지급·임상 판정은 서버 응답을 따른다. */
export function ActivityScene({ game, action, magicBeam = false, fx = null, roundIndex = 1, targetMs = 1, readBeamInput, paused = false }: { game: GameKind; action: HoyaAction; magicBeam?: boolean; fx?: SceneFx | null; roundIndex?: number; targetMs?: number; readBeamInput?: () => BeamVisualInput; paused?: boolean }) {
  if (game === 'magic_beam') return <MagicBeamScene action={action} roundIndex={roundIndex} targetMs={targetMs} readInput={readBeamInput} paused={paused} fx={fx} />
  return <ExistingActivityScene game={game} action={action} magicBeam={magicBeam} fx={fx} />
}

function ExistingActivityScene({ game, action, magicBeam = false, fx = null }: { game: GameKind; action: HoyaAction; magicBeam?: boolean; fx?: SceneFx | null }) {
  const farming = game === 'magic_beam'
  const fishing = game === 'monster_adventure'
  const moving = ['CHARGE', 'BEAM', 'CAST', 'ATTACK', 'CHEER', 'RELEASE'].includes(action)
  const charging = (farming || fishing) && ['CHARGE', 'CAST', 'BEAM'].includes(action)
  const spot = fishing ? BEACH : FARM
  const art = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // 맞히는 순간 장면을 짧게 흔든다. 움직임 줄이기 설정에서는 생략한다.
    if (!fx || fx.result !== 'hit' || reducedMotion()) return
    art.current?.animate?.([{ translate: '0 0' }, { translate: '-5px 2px' }, { translate: '4px -2px' }, { translate: '-2px 1px' }, { translate: '0 0' }],
      { duration: 300, easing: 'ease-out' })
  }, [fx?.id])
  const beam = fishing && fx?.result === 'hit' && fx.attack === 'magic_beam'
  return <div ref={art} className={`activity-stage-art dudu-scene ${farming ? 'dudu-farm' : fishing ? 'dudu-beach' : ''}`}>
    <div className="activity-art-ring" aria-hidden="true" />
    {farming && <svg className={`dudu-rice-field ${moving ? 'moving' : ''}`} viewBox="0 0 360 180" role="img" aria-label="소풍에 쓸 밥을 준비하는 벼 수확 장면">
      <ellipse cx="180" cy="160" rx="170" ry="16" fill="#aec57e" />
      {[35, 85, 135, 225, 275, 325].map(x => <g key={`${x}-${fx?.result === 'hit' ? fx.id : 0}`} className={fx?.result === 'hit' ? 'harvested' : ''} transform={`translate(${x} 0)`}>
        <path d="M0 160 Q18 95 5 52 M1 132 Q-24 107 -29 88 M6 110 Q32 88 34 68" fill="none" stroke="#668b46" strokeWidth="5" strokeLinecap="round" />
        {[0, 1, 2, 3].map(y => <ellipse key={y} cx={5 + y * 4} cy={55 + y * 13} rx="7" ry="11" fill="#e8bd61" transform={`rotate(-25 ${5 + y * 4} ${55 + y * 13})`} />)}
      </g>)}
    </svg>}
    {fishing && <>
      <svg className={`dudu-fishing-art ${moving ? 'moving' : ''}`} viewBox="0 0 360 220" role="img" aria-label="소풍에 쓸 참치를 모으는 해변 낚시 장면">
        <path d="M0 142 Q50 124 100 142 T200 142 T300 142 T400 142 V220 H0Z" fill="#74c6d3" />
        <path className="dudu-wave" d="M0 176 Q50 158 100 176 T200 176 T300 176 T400 176" fill="none" stroke="#def3ee" strokeWidth="5" />
        <path d="M82 158 Q80 83 150 48" fill="none" stroke="#89634c" strokeWidth="6" strokeLinecap="round" />
        <path d="M150 48 Q245 72 260 157" fill="none" stroke="#fbfaf2" strokeWidth="2" />
        <g key={fx?.id ?? 0} className={`dudu-tuna${fx?.result === 'hit' ? beam ? ' lifted' : ' caught' : fx?.result === 'retry' ? ' slipped' : ''}`}>
          <ellipse cx="270" cy="176" rx="31" ry="17" fill="#647eac" /><path d="M242 176 L223 162 V190Z" fill="#647eac" /><circle cx="287" cy="173" r="3" fill="#24354c" /><path d="M265 160 L279 148 L281 164" fill="#465f8c" />
        </g>
      </svg>
      {magicBeam && action === 'ATTACK' && <span className="dudu-approved-beam" style={at(BEACH.hand)} aria-label="승인된 매직빔" />}
    </>}
    {charging && <span className={`fx-charge${fishing && magicBeam ? ' gold' : ''}`} style={at(spot.hand)} aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => <i key={i} style={vars({ '--i': i })} />)}
    </span>}
    <div className="activity-character"><Hoya3D action={action} /></div>
    {fx && fx.result === 'hit' && <div className="fx-layer" key={`hit-${fx.id}`} aria-hidden="true">
      {beam && <>
        <svg className="fx-beam" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line className="fx-beam-glow" x1={BEACH.hand[0]} y1={BEACH.hand[1]} x2={BEACH.target[0]} y2={BEACH.target[1]} vectorEffect="non-scaling-stroke" />
          <line className="fx-beam-core" x1={BEACH.hand[0]} y1={BEACH.hand[1]} x2={BEACH.target[0]} y2={BEACH.target[1]} vectorEffect="non-scaling-stroke" />
        </svg>
        {[0.2, 0.38, 0.55, 0.72, 0.88].map((t, i) => <span key={t} className="fx-sparkle" style={at([BEACH.hand[0] + (BEACH.target[0] - BEACH.hand[0]) * t, BEACH.hand[1] + (BEACH.target[1] - BEACH.hand[1]) * t], vars({ '--i': i }))}>✦</span>)}
        <span className="fx-impact gold" style={at(BEACH.target)} />
        <span className="fx-bubble" style={at(BEACH.target)} />
      </>}
      {fishing && !beam && <span className="fx-splash" style={at(BEACH.target)}>{Array.from({ length: 10 }, (_, i) => <i key={i} style={vars({ '--a': `${i * 36 - 90}deg`, '--d': `${38 + (i % 3) * 14}px` })} />)}</span>}
      {farming && <span className="fx-grains" style={at(FARM.target)}>{Array.from({ length: 12 }, (_, i) => <i key={i} style={vars({ '--x': `${(i - 5.5) * 16}px`, '--i': i })} />)}</span>}
      <span className={`fx-word${beam ? ' gold' : ''}`} style={at(fishing ? [68, 60] : [19, 50])}>{beam ? '반짝!' : fishing ? '첨벙!' : '쓱싹!'}</span>
    </div>}
    {fx && fx.result === 'retry' && (farming || fishing) && <span className="fx-ripple" key={`retry-${fx.id}`} style={at(spot.target)} aria-hidden="true" />}
    {!!fx?.stars && <div className="fx-clear" key={`clear-${fx.id}`} aria-hidden="true">
      <span className="fx-stars">{Array.from({ length: 3 }, (_, i) => <i key={i} className={i < (fx.stars ?? 0) ? 'on' : ''} style={vars({ '--i': i })}>★</i>)}</span>
      {fx.material && <span className="fx-loot" style={vars({ '--sx': `${spot.target[0]}%`, '--sy': `${spot.target[1] - 8}%` })}><MaterialIcon material={fx.material} /></span>}
    </div>}
    {(farming || fishing) && <span key={fx?.material ? `bag-${fx.id}` : 'bag'} className={`fx-bag${fx?.material ? ' bump' : ''}`} aria-hidden="true"><BagIcon /></span>}
    <span className="activity-art-caption">{farming ? '벼 수확 · 2·4라운드에 밥' : fishing ? '해변 낚시 · 2·4라운드에 참치' : '두두가 함께해요'}</span>
  </div>
}

function MaterialIcon({ material }: { material: 'rice' | 'tuna' }) {
  return material === 'rice'
    ? <svg viewBox="0 0 48 48" width="44" height="44"><path d="M6 24 H42 Q40 40 24 41 Q8 40 6 24Z" fill="#5f8fbf" /><ellipse cx="24" cy="23" rx="17" ry="9" fill="#fffdf4" /><circle cx="18" cy="20" r="2" fill="#f1eadb" /><circle cx="27" cy="18" r="2" fill="#f1eadb" /></svg>
    : <svg viewBox="0 0 48 48" width="44" height="44"><ellipse cx="25" cy="25" rx="15" ry="9" fill="#647eac" /><path d="M11 25 L3 17 V33Z" fill="#647eac" /><circle cx="33" cy="23" r="2" fill="#24354c" /></svg>
}

function BagIcon() {
  return <svg viewBox="0 0 48 48" width="34" height="34"><path d="M16 16 Q16 7 24 7 Q32 7 32 16" fill="none" stroke="#7b5a3c" strokeWidth="3" /><rect x="8" y="15" width="32" height="27" rx="9" fill="#e5a95b" /><rect x="8" y="15" width="32" height="9" rx="4.5" fill="#d48f42" /><circle cx="24" cy="30" r="3" fill="#fff3d6" /></svg>
}

export function RoundFeedback({ stars, praise, material }: { stars: number; praise: string; material?: 'rice' | 'tuna' }) {
  return <aside className="dudu-round-feedback" role="status">
    <span className="dudu-stars" aria-label={`참여 별 ${stars}개`}>{Array.from({ length: 3 }, (_, i) => <i key={i} className={i < stars ? 'on' : ''} style={vars({ '--i': i })}>{i < stars ? '★' : '☆'}</i>)}</span>
    <strong>{praise}</strong>
    {material && <span className="dudu-feedback-loot">{material === 'rice' ? '밥' : '참치'} 1개를 소풍 가방에 넣었어!</span>}
  </aside>
}
