/*
 * 목표 낱말 그림(2026-10-05). 어린 아이는 글자보다 그림으로 낱말을 알아본다.
 * 쓰는 곳은 두 군데다.
 * - 두두와 대화: "사과가 좋아, 수박이 좋아?" 같은 선택 질문의 그림 단서
 * - 대구대 건너기: 낱말 라운드(그림 보고 말하기)의 카드
 * 외부 그림 파일 없이 코드로 그렸다(라이선스 문제 없음). 화면 꾸밈일 뿐 판정에 쓰지 않는다.
 */
import type { ReactElement } from 'react'

const PICTURES: Record<string, () => ReactElement> = {
  사과: () => <>
    <path d="M32 18c-5-4-15-4-19 3-5 9-1 24 7 30 4 3 8 3 12 1 4 2 8 2 12-1 8-6 12-21 7-30-4-7-14-7-19-3z" fill="#e5534b" />
    <path d="M22 24c-3 2-5 7-4 11" stroke="#f7a6a0" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M32 18c0-5 1-8 4-11" stroke="#7a5230" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M35 11c4-5 10-5 13-2-3 4-9 5-13 2z" fill="#5fae4f" />
  </>,
  수박: () => <>
    <path d="M6 26a26 26 0 0 0 52 0z" fill="#3f9a4a" />
    <path d="M10 26a22 22 0 0 0 44 0z" fill="#e9f5d9" />
    <path d="M13 26a19 19 0 0 0 38 0z" fill="#f06b6b" />
    {[[22, 32], [32, 37], [42, 32], [27, 41], [37, 41]].map(([x, y]) => <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1.6" ry="2.6" fill="#2b2b2b" />)}
  </>,
  사자: () => <>
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2
      return <circle key={i} cx={32 + Math.cos(a) * 19} cy={33 + Math.sin(a) * 19} r="8" fill="#d9822b" />
    })}
    <circle cx="32" cy="33" r="17" fill="#f6c86b" />
    <circle cx="26" cy="30" r="2.2" fill="#2b2b2b" /><circle cx="38" cy="30" r="2.2" fill="#2b2b2b" />
    <path d="M29 36h6l-3 3z" fill="#7a4a2b" />
    <path d="M28 41c2 2 6 2 8 0" stroke="#7a4a2b" strokeWidth="2" fill="none" strokeLinecap="round" />
  </>,
  사탕: () => <>
    <path d="M19 26l-12-7v26l12-7M45 26l12-7v26l-12-7" fill="#f2a83b" />
    <rect x="17" y="22" width="30" height="20" rx="10" fill="#e8607a" />
    <path d="M26 23l-5 17M35 23l-5 18M43 26l-4 15" stroke="#fff0d9" strokeWidth="4" />
    <path d="M10 26l6 4M10 38l6-4M48 30l6-4M48 34l6 4" stroke="#d9822b" strokeWidth="2" strokeLinecap="round" />
  </>,
  수건: () => <>
    <rect x="10" y="9" width="44" height="7" rx="3.5" fill="#b4bbc5" />
    <path d="M18 12h28v42H18z" fill="#74bdcf" />
    <path d="M18 45h28v5H18z" fill="#e8f7fa" />
    <path d="M23 18v20M28 18v20M33 18v20M38 18v20" stroke="#4b9fb4" strokeWidth="2" opacity=".6" />
    <path d="M18 54h28" stroke="#4b9fb4" strokeWidth="3" />
  </>,
  시소: () => <>
    <path d="M26 50l6-14 6 14z" fill="#7a8aa0" />
    <rect x="6" y="31" width="52" height="5" rx="2.5" fill="#f2a83b" transform="rotate(-12 32 33)" />
    <rect x="8" y="34" width="9" height="9" rx="2" fill="#3f8fd8" transform="rotate(-12 32 33)" />
    <rect x="47" y="23" width="9" height="9" rx="2" fill="#e8607a" transform="rotate(-12 32 33)" />
    <path d="M4 52h56" stroke="#9fc98a" strokeWidth="4" strokeLinecap="round" />
  </>,
  소리: () => <>
    <path d="M12 26h8l12-10v32L20 38h-8z" fill="#4f7fd0" />
    <path d="M38 24c3 3 3 13 0 16M44 19c6 6 6 20 0 26M50 14c9 9 9 27 0 36" stroke="#f2a83b" strokeWidth="3.4" fill="none" strokeLinecap="round" />
  </>,
  소풍: () => <>
    <path d="M10 30h44l-5 22H15z" fill="#c98a4b" />
    <path d="M14 36h36M13 43h38" stroke="#a46c35" strokeWidth="2.5" />
    <path d="M18 30c0-14 28-14 28 0" stroke="#a46c35" strokeWidth="3.5" fill="none" />
    <path d="M10 30h44v6H10z" fill="#e8607a" />
    {[14, 26, 38, 50].map(x => <rect key={x} x={x - 2} y="30" width="6" height="6" fill="#ffffff" opacity=".85" />)}
  </>,
}

/** 그림이 있는 목표 낱말 */
export const PICTURE_WORDS = Object.keys(PICTURES)
export const hasPicture = (word: string) => word in PICTURES

/** 낱말 그림. 그림이 없으면 아무것도 그리지 않는다. */
export function WordPicture({ word, size = 56, className = '' }: { word: string; size?: number; className?: string }) {
  const draw = PICTURES[word]
  if (!draw) return null
  return <svg className={`word-picture ${className}`.trim()} viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={`${word} 그림`}>{draw()}</svg>
}

/** 두두 말에 나온 목표 낱말(그림이 있는 것, 나온 순서, 최대 3개). "사과가 좋아, 수박이 좋아?" → 사과·수박 */
export function picturedWords(text: string): string[] {
  return PICTURE_WORDS
    .map(word => ({ word, at: text.indexOf(word) }))
    .filter(found => found.at >= 0)
    .sort((a, b) => a.at - b.at)
    .slice(0, 3)
    .map(found => found.word)
}
