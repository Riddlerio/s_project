"""DEMO 대화에서 두두가 하는 모든 문장이 두두 음성 파일 목록(shared/dudu_voice_lines.json)에 있는지 확인한다.

아이 화면은 문장이 하나라도 목록에 없으면 그 말 전체를 브라우저 음성으로 말한다(목소리가 섞이지 않게).
대본·전환 문구를 바꾸면 이 테스트가 깨지므로, 새 문장을 VOLI '하람'으로 만들어 목록에 더한다
(docs/handoff/DUDU_VOICE_VOLI_2026-10-05.md 5절).
"""
import itertools
import json
import re
from pathlib import Path
from typing import get_args

from app.hoya.prompt.prompt_builder import HoyaDialogueContext
from app.hoya.providers.demo_provider import TOPICS, DemoProvider, opening_text
from app.hoya.schemas import SpeechEvidence, Strategy
from app.hoya.transitions import TRANSITION_TEXT
from app.training.content import conversation_candidates

ROOT = Path(__file__).resolve().parents[2]
LINES = json.loads((ROOT / "shared" / "dudu_voice_lines.json").read_text(encoding="utf-8"))
TEXTS = {text for text, _ in LINES}
# 화면 src/speech/duduClips.ts의 splitSentences와 같은 규칙.
SENTENCE = re.compile(r"[^.!?]+[.!?]+|[^.!?]+$")


def sentences(text: str) -> list[str]:
    return [part.strip() for part in SENTENCE.findall(text) if part.strip()]


def demo_replies() -> set[str]:
    lexicon = conversation_candidates("ㅅ", "initial")
    said = [None, "몰라", *[keys[0] for keys, _, _ in TOPICS], "공놀이", "야구", "농구", *lexicon]
    provider, replies = DemoProvider(), set()
    for level, cue, strategy, evidence, turn, transcript in itertools.product(
            ("syllable", "word"), ("auditory_model", None), get_args(Strategy), get_args(SpeechEvidence), range(1, 25), said):
        context = HoyaDialogueContext(age_band="4-5", target_phoneme="ㅅ", word_position="initial", level=level,
                                      strategy=strategy, evidence=evidence, target_lexicon=lexicon, allowed_cue=cue,
                                      child_transcript=transcript, turn_index=turn)
        replies.add(provider.reply_sync(context).text)
    return replies


def test_every_demo_dialogue_sentence_has_a_voice_file():
    # 기본 DEMO 아동(바람용사)과 시연 전용 아동(두두친구)의 첫 인사, 게임 전환, /ㅅ/ 유도 대화 전부
    replies = demo_replies() | {opening_text("바람용사"), opening_text("두두친구"), TRANSITION_TEXT}
    missing = sorted({sentence for reply in replies for sentence in sentences(reply)} - TEXTS)
    assert missing == []


def test_voice_list_has_unique_ids_and_existing_wav_files():
    ids = [clip_id for _, clip_id in LINES]
    assert len(ids) == len(set(ids)) and len(TEXTS) == len(LINES)
    folder = ROOT / "public" / "assets" / "voice" / "dudu"
    assert sorted(path.stem for path in folder.glob("*.wav")) == sorted(ids)
