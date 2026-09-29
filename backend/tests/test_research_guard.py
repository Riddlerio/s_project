"""발음 연구(PHASE B)가 production과 섞이지 않고, 원본 데이터·가중치가 Git에 들어가지 않는지 확인한다."""

import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("path", [
    "research/data/aihub/child.wav", "research/cache/hf/part.parquet", "research/checkpoints/wavlm/model.safetensors",
    "research/outputs/audio/clip.wav", "models/private/weights.bin",
])
def test_raw_dataset_and_checkpoint_paths_are_git_ignored(path):
    result = subprocess.run(["git", "check-ignore", "-q", path], cwd=ROOT)
    assert result.returncode == 0, f"{path}가 .gitignore로 막혀 있지 않습니다"


def test_research_reports_are_not_ignored():
    result = subprocess.run(["git", "check-ignore", "-q", "research/pronunciation/reports/pronunciation_v1.md"], cwd=ROOT)
    assert result.returncode == 1


def test_production_requirements_have_no_ml_stack():
    names = {line.split("[")[0].split(">")[0].split("=")[0].split("<")[0].strip().lower()
             for line in (ROOT / "backend" / "requirements.txt").read_text(encoding="utf-8").splitlines() if line.strip()}
    assert not names & {"torch", "torchaudio", "transformers", "datasets", "librosa", "evaluate"}


def test_production_backend_does_not_import_research_code():
    for path in (ROOT / "backend" / "app").rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        assert "research" not in {part.strip() for line in (raw.strip() for raw in text.splitlines()) if line.startswith(("import ", "from "))
                                  for part in line.replace(",", " ").replace(".", " ").split()}, path
