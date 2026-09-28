import unittest
from types import SimpleNamespace

from app.speech.g2p import SimpleKoreanG2P
from app.training.plan_generator import generate_plan
from app.training.policy import decide
from app.training.rewards import award


def goal(**changes):
    values = dict(target_phoneme="ㅅ", level="word", word_position="initial", min_level="syllable",
                  excluded_words=[], excluded_games=[], priority_targets=[], priority="accuracy",
                  preferred_cue="visual_mouth", repetition_target=30, session_duration_min=10)
    values.update(changes)
    return SimpleNamespace(**values)


def state(item, queue=(), **changes):
    values = dict(currentLevel=item["level"], queue=list(queue), itemAttempt=1, successStreak=0,
                  targetRetryStreak=0, resumeItem=None, nextSlot=30, beamTargetMs=1500,
                  pendingBigAttack=False, voicedMs=0)
    values.update(changes)
    return values


class PolicyCoreTest(unittest.TestCase):
    def test_plan_slots_are_unique(self):
        plan = generate_plan(goal())
        ids = [item["itemId"] for stage in plan["stages"] for item in stage["items"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(plan["nextSlot"], len(ids))

    def test_beam_success_does_not_change_streak(self):
        plan = generate_plan(goal())
        beam = plan["stages"][1]["items"][0]
        next_beam = plan["stages"][1]["items"][1]
        output = decide(goal(), beam, SimpleNamespace(result="success"), state(beam, [next_beam], successStreak=2, targetRetryStreak=1), 1, 5)
        self.assertTrue(output.advanced)
        self.assertEqual(output.next_item["beamTargetMs"], 2000)
        self.assertEqual((output.success_streak, output.target_retry_streak), (2, 1))

    def test_beam_short_reduces_target(self):
        beam = generate_plan(goal())["stages"][1]["items"][0]
        output = decide(goal(), beam, SimpleNamespace(result="retry"), state(beam, voicedMs=200), 1, 1)
        self.assertEqual(output.beam_target_ms, 1200)
        self.assertFalse(output.advanced)

    def test_level_down_unique_inserted_items(self):
        item = generate_plan(goal())["stages"][0]["items"][0]
        output = decide(goal(), item, SimpleNamespace(result="retry", target_status="substituted"), state(item, itemAttempt=3, targetRetryStreak=2), 1, 3)
        self.assertIn("LEVEL_DOWN", [e["type"] for e in output.events])
        self.assertEqual(output.next_slot, 33)
        self.assertEqual(len({output.next_item["itemId"], *(i["itemId"] for i in output.queue[:2])}), 3)

    def test_cue_override(self):
        item = generate_plan(goal())["stages"][0]["items"][0]
        rule = SimpleNamespace(rule_type="CUE_OVERRIDE", active=True, params={"cue": "auditory_model"})
        output = decide(goal(), item, SimpleNamespace(result="retry", target_status="substituted"), state(item), 1, 1, [rule])
        self.assertEqual(output.events[0]["payload"]["cue"], "auditory_model")
        self.assertIn("THERAPIST_CUE_OVERRIDE", output.decisions[0]["reasonCodes"])

    def test_level_up_sets_next_attack_power(self):
        plan = generate_plan(goal())
        word = plan["stages"][0]["items"][0]
        syllable = {"itemId": "ㅅ-syllable-0#30", "displayText": "사", "level": "syllable", "game": "monster_tower"}
        output = decide(goal(), syllable, SimpleNamespace(result="success"), state(syllable, currentLevel="syllable", successStreak=2, resumeItem=word), 1, 5)
        self.assertEqual(output.next_item["itemId"], word["itemId"])
        self.assertTrue(output.pending_big_attack)
        attack = decide(goal(), word, SimpleNamespace(result="success"), state(word, pendingBigAttack=output.pending_big_attack), 2, 6)
        self.assertEqual(attack.events[0]["payload"]["power"], 3)
        self.assertFalse(attack.pending_big_attack)

    def test_ng_final_does_not_link(self):
        phones = SimpleKoreanG2P().to_phonemes("강아지")
        self.assertEqual([(p.slot, p.symbol) for p in phones], [("I", "ㄱ"), ("M", "ㅏ"), ("F", "ㅇ"), ("I", "ㅇ0"), ("M", "ㅏ"), ("I", "ㅈ"), ("M", "ㅣ")])

    def test_cluster_final_splits_before_vowel(self):
        phones = SimpleKoreanG2P().to_phonemes("넋이")
        self.assertEqual([(p.slot, p.symbol) for p in phones], [("I", "ㄴ"), ("M", "ㅓ"), ("F", "ㄱ"), ("I", "ㅆ"), ("M", "ㅣ")])

    def test_rewards_are_not_duplicated(self):
        first, badges, cards = award({}, {"monsterStagesCleared": 1, "beamSuccesses": 3, "retryThenSuccessCount": 5})
        self.assertEqual(set(badges), {"첫 모험", "마법 빔 마스터", "끈기 용사"})
        self.assertEqual(len(cards), 1)
        second, badges, cards = award(first, {"monsterStagesCleared": 1, "beamSuccesses": 0, "retryThenSuccessCount": 0})
        self.assertFalse(badges)
        self.assertEqual(len(cards), 1)
        self.assertEqual(len(set(second["monsterCards"])), 2)


if __name__ == "__main__":
    unittest.main()
