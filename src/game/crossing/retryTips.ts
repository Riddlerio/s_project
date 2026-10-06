import type { OnsetReason } from './crossingFlow'

/*
 * '다시'·'판단 보류'·'놓침' 때 화면 위쪽에 잠깐 보이는 도움말(2026-10-06, 사용자 요청: 틀렸을 때 조언을 조금 더 자세히).
 * 무엇이 달랐는지에 맞춘 수행 피드백이다. 위치 단서(이·입술 모양, 손등으로 바람 느끼기)와 늘여 말하기(스~아 → 사)를 쓴다.
 * 두두 목소리는 녹음된 단서 한 줄 그대로이고, 이 도움말은 그림과 글로 함께 보는 아이·보호자용이다.
 * 이유는 음향 근사로 고른 것이라 확정하지 않는다. 판단 보류(작음·짧음)는 틀림으로 말하지 않는다.
 */
export type MouthKind = 'teeth' | 'long' | 'a' | 'o' | 'u' | 'i' | 'mic' | 'beat'
export interface RetryTip { title: string; body: string; mouth: MouthKind }

interface Vowel { name: string; how: string; mouth: MouthKind }
// 한글 음절의 가운데 모음 번호(ㅏ 0, ㅗ 8, ㅜ 13, ㅣ 20). 이 게임의 낱말(사·소·시·수·사과·수박·시소)이 쓰는 모음만 따로 안내한다.
const VOWELS: Record<number, Vowel> = {
  0: { name: '아', how: '입을 크게 벌려', mouth: 'a' },
  8: { name: '오', how: '입술을 동그랗게 모아', mouth: 'o' },
  13: { name: '우', how: '입술을 앞으로 쭉 내밀어', mouth: 'u' },
  20: { name: '이', how: '입을 옆으로 웃듯이 벌려', mouth: 'i' },
}
const OTHER_VOWEL: Vowel = { name: '모음', how: '입을 벌려', mouth: 'a' }

/** 첫 글자와 그 모음. 한글이 아니거나 안내하지 않는 모음이면 일반 안내를 쓴다. */
export function firstVowel(text: string): Vowel & { syllable: string } {
  const syllable = [...text.trim()][0] ?? ''
  const code = syllable.charCodeAt(0) - 0xac00
  const vowel = code >= 0 && code < 11172 ? VOWELS[Math.floor((code % 588) / 28)] : undefined
  return { ...(vowel ?? OTHER_VOWEL), syllable }
}

/** 판정 이유에 맞춘 도움말. 맞음·무발화·이유를 모를 때(DEMO 글자 입력)는 없다. */
export function retryTip(reason: OnsetReason | null, text: string): RetryTip | null {
  const v = firstVowel(text)
  switch (reason) {
    case 'no_frication':
      return { title: '바람 소리 먼저', body: "이를 살짝 다물고 웃는 입으로 '스~' 바람을 먼저 내요. 손등을 입 앞에 대면 바람이 느껴져요.", mouth: 'teeth' }
    case 'short_frication':
      return { title: '바람을 길게', body: `뱀처럼 '스~~' 길게 낸 다음 '${v.name}'를 붙여요. 스~${v.name} → ${v.syllable}`, mouth: 'long' }
    case 'no_vowel':
      return { title: '끝까지 이어서', body: `'스~' 다음에 ${v.how} '${v.name}'까지 이어요. ${text}`, mouth: v.mouth }
    case 'quiet':
      return { title: '조금 더 크게', body: '마이크와 한 뼘 거리에서 조금 더 크게 말해요. 작게 말한 건 틀린 게 아니에요.', mouth: 'mic' }
    case 'too_short':
      return { title: '끝까지 또박또박', body: `카드 글자를 끝까지 또박또박 말해요. ${text}`, mouth: v.mouth }
    case 'poor_audio':
      return { title: '마이크에서 조금 떨어져요', body: '소리가 너무 커서 찌그러졌어요. 한 뼘 떨어져서 말해요.', mouth: 'mic' }
    default:
      return null
  }
}

/** 박 안에 말이 없었을 때: 언제 말하는지 다시 알려 준다(틀림이 아니다). */
export const MISS_TIP: RetryTip = { title: '넷째 박에 말해요', body: "'하나·둘·셋' 다음, 카드가 동그라미에 쏙 들어올 때 말해요.", mouth: 'beat' }
