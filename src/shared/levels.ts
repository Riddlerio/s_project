export type TrainingLevel = 'phoneme' | 'syllable' | 'word' | 'short_sentence' | 'sentence' | 'spontaneous'
export type GameType = 'monster_tower' | 'magic_beam'
export type SessionMode = 'real' | 'demo'
export type CueType = 'visual_mouth' | 'auditory_model' | 'tactile_description' | 'none'
export const LEVEL_ORDER: TrainingLevel[] = ['phoneme', 'syllable', 'word', 'short_sentence', 'sentence', 'spontaneous']
