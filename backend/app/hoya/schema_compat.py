"""PR #4 초기 버전으로 만든 로컬 개발 DB의 hoya_chat_turns를 현재 구조로 옮긴다.

`Base.metadata.create_all()`은 이미 있는 표에 열을 추가하지 않는다. 이 표는 main에 없던 새 표이므로
정식 migration 도구 없이, SQLite 표준 방식(이름 변경 → 새 표 → 복사 → 이전 표 삭제)으로 자료를 보존한다.
"""
from sqlalchemy import inspect

from ..models import HoyaChatTurn

_COPIED = ("id", "session_id", "turn_index", "child_transcript", "hoya_text", "recognizer", "speech_evidence",
           "strategy", "target_words", "provider", "model_name", "fallback_reason", "created_at")


def upgrade_hoya_chat_schema(engine) -> bool:
    """옮겼으면 True. 이미 현재 구조이거나 표가 없으면 아무것도 하지 않는다."""
    if engine.dialect.name != "sqlite":
        return False
    inspector = inspect(engine)
    if "hoya_chat_turns" not in inspector.get_table_names():
        return False
    if "client_request_id" in {column["name"] for column in inspector.get_columns("hoya_chat_turns")}:
        return False
    columns = ", ".join(_COPIED)
    with engine.begin() as connection:
        connection.exec_driver_sql("ALTER TABLE hoya_chat_turns RENAME TO hoya_chat_turns_legacy")
        HoyaChatTurn.__table__.create(connection)
        # 이전 행은 모두 끝난 turn이다. 요청 ID가 없으므로 재시도 복구 대상이 아니다.
        connection.exec_driver_sql(
            f"INSERT INTO hoya_chat_turns ({columns}, updated_at, status, session_complete) "
            f"SELECT {columns}, created_at, 'COMPLETED', 0 FROM hoya_chat_turns_legacy")
        connection.exec_driver_sql("DROP TABLE hoya_chat_turns_legacy")
    return True
