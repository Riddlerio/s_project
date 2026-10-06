import RATIONALE from '../../../shared/daegu_crossing_rationale.json'
import './analytics.css'

/**
 * 대구대 건너기 설계 근거(치료사용): 왜 /ㅅ/와 이 낱말인지, 누구를 위한 연습인지, 무슨 연습인지.
 * 내용은 shared/daegu_crossing_rationale.json 그대로다(출처: docs/clinical/DAEGU_CROSSING_RATIONALE_2026-10-05.md).
 * 조절 값(시작 박자·빨라지기)의 빠른 설정 버튼은 바로 아래 '대구대 건너기 설정'에 있다.
 */
export default function CrossingRationalePanel({ level }: { level?: string }) {
  const wordLevel = level === 'word'
  return <section className="card crossing-rationale" aria-labelledby="cr-title">
    <div className="crossing-panel-heading"><h2 id="cr-title">대구대 건너기 설계 근거</h2><span className="crossing-setting-badge">왜 /ㅅ/ · 누구에게 · 무슨 연습</span></div>
    <p className="small">임상 효과를 주장하지 않습니다. 자동 판정은 음향 근사이고, 치료사가 듣고 확인한 기록만 임상 근거가 됩니다.</p>
    <div className="ca-two-col">
      <article>
        <h3>목표 소리</h3>
        <p><strong>{RATIONALE.target.sound}</strong> · {RATIONALE.target.position}</p>
        <ul>{RATIONALE.target.why.map(text => <li key={text}>{text}</li>)}</ul>
      </article>
      <article>
        <h3>누구를 위한 연습인가</h3>
        <ul className="cr-who">{RATIONALE.forWhom.map(item => <li key={item.who}><strong>{item.who}</strong> {item.detail}</li>)}</ul>
        <h4>주의할 대상</h4>
        <ul className="cr-who">{RATIONALE.cautions.map(item => <li key={item.who}><strong>{item.who}</strong> {item.detail}</li>)}</ul>
      </article>
    </div>
    <h3>무슨 연습인가 · 5라운드({wordLevel ? '낱말' : '음절'} 단계)</h3>
    <ol className="cr-rounds">{RATIONALE.rounds.map(round => <li key={round.index}>
      <p className="cr-round-title"><strong>{round.index}. {round.title}</strong> <span>{wordLevel ? round.wordLevelItems : round.items}</span></p>
      <p className="small">단서: {round.cue}</p>
      <p>{round.purpose}</p>
      <p className="small">{round.why}</p>
    </li>)}</ol>
    <details>
      <summary>치료사가 조절하는 값</summary>
      <ul className="cr-adjustable">{RATIONALE.adjustable.map(entry => <li key={entry.name}>
        <strong>{entry.name}</strong> <span className="small">{entry.values} · {entry.where}</span><br />{entry.effect} <em>권장: {entry.recommend}</em>
      </li>)}</ul>
      <p><a href="#crossing-settings">대상별 빠른 설정(시작 박자·빨라지기)으로 가기</a></p>
    </details>
    <details>
      <summary>왜 박자(리듬)인가</summary>
      <p>{RATIONALE.rhythm.summary}</p>
      <ul>{RATIONALE.rhythm.why.map(text => <li key={text}>{text}</li>)}</ul>
    </details>
    <details>
      <summary>자동 판정이 하는 일과 치료사가 하는 일</summary>
      <div className="ca-two-col">
        <div><h4>가를 수 있는 것</h4><ul>{RATIONALE.judgment.can.map(text => <li key={text}>{text}</li>)}</ul></div>
        <div><h4>가를 수 없는 것</h4><ul>{RATIONALE.judgment.cannot.map(text => <li key={text}>{text}</li>)}</ul></div>
      </div>
      <p>{RATIONALE.judgment.therapistRole}</p>
    </details>
    <details>
      <summary>한계</summary>
      <ul>{RATIONALE.limits.map(text => <li key={text}>{text}</li>)}</ul>
    </details>
  </section>
}
