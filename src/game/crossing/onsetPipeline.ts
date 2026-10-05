import type { Acoustic } from '../../shared/types'
import { isFrication, isVoicedLike } from '../../speech/fricativeDetector'
import { CALIBRATION_MS } from '../../speech/micUtterance'
import { SustainTracker } from '../../speech/sustainTracker'
import { DEFAULT_VAD, VadStateMachine, type VadEvent, type VadFrame } from '../../speech/vad'

/*
 * '대구대 건너기' 전용 발화 요약. 공용 MicUtterancePipeline과 같지만 말 시작 앞부분을 되살린다.
 * 발화 감지는 잡음보다 12dB 클 때 시작하고 마찰음 판정은 6dB부터라서, 자연스럽게 말한 '사'의 /ㅅ/는 감지 시작 전에 지나가
 * 시작 마찰(onsetFrication)이 0으로 남을 수 있다. 감지가 시작되면 바로 앞의 연속된 마찰 구간(최대 0.4초)과
 * 감지 대기 구간을 추적기에 다시 넣는다. 판정은 음향 근사다(정확한 발음 평가가 아님).
 */
export const PRE_ROLL_MAX_MS = 400
/**
 * 이 게임의 발화 감지 시작 기준: 잡음 + 9dB(공용 기본 12dB). 사용자 실측(2026-10-05)에서 '사'는 잡혔지만
 * '스'처럼 조용한 /ㅅ/가 중심인 소리를 가끔 놓쳐서 낮췄다. 조용한 방 기준이며 잡음이 큰 곳에서는 잘못 시작할 수 있다.
 */
export const CROSSING_START_MARGIN_DB = 9
// 절대 하한도 함께 낮춘다(공용 -50dB). 조용한 방(잡음 -60dB)에서는 하한이 9dB 기준보다 높아 조용한 /ㅅ/를 막았다.
export const CROSSING_MIN_START_DB = -56
const HISTORY_MS = 700
/**
 * 사용자 실측(2026-10-05): 길게 낸 '스~'(마찰 1.4~1.9초)인데 시작 마찰이 0으로 나온 경우가 있었다. 마찰 직전의 숨·입술 소리
 * 한두 프레임이 시작 구간을 닫았기 때문이다. 이 게임에서만 앞부분 40ms, 마찰 도중 20ms 꺼짐을 봐준다.
 */
export const ONSET_TOLERANCE = { leadInMs: 40, dipMs: 20 }
/** 개발 점검용으로 남기는 발화 앞부분 프레임 수(20ms × 15 = 0.3초). 판정에는 쓰지 않는다. */
export const ONSET_DUMP_FRAMES = 15

/** 프레임 한 글자 표시: S 마찰, V 유성(모음 쪽), x 그 밖의 소리(숨·입술·터짐), . 조용. 시작 마찰 재기와 같은 기준이다. */
export function frameMark(frame: VadFrame, noiseFloorDb: number): string {
  if (isFrication(frame, noiseFloorDb)) return 'S'
  if (isVoicedLike(frame, noiseFloorDb)) return 'V'
  return frame.rmsDb > noiseFloorDb + 6 ? 'x' : '.'
}

/** 감지 시작 직전의 프레임 중 다시 넣을 것: 감지 대기 구간 전부 + 그 앞의 연속 마찰(한 프레임 끊김 허용). */
export function preRollFrames(history: readonly VadFrame[], candidateStartMs: number, noiseFloorDb: number, maxMs = PRE_ROLL_MAX_MS): VadFrame[] {
  let first = history.length
  let gap = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const frame = history[i]
    if (history.at(-1)!.tMs - frame.tMs > maxMs) break
    if (frame.tMs >= candidateStartMs || isFrication(frame, noiseFloorDb)) { first = i; gap = 0; continue }
    if (++gap > 1) break
  }
  return history.slice(first)
}

export class OnsetPipeline {
  readonly vad: VadStateMachine
  readonly tracker: SustainTracker
  private calibration: number[] = []
  private calibrationStart: number | null = null
  private history: VadFrame[] = []
  private candidateStart = 0
  private utterance: VadFrame[] = []
  preRollMs = 0
  /** 마지막 발화의 앞 0.3초(되살린 앞부분 포함). 점검 화면이 판정 이유를 보여 줄 때만 쓴다. */
  lastOnsetFrames: VadFrame[] = []

  constructor(endHoldMs = 500) {
    this.vad = new VadStateMachine({ ...DEFAULT_VAD, endHoldMs, startMarginDb: CROSSING_START_MARGIN_DB, minStartDbFloor: CROSSING_MIN_START_DB })
    this.tracker = new SustainTracker('any_sound', -60, ONSET_TOLERANCE)
  }

  get calibrated(): boolean { return this.calibrationStart !== null && this.calibration.length === 0 }

  /** 진행 중이던 발화를 버린다(두두가 말한 뒤 다시 들을 때). 잡음 기준은 유지한다. */
  resetUtterance(): void { this.vad.reset(); this.tracker.reset(this.vad.noiseFloor); this.history = []; this.preRollMs = 0; this.utterance = [] }

  process(frame: VadFrame): { events: VadEvent[]; acoustic?: Acoustic } {
    if (this.calibrationStart === null) this.calibrationStart = frame.tMs
    if (frame.tMs - this.calibrationStart < CALIBRATION_MS) { this.calibration.push(frame.rmsDb); return { events: [] } }
    if (this.calibration.length) { this.vad.calibrate(this.calibration); this.tracker.reset(this.vad.noiseFloor); this.calibration = [] }
    const before = this.vad.state
    const active = before === 'voice' || before === 'maybe_silence'
    const events = this.vad.process(frame)
    if (before === 'silence' && this.vad.state === 'maybe_voice') this.candidateStart = frame.tMs
    if (events.some(event => event.type === 'VOICE_START')) {
      this.tracker.reset(this.vad.noiseFloor)
      const pre = preRollFrames(this.history, this.candidateStart, this.vad.noiseFloor)
      this.preRollMs = pre.length ? frame.tMs - pre[0].tMs : 0
      this.utterance = []
      for (const old of pre) this.feed(old)
    }
    if (active || events.some(event => event.type === 'VOICE_START')) this.feed(frame)
    if (!active) {
      this.history.push(frame)
      while (this.history.length && frame.tMs - this.history[0].tMs > HISTORY_MS) this.history.shift()
    }
    const end = events.find(event => event.type === 'VOICE_END')
    if (!end) return { events }
    const acoustic = this.summary(end)
    this.history = []
    this.lastOnsetFrames = this.utterance
    this.utterance = []
    return { events, acoustic }
  }

  private feed(frame: VadFrame): void {
    this.tracker.process(frame)
    if (this.utterance.length < ONSET_DUMP_FRAMES) this.utterance.push(frame)
  }

  private summary(event: VadEvent): Acoustic {
    const t = this.tracker
    return { durationMs: Math.round((event.durationMs ?? 0) + this.preRollMs), voicedMs: event.voicedMs ?? 0,
      activeMs: t.totalActiveMs, bestRunMs: t.bestRunMs, fricationMs: t.fricationMs,
      meanRmsDb: event.meanRmsDb ?? -60, peakRmsDb: event.peakRmsDb ?? -60,
      meanHfRatio: event.meanHfRatio ?? 0, meanCentroidHz: event.meanCentroidHz ?? 0,
      noiseFloorDb: event.noiseFloorDb, clippingRatio: event.clippingRatio, onsetLatencyMs: 0, source: 'microphone',
      sustainSegmentsMs: [...t.segments], pauseCount: t.pauseCount, pauseTotalMs: t.pauseTotalMs, maxPauseMs: t.maxPauseMs,
      interruptionCount: t.interruptionCount, energyMean01: t.energyMean01, energyStd01: t.energyStd01,
      onsetFricationMs: t.onsetFricationMs, voicedAfterFricationMs: t.voicedAfterFricationMs }
  }
}
