from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def uid():
    return str(uuid4())


def now():
    return datetime.now(timezone.utc)


class Therapist(Base):
    __tablename__ = "therapists"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    username: Mapped[str] = mapped_column(String, unique=True)
    password_hash: Mapped[str] = mapped_column(String)
    password_salt: Mapped[str] = mapped_column(String)
    display_name: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuthToken(Base):
    __tablename__ = "auth_tokens"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    therapist_id: Mapped[str] = mapped_column(ForeignKey("therapists.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    username: Mapped[str] = mapped_column(String, unique=True)
    password_hash: Mapped[str] = mapped_column(String)
    password_salt: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    therapist_id: Mapped[str | None] = mapped_column(ForeignKey("therapists.id"), nullable=True)
    child_id: Mapped[str | None] = mapped_column(ForeignKey("children.id"), nullable=True)


class CookieSession(Base):
    __tablename__ = "cookie_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"))
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LoginFailure(Base):
    """로그인 실패 한 건. IP·아이디·IP+아이디 해시별로 최근 실패 수를 센다."""
    __tablename__ = "login_failures"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    key_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Child(Base):
    __tablename__ = "children"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    child_code: Mapped[str] = mapped_column(String, unique=True)
    hero_name: Mapped[str] = mapped_column(String)
    age_band: Mapped[str] = mapped_column(String, default="4-5")
    therapist_id: Mapped[str] = mapped_column(ForeignKey("therapists.id"))
    play_code: Mapped[str] = mapped_column(String, unique=True)
    guardian_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    collection_json: Mapped[dict] = mapped_column(JSON, default=lambda: {"badges": [], "monsterCards": []})
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False)


class TrainingGoal(Base):
    __tablename__ = "training_goals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    version: Mapped[int] = mapped_column(Integer)
    parent_goal_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")
    target_phoneme: Mapped[str] = mapped_column(String, default="ㅅ")
    target_sound: Mapped[str] = mapped_column(String, default="사")
    word_position: Mapped[str] = mapped_column(String, default="initial")
    level: Mapped[str] = mapped_column(String, default="word")
    min_level: Mapped[str] = mapped_column(String, default="syllable")
    session_duration_min: Mapped[int] = mapped_column(Integer, default=10)
    repetition_target: Mapped[int] = mapped_column(Integer, default=30)
    priority: Mapped[str] = mapped_column(String, default="accuracy")
    preferred_cue: Mapped[str] = mapped_column(String, default="visual_mouth")
    excluded_words: Mapped[list] = mapped_column(JSON, default=list)
    excluded_games: Mapped[list] = mapped_column(JSON, default=list)
    priority_targets: Mapped[list] = mapped_column(JSON, default=list)
    pass_threshold: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String, default="manual")
    source_recommendation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TrainingPlan(Base):
    __tablename__ = "training_plans"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    goal_id: Mapped[str] = mapped_column(ForeignKey("training_goals.id"))
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    plan_json: Mapped[dict] = mapped_column(JSON)
    rationale_json: Mapped[list] = mapped_column(JSON, default=list)


class TrainingSession(Base):
    __tablename__ = "training_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    goal_id: Mapped[str] = mapped_column(ForeignKey("training_goals.id"))
    plan_id: Mapped[str] = mapped_column(ForeignKey("training_plans.id"))
    mode: Mapped[str] = mapped_column(String)
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False)
    play_token_hash: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String, default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    runtime_state: Mapped[dict] = mapped_column(JSON, default=dict)
    summary_json: Mapped[dict] = mapped_column(JSON, default=dict)
    insight_json: Mapped[list] = mapped_column(JSON, default=list)


class Utterance(Base):
    __tablename__ = "utterances"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("training_sessions.id"))
    item_id: Mapped[str] = mapped_column(String)
    item_text: Mapped[str] = mapped_column(String)
    level: Mapped[str] = mapped_column(String)
    game: Mapped[str] = mapped_column(String)
    stage_index: Mapped[int] = mapped_column(Integer, default=0)
    attempt_index: Mapped[int] = mapped_column(Integer, default=1)
    transcript: Mapped[str | None] = mapped_column(String, nullable=True)
    alternatives: Mapped[list] = mapped_column(JSON, default=list)
    recognizer: Mapped[str] = mapped_column(String)
    acoustic: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SpeechAnalysis(Base):
    __tablename__ = "speech_analyses"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    utterance_id: Mapped[str] = mapped_column(ForeignKey("utterances.id"), unique=True)
    method: Mapped[str] = mapped_column(String, default="asr_text_alignment_v1")
    target_phones: Mapped[list] = mapped_column(JSON, default=list)
    observed_phones: Mapped[list] = mapped_column(JSON, default=list)
    alignment: Mapped[list] = mapped_column(JSON, default=list)
    ai_score: Mapped[int] = mapped_column(Integer, default=0)
    ai_result: Mapped[str] = mapped_column(String)
    target_status: Mapped[str] = mapped_column(String)
    substitute_symbol: Mapped[str | None] = mapped_column(String, nullable=True)
    pattern_tags: Mapped[list] = mapped_column(JSON, default=list)
    rule_applied_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    final_score: Mapped[int] = mapped_column(Integer, default=0)
    final_result: Mapped[str] = mapped_column(String)
    therapist_override: Mapped[bool] = mapped_column(Boolean, default=False)


class TrainingDecision(Base):
    __tablename__ = "training_decisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("training_sessions.id"))
    utterance_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    decision_type: Mapped[str] = mapped_column(String)
    from_level: Mapped[str | None] = mapped_column(String, nullable=True)
    to_level: Mapped[str | None] = mapped_column(String, nullable=True)
    reason_codes: Mapped[list] = mapped_column(JSON)
    reason_text: Mapped[str] = mapped_column(String)
    inputs_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class GameEvent(Base):
    __tablename__ = "game_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("training_sessions.id"))
    utterance_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    type: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    therapist_text: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ClinicalObservation(Base):
    __tablename__ = "clinical_observations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("training_sessions.id"))
    utterance_id: Mapped[str] = mapped_column(ForeignKey("utterances.id"), unique=True)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    round_index: Mapped[int] = mapped_column(Integer, default=1)
    round_id: Mapped[str] = mapped_column(String, default="legacy.r1")
    difficulty: Mapped[int] = mapped_column(Integer, default=2)
    activity: Mapped[str] = mapped_column(String)
    target_phoneme: Mapped[str] = mapped_column(String)
    word_position: Mapped[str] = mapped_column(String)
    generalization_level: Mapped[str] = mapped_column(String)
    attempt_number: Mapped[int] = mapped_column(Integer)
    cue_type: Mapped[str] = mapped_column(String)
    independence: Mapped[str] = mapped_column(String)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_quality: Mapped[str] = mapped_column(String)
    ai_result: Mapped[str] = mapped_column(String)
    ai_confidence: Mapped[str] = mapped_column(String)
    possible_error_pattern: Mapped[list] = mapped_column(JSON, default=list)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    provenance: Mapped[dict] = mapped_column(JSON, default=dict)
    verification_state: Mapped[str] = mapped_column(String, default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ClinicalVerification(Base):
    __tablename__ = "clinical_verifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    observation_id: Mapped[str] = mapped_column(ForeignKey("clinical_observations.id"))
    therapist_id: Mapped[str] = mapped_column(ForeignKey("therapists.id"))
    action: Mapped[str] = mapped_column(String)
    correction: Mapped[dict] = mapped_column(JSON, default=dict)
    note: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    actor_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String)
    resource_id: Mapped[str] = mapped_column(String(36))
    result: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ProgressMetric(Base):
    __tablename__ = "progress_metrics"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    session_id: Mapped[str] = mapped_column(ForeignKey("training_sessions.id"))
    goal_id: Mapped[str] = mapped_column(ForeignKey("training_goals.id"))
    phoneme: Mapped[str] = mapped_column(String)
    position: Mapped[str] = mapped_column(String)
    level: Mapped[str] = mapped_column(String, default="all")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    successes: Mapped[int] = mapped_column(Integer, default=0)
    retries: Mapped[int] = mapped_column(Integer, default=0)
    hints: Mapped[int] = mapped_column(Integer, default=0)
    no_speech: Mapped[int] = mapped_column(Integer, default=0)
    first_try_success_rate: Mapped[float] = mapped_column(default=0.0)
    success_rate: Mapped[float] = mapped_column(default=0.0)
    mean_score: Mapped[float] = mapped_column(default=0.0)
    ai_mean_score: Mapped[float] = mapped_column(default=0.0)
    level_down_count: Mapped[int] = mapped_column(Integer, default=0)
    level_up_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_sec: Mapped[int] = mapped_column(Integer, default=0)
    max_beam_ms: Mapped[int] = mapped_column(Integer, default=0)


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    session_id: Mapped[str] = mapped_column(ForeignKey("training_sessions.id"))
    goal_id: Mapped[str] = mapped_column(ForeignKey("training_goals.id"))
    rule_id: Mapped[str] = mapped_column(String)
    observation: Mapped[str] = mapped_column(String)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    suggestion_text: Mapped[str] = mapped_column(String)
    suggested_goal: Mapped[dict] = mapped_column(JSON, default=dict)
    rationale: Mapped[str] = mapped_column(String)
    confidence: Mapped[str] = mapped_column(String, default="low")
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ActivityRecommendation(Base):
    __tablename__ = "activity_recommendations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    activity: Mapped[str] = mapped_column(String)
    clinical_purpose: Mapped[str] = mapped_column(String)
    reason: Mapped[str] = mapped_column(String)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    confidence: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="PENDING")
    selected_activity: Mapped[str | None] = mapped_column(String, nullable=True)
    decision_note: Mapped[str] = mapped_column(String, default="")
    decided_by: Mapped[str | None] = mapped_column(ForeignKey("therapists.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TherapistFeedback(Base):
    __tablename__ = "therapist_feedback"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    therapist_id: Mapped[str] = mapped_column(ForeignKey("therapists.id"))
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    kind: Mapped[str] = mapped_column(String)
    recommendation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    utterance_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    action: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    note: Mapped[str] = mapped_column(String, default="")
    resulting_goal_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    resulting_rule_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class TherapistRule(Base):
    __tablename__ = "therapist_rules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    rule_type: Mapped[str] = mapped_column(String)
    params: Mapped[dict] = mapped_column(JSON)
    level_at_creation: Mapped[str] = mapped_column(String)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    source_feedback_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    deactivated_reason: Mapped[str | None] = mapped_column(String, nullable=True)


class HoyaChatSession(Base):
    """호야와 대화하기 세션. 5라운드 게임의 TrainingSession.runtime_state와 섞지 않는다."""
    __tablename__ = "hoya_chat_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id"))
    goal_id: Mapped[str] = mapped_column(ForeignKey("training_goals.id"))
    mode: Mapped[str] = mapped_column(String)
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String, default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 대화 흐름용 비임상 요약(첫 인사·턴 수). 임상 사실을 저장하지 않는다.
    summary_json: Mapped[dict] = mapped_column(JSON, default=dict)


class HoyaChatTurn(Base):
    """아동 발화 1회와 호야 응답 1회. speech_evidence는 관찰 상태이며 정오 판정이 아니다.

    제공자 호출 전에 PROCESSING으로 먼저 저장(예약)하고, 응답이 정해지면 COMPLETED로 바꾼다.
    같은 client_request_id의 재시도는 저장된 결과를 돌려주며 제공자를 다시 부르지 않는다.
    """
    __tablename__ = "hoya_chat_turns"
    __table_args__ = (UniqueConstraint("session_id", "turn_index"), UniqueConstraint("session_id", "client_request_id"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("hoya_chat_sessions.id"))
    turn_index: Mapped[int] = mapped_column(Integer)
    # 브라우저가 만든 임의 값. 아동·계정 정보를 담지 않는다. 이전 개발 DB의 행은 비어 있을 수 있다.
    client_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # 검증된 요청 내용(turn 번호·인식 문장·대체 후보·인식기·음향 요약)의 SHA-256. 같은 요청 ID는 같은 내용에만 쓸 수 있다.
    # 인식 문장에서 나온 값이므로 보존 기간이 지나면 문장과 함께 비운다.
    request_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String, default="COMPLETED")
    session_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    child_transcript: Mapped[str | None] = mapped_column(String, nullable=True)
    hoya_text: Mapped[str | None] = mapped_column(String, nullable=True)
    recognizer: Mapped[str] = mapped_column(String)
    speech_evidence: Mapped[str] = mapped_column(String)
    strategy: Mapped[str] = mapped_column(String)
    target_words: Mapped[list] = mapped_column(JSON, default=list)
    provider: Mapped[str | None] = mapped_column(String, nullable=True)
    model_name: Mapped[str | None] = mapped_column(String, nullable=True)
    fallback_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=now)
