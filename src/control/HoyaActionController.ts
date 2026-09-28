import { mapSignalToHoya, type GameKind, type HoyaAction, type SpeechGameSignal } from './speechGameSignal'

export class HoyaActionController {
  private current: HoyaAction = 'IDLE'
  constructor(private readonly onAction: (action: HoyaAction) => void) {}
  dispatch(game: GameKind, signal: SpeechGameSignal): HoyaAction {
    this.current = mapSignalToHoya(game, signal)
    this.onAction(this.current)
    return this.current
  }
  command(action: HoyaAction): void { this.current = action; this.onAction(action) }
  get action(): HoyaAction { return this.current }
}
