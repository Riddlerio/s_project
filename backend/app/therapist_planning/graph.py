"""Therapist Planning Graph. 한 방향 6단계이며 루프·재시도·도구 호출·다중 에이전트는 없다.

LLM은 GenerateSummary 한 곳에서만, 설정된 경우에만 부른다. 나머지는 모두 결정적 Python이다.
DB 세션과 아동 id는 state가 아니라 config로 넘긴다. 선택적 LangSmith 추적을 켜도 state에는
이름·play code·transcript·치료사 메모가 없다.
"""
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from ..clinical.activity_recommendation import propose_activity
from ..models import TrainingGoal
from .evidence import calculate_metrics, filter_verified, latest_decisions, load_observations, recent_real_sessions
from .proposal import propose_plan
from .summary import build_context, finalize, llm_summary, template_summary, validate_summary


class PlanningDeps:
    """state 밖에서 노드에 넘기는 의존성. 추적 metadata로 직렬화되지 않는다."""

    def __init__(self, db, child_id: str, use_llm: bool = True, llm_client=None):
        self.db, self.child_id, self.use_llm, self.llm_client = db, child_id, use_llm, llm_client
        self.observations: list = []
        self.decisions: dict = {}
        self.sessions: list = []


class PlanningState(TypedDict, total=False):
    goal: dict
    verified: list[dict]
    review: dict
    metrics: dict
    activity_hint: str | None
    proposal: dict
    summary: dict
    summary_source: str
    rejection: str | None


def goal_view(goal: TrainingGoal) -> dict:
    """계획에 필요한 목표 필드만. note·child_id는 담지 않는다."""
    return {"goalId": goal.id, "version": goal.version, "targetPhoneme": goal.target_phoneme,
            "wordPosition": goal.word_position, "level": goal.level, "minLevel": goal.min_level,
            "sessionDurationMin": goal.session_duration_min, "repetitionTarget": goal.repetition_target,
            "preferredCue": goal.preferred_cue, "priorityTargets": list(goal.priority_targets or []),
            "excludedWords": list(goal.excluded_words or [])}


def _deps(config) -> PlanningDeps:
    return config["configurable"]["deps"]


def load_planning_context(state: PlanningState, config) -> PlanningState:
    deps = _deps(config)
    deps.sessions = recent_real_sessions(deps.db, deps.child_id)
    deps.observations = load_observations(deps.db, deps.child_id, deps.sessions)
    deps.decisions = latest_decisions(deps.db, deps.observations)
    return {}


def filter_verified_evidence(state: PlanningState, config) -> PlanningState:
    deps = _deps(config)
    verified, review = filter_verified(deps.observations, deps.decisions)
    return {"verified": verified, "review": review}


def calculate(state: PlanningState, config) -> PlanningState:
    deps = _deps(config)
    return {"metrics": calculate_metrics(deps.observations, state["verified"], state["review"], deps.sessions)}


def generate_plan_proposal(state: PlanningState, config) -> PlanningState:
    deps = _deps(config)
    hint = propose_activity(deps.db, deps.child_id) if state["metrics"]["sufficient"] else None
    # 활동 제안은 화면에 보인 근거 범위(최근 실제 회기 5개) 안의 관찰에만 기댈 때만 쓴다.
    window = {row["observationId"] for row in state["verified"]}
    in_window = hint and all(item["observationId"] in window for item in hint["evidence"])
    activity = hint["activity"] if in_window else None
    return {"activity_hint": activity, "proposal": propose_plan(state["goal"], state["metrics"], activity)}


def generate_summary(state: PlanningState, config) -> PlanningState:
    deps = _deps(config)
    context = build_context(state["goal"], state["metrics"], state["proposal"])
    draft = llm_summary(context, deps.llm_client) if deps.use_llm else None
    if draft is None:
        return {"summary": template_summary(state["metrics"], state["proposal"]).model_dump(by_alias=True),
                "summary_source": "TEMPLATE", "rejection": None}
    return {"summary": draft.model_dump(by_alias=True), "summary_source": "LLM", "rejection": None}


def validate_output(state: PlanningState, config) -> PlanningState:
    if state["summary_source"] != "LLM":
        return {}
    from .schemas import SummaryOutput
    context = build_context(state["goal"], state["metrics"], state["proposal"])
    draft = SummaryOutput.model_validate(state["summary"])
    reason = validate_summary(draft, context)
    fallback = template_summary(state["metrics"], state["proposal"])
    if reason is None:
        return {"summary": finalize(draft, fallback).model_dump(by_alias=True)}
    # 검증을 통과하지 못한 LLM 문장은 보여 주지 않는다. 다시 부르지 않고 템플릿으로 대체한다.
    return {"summary": fallback.model_dump(by_alias=True), "summary_source": "TEMPLATE", "rejection": reason}


def build_graph():
    graph = StateGraph(PlanningState)
    nodes = [("LoadPlanningContext", load_planning_context), ("FilterVerifiedEvidence", filter_verified_evidence),
             ("CalculateMetrics", calculate), ("GeneratePlanProposal", generate_plan_proposal),
             ("GenerateSummary", generate_summary), ("ValidateOutput", validate_output)]
    previous = START
    for name, node in nodes:
        graph.add_node(name, node)
        graph.add_edge(previous, name)
        previous = name
    graph.add_edge(previous, END)
    return graph.compile()


PLANNING_GRAPH = build_graph()


def run_planning(db, child_id: str, goal: TrainingGoal, use_llm: bool = True, llm_client=None) -> dict[str, Any]:
    deps = PlanningDeps(db, child_id, use_llm, llm_client)
    state = PLANNING_GRAPH.invoke({"goal": goal_view(goal)}, config={"configurable": {"deps": deps}})
    return {**state, "observations": deps.observations}
