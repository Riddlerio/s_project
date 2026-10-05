import './turnCue.css'

/*
 * '네 차례' 신호(2026-10-05 Phase 4, 사용자 승인). 아이가 말할 차례마다 대화·대구대 건너기·게임 4종이 같은 순서로 쓴다.
 *  1. 두두 귀 쫑긋(LISTENING 동작, src/tiger/duduPerk.ts)과 짧은 차임(playTurnChime, demoFx.tsx)
 *  2. 차임이 다 들린 뒤 듣기가 열릴 때 화면 가장자리 빛과 '네 차례!' 배지(<TurnCue on>)
 * 차임은 듣기 전에만 울린다. 마이크 처리 순서(캡처→분석→인식→제출)와 보정 시간은 그대로이고, 듣기 시작만 차임 뒤로 늦춘다.
 * 듣는 동안 빛·배지는 움직이지 않는다(듣는 동안 연출 0). 깜박임·빨간색 없음. 화면 연출이며 판정·기록에 쓰지 않는다.
 * 배지는 가장 가까운 위치 지정 부모(두두가 있는 무대)의 오른쪽 위에 놓인다.
 */
export function TurnCue({ on }: { on: boolean }) {
  return <>
    <div className={`turn-glow${on ? ' on' : ''}`} aria-hidden="true" />
    <p className={`turn-badge${on ? ' on' : ''}`} role="status">{on && <><MicIcon />네 차례!</>}</p>
  </>
}

function MicIcon() {
  return <svg className="turn-mic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="8" y="2.5" width="8" height="12" rx="4" fill="currentColor" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
}
