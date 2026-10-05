/** 이름 뒤 조사를 받침에 맞춘다. 한글이 아니면 받침이 없는 것으로 본다. */
export function hasFinalConsonant(word: string): boolean {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0
}

/** 부를 때: 민준아, 두두친구야. */
export const callName = (name: string) => `${name}${hasFinalConsonant(name) ? '아' : '야'}`

/** 칭찬할 때: 역시 민준이야, 역시 두두친구야. */
export const isName = (name: string) => `${name}${hasFinalConsonant(name) ? '이야' : '야'}`
