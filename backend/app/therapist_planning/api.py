"""치료사 회기 계획 API. 계약은 docs/therapist-workflow.md 6절이다.

모든 경로는 담당 치료사만 쓴다. 계획은 항상 아동을 거쳐 조회해 다른 아동·치료사의 계획을 읽지 못한다.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import owned_child, require_therapist
from ..db import get_db
from ..models import (AuditEvent, Child, ClinicalObservation, Therapist, TherapistSessionPlan, TherapistSessionPlanStep,
                      TrainingGoal, TrainingSession, now)
from .graph import goal_view, run_planning
from .schemas import SessionPlanInput

router = APIRouter(prefix="/api", tags=["therapist-planning"])

PLAN_FIELDS = ("target_phoneme", "word_position", "start_level", "target_level", "duration_min", "repetition_target",
               "preferred_cue", "priority_targets", "excluded_words", "conversation_theme", "therapist_note")


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(part.title() for part in rest)


def _current_goal(db, child_id: str) -> TrainingGoal:
    goal = db.scalar(select(TrainingGoal).where(TrainingGoal.child_id == child_id, TrainingGoal.status == "active"))
    if goal is None:
        raise HTTPException(409, "현재 치료 목표가 없습니다")
    return goal


def _steps(db, plan_id: str) -> list[TherapistSessionPlanStep]:
    return list(db.scalars(select(TherapistSessionPlanStep).where(TherapistSessionPlanStep.plan_id == plan_id)
                           .order_by(TherapistSessionPlanStep.step_order)).all())


def plan_data(db, plan: TherapistSessionPlan) -> dict:
    goal = db.get(TrainingGoal, plan.goal_id)
    return {"id": plan.id, "childId": plan.child_id, "goalId": plan.goal_id, "goalVersion": goal.version if goal else None,
            "parentPlanId": plan.parent_plan_id, "revision": plan.revision, "status": plan.status,
            **{_camel(field): getattr(plan, field) for field in PLAN_FIELDS},
            "steps": [{"id": step.id, "stepOrder": step.step_order, "stepType": step.step_type, "activity": step.activity,
                       "targetLevel": step.target_level, "parameters": step.parameters} for step in _steps(db, plan.id)],
            "evidenceSnapshot": plan.evidence_snapshot, "recommendationSnapshot": plan.recommendation_snapshot,
            "createdAt": plan.created_at, "updatedAt": plan.updated_at, "approvedAt": plan.approved_at,
            "cancelledAt": plan.cancelled_at}


def _owned_plan(db, plan_id: str, therapist: Therapist) -> tuple[TherapistSessionPlan, Child]:
    plan = db.get(TherapistSessionPlan, plan_id)
    if plan is None:
        raise HTTPException(404, "계획을 찾을 수 없습니다")
    # 아동 소유권으로 확인한다. 다른 치료사의 계획은 존재 여부를 숨기고 거부 기록을 남긴다.
    child = owned_child(db, plan.child_id, therapist)
    return plan, child


def _audit(db, therapist: Therapist, action: str, plan_id: str):
    db.add(AuditEvent(actor_id=therapist.id, action=action, resource_id=plan_id, result="SUCCESS"))


def _write_form(db, plan: TherapistSessionPlan, body: SessionPlanInput):
    values = body.model_dump()
    for field in PLAN_FIELDS:
        setattr(plan, field, values[field])
    for step in _steps(db, plan.id):
        db.delete(step)
    db.flush()
    for order, step in enumerate(body.steps, 1):
        db.add(TherapistSessionPlanStep(plan_id=plan.id, step_order=order, step_type=step.step_type,
                                        activity=step.activity, target_level=step.target_level,
                                        parameters=step.parameters.model_dump(by_alias=True, exclude_none=True)))
    plan.updated_at = now()


def _require_draft(plan: TherapistSessionPlan):
    if plan.status != "DRAFT":
        raise HTTPException(409, "승인되었거나 종료된 계획은 바꿀 수 없습니다. 복제해서 새 초안을 만드세요")


def _snapshots(db, child: Child, goal: TrainingGoal) -> tuple[dict, dict]:
    """결정적 계산만 다시 한다(LLM 호출 없음). transcript·원음성·아동 이름은 담지 않는다."""
    result = run_planning(db, child.id, goal, use_llm=False)
    evidence = {"goal": goal_view(goal), "metrics": result["metrics"], "evidence": result["verified"][:20],
                "capturedAt": now().isoformat()}
    return evidence, result["proposal"]


@router.get("/children/{child_id}/planning-context")
def planning_context(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    child = owned_child(db, child_id, therapist)
    goal = _current_goal(db, child.id)
    result = run_planning(db, child.id, goal, use_llm=False)
    # 검토 대기 수는 실제 음성 회기 전체 기준이다(최근 5회기 창 밖의 미검토 관찰도 치료사가 볼 수 있게).
    pending_all = db.scalar(select(func.count()).select_from(ClinicalObservation).join(
        TrainingSession, TrainingSession.id == ClinicalObservation.session_id).where(
        ClinicalObservation.child_id == child.id, ClinicalObservation.verification_state == "PENDING",
        TrainingSession.mode == "real", TrainingSession.is_seed.is_(False)))
    demo_excluded = db.scalar(select(func.count()).select_from(ClinicalObservation).join(
        TrainingSession, TrainingSession.id == ClinicalObservation.session_id).where(
        ClinicalObservation.child_id == child.id, (TrainingSession.mode != "real") | TrainingSession.is_seed.is_(True)))
    latest = db.scalar(select(TherapistSessionPlan).where(TherapistSessionPlan.child_id == child.id,
                                                          TherapistSessionPlan.status != "CANCELLED")
                       .order_by(TherapistSessionPlan.created_at.desc()))
    recent = result["metrics"]["trend"][::-1]
    return {"child": {"childCode": child.child_code, "alias": child.hero_name, "ageBand": child.age_band},
            "currentGoal": goal_view(goal), "metrics": result["metrics"],
            "evidenceAvailability": {"verifiedN": result["metrics"]["verifiedN"], "pendingReviewN": pending_all,
                                     "demoExcludedN": demo_excluded, "rejectedN": result["metrics"]["rejectedN"],
                                     "sufficient": result["metrics"]["sufficient"]},
            "recentRealSessions": recent,
            "latestPlan": {"id": latest.id, "status": latest.status, "revision": latest.revision} if latest else None}


@router.post("/children/{child_id}/session-plan-proposal")
def session_plan_proposal(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    child = owned_child(db, child_id, therapist)
    goal = _current_goal(db, child.id)
    result = run_planning(db, child.id, goal)
    return {"status": result["proposal"]["status"], "proposal": result["proposal"],
            "summary": {**result["summary"], "source": result["summary_source"]},
            "metrics": result["metrics"], "evidence": result["verified"][:20], "goal": goal_view(goal)}


@router.get("/children/{child_id}/session-plans")
def list_session_plans(child_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    child = owned_child(db, child_id, therapist)
    plans = db.scalars(select(TherapistSessionPlan).where(TherapistSessionPlan.child_id == child.id)
                       .order_by(TherapistSessionPlan.created_at.desc())).all()
    return [plan_data(db, plan) for plan in plans]


@router.post("/children/{child_id}/session-plans")
def create_session_plan(child_id: str, body: SessionPlanInput, db: Session = Depends(get_db),
                        therapist: Therapist = Depends(require_therapist)):
    child = owned_child(db, child_id, therapist)
    goal = _current_goal(db, child.id)
    evidence, recommendation = _snapshots(db, child, goal)
    plan = TherapistSessionPlan(child_id=child.id, therapist_id=therapist.id, goal_id=goal.id, revision=1,
                                evidence_snapshot=evidence, recommendation_snapshot=recommendation,
                                **{field: getattr(body, field) for field in PLAN_FIELDS})
    db.add(plan)
    db.flush()
    _write_form(db, plan, body)
    _audit(db, therapist, "SESSION_PLAN_CREATED", plan.id)
    db.commit()
    return plan_data(db, plan)


@router.get("/session-plans/{plan_id}")
def get_session_plan(plan_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    plan, _child = _owned_plan(db, plan_id, therapist)
    return plan_data(db, plan)


@router.patch("/session-plans/{plan_id}")
def update_session_plan(plan_id: str, body: SessionPlanInput, db: Session = Depends(get_db),
                        therapist: Therapist = Depends(require_therapist)):
    plan, _child = _owned_plan(db, plan_id, therapist)
    _require_draft(plan)
    _write_form(db, plan, body)
    _audit(db, therapist, "SESSION_PLAN_UPDATED", plan.id)
    db.commit()
    return plan_data(db, plan)


@router.post("/session-plans/{plan_id}/approve")
def approve_session_plan(plan_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    plan, child = _owned_plan(db, plan_id, therapist)
    _require_draft(plan)
    goal = _current_goal(db, child.id)
    if goal.id != plan.goal_id:
        raise HTTPException(409, "초안 작성 뒤 치료 목표가 바뀌었습니다. 현재 목표로 계획을 다시 작성하세요")
    # 승인 시점의 목표·근거·제안을 고정한다. 이후 목표나 관찰이 바뀌어도 이 계획은 그대로 재현된다.
    plan.evidence_snapshot, plan.recommendation_snapshot = _snapshots(db, child, goal)
    for old in db.scalars(select(TherapistSessionPlan).where(TherapistSessionPlan.child_id == child.id,
                                                             TherapistSessionPlan.status == "APPROVED")).all():
        old.status = "SUPERSEDED"
        old.updated_at = now()
        _audit(db, therapist, "SESSION_PLAN_SUPERSEDED", old.id)
    plan.status = "APPROVED"
    plan.approved_at = plan.updated_at = now()
    _audit(db, therapist, "SESSION_PLAN_APPROVED", plan.id)
    db.commit()
    return plan_data(db, plan)


@router.post("/session-plans/{plan_id}/cancel")
def cancel_session_plan(plan_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    plan, _child = _owned_plan(db, plan_id, therapist)
    if plan.status not in {"DRAFT", "APPROVED"}:
        raise HTTPException(409, "이미 종료된 계획입니다")
    plan.status = "CANCELLED"
    plan.cancelled_at = plan.updated_at = now()
    _audit(db, therapist, "SESSION_PLAN_CANCELLED", plan.id)
    db.commit()
    return plan_data(db, plan)


@router.post("/session-plans/{plan_id}/clone")
def clone_session_plan(plan_id: str, db: Session = Depends(get_db), therapist: Therapist = Depends(require_therapist)):
    source, child = _owned_plan(db, plan_id, therapist)
    if source.status == "DRAFT":
        raise HTTPException(409, "초안은 복제하지 않고 바로 수정하세요")
    if db.scalar(select(TherapistSessionPlan.id).where(TherapistSessionPlan.parent_plan_id == source.id,
                                                       TherapistSessionPlan.status == "DRAFT")):
        raise HTTPException(409, "이 계획의 수정 초안이 이미 있습니다")
    goal = _current_goal(db, child.id)
    evidence, recommendation = _snapshots(db, child, goal)
    plan = TherapistSessionPlan(child_id=child.id, therapist_id=therapist.id, goal_id=goal.id,
                                parent_plan_id=source.id, revision=source.revision + 1,
                                evidence_snapshot=evidence, recommendation_snapshot=recommendation,
                                **{field: getattr(source, field) for field in PLAN_FIELDS})
    db.add(plan)
    db.flush()
    for step in _steps(db, source.id):
        db.add(TherapistSessionPlanStep(plan_id=plan.id, step_order=step.step_order, step_type=step.step_type,
                                        activity=step.activity, target_level=step.target_level,
                                        parameters=dict(step.parameters)))
    _audit(db, therapist, "SESSION_PLAN_CLONED", plan.id)
    db.commit()
    return plan_data(db, plan)
