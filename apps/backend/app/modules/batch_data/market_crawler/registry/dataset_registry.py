"""Dataset registry loader for market crawler."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from app.modules.batch_data.market_crawler.domain.contracts import (
    DatasetDefinition,
    PipelineSpec,
    RetryPolicySpec,
    ScheduleSpec,
    SourceSpec,
    StorageSpec,
)


@dataclass
class DatasetRegistry:
    _datasets: dict[str, DatasetDefinition]

    def get(self, dataset_code: str) -> DatasetDefinition:
        if dataset_code not in self._datasets:
            raise KeyError(f"unknown dataset_code: {dataset_code}")
        return self._datasets[dataset_code]

    def values(self) -> list[DatasetDefinition]:
        return list(self._datasets.values())


def load_dataset_registry(
    datasets_dir: Path,
    parser_bindings: set[str],
    normalizer_bindings: set[str],
    validator_bindings: set[str],
) -> DatasetRegistry:
    datasets: dict[str, DatasetDefinition] = {}
    for path in sorted(datasets_dir.rglob("*.y*ml")):
        definition = _load_definition(path)
        if definition.dataset_code in datasets:
            raise ValueError(f"duplicate dataset_code: {definition.dataset_code}")
        _validate_bindings(
            definition=definition,
            parser_bindings=parser_bindings,
            normalizer_bindings=normalizer_bindings,
            validator_bindings=validator_bindings,
        )
        datasets[definition.dataset_code] = definition
    return DatasetRegistry(_datasets=datasets)


def _load_definition(path: Path) -> DatasetDefinition:
    raw_obj = _load_mapping(path)
    if not isinstance(raw_obj, dict):
        raise ValueError(f"invalid dataset config: {path}")

    def require_str(section: dict[str, object], key: str) -> str:
        value = section.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"missing required field '{key}' in {path}")
        return value.strip()

    source = _require_dict(raw_obj, "source", path)
    schedule = _require_dict(raw_obj, "schedule", path)
    retry_policy = _require_dict(schedule, "retry_policy", path)
    pipeline = _require_dict(raw_obj, "pipeline", path)
    storage = _require_dict(raw_obj, "storage", path)
    primary_key = storage.get("primary_key")
    if not isinstance(primary_key, list) or any(not isinstance(i, str) for i in primary_key):
        raise ValueError(f"invalid primary_key in {path}")

    return DatasetDefinition(
        dataset_code=require_str(raw_obj, "dataset_code"),
        dataset_name=require_str(raw_obj, "dataset_name"),
        source_name=require_str(raw_obj, "source_name"),
        enabled=bool(raw_obj.get("enabled", True)),
        source=SourceSpec(
            endpoint_template=require_str(source, "endpoint_template"),
            method=require_str(source, "method"),
            response_format=require_str(source, "response_format"),
            encoding=str(source.get("encoding", "utf-8")),
        ),
        schedule=ScheduleSpec(
            expected_publication_time=require_str(schedule, "expected_publication_time"),
            retry_policy=RetryPolicySpec(
                max_attempts=int(retry_policy.get("max_attempts", 3)),
                retry_interval_minutes=int(retry_policy.get("retry_interval_minutes", 15)),
            ),
        ),
        pipeline=PipelineSpec(
            parser=require_str(pipeline, "parser"),
            normalizer=require_str(pipeline, "normalizer"),
            validator=require_str(pipeline, "validator"),
            parser_version=require_str(pipeline, "parser_version"),
        ),
        storage=StorageSpec(
            table=require_str(storage, "table"),
            write_mode=require_str(storage, "write_mode"),
            primary_key=[str(item) for item in primary_key],
        ),
    )


def _load_mapping(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore
    except Exception:
        return _parse_simple_yaml(text)
    loaded = yaml.safe_load(text)
    if not isinstance(loaded, dict):
        raise ValueError(f"invalid dataset config: {path}")
    return loaded


def _require_dict(raw_obj: dict[str, object], key: str, path: Path) -> dict[str, object]:
    value = raw_obj.get(key)
    if not isinstance(value, dict):
        raise ValueError(f"missing required section '{key}' in {path}")
    return value


def _validate_bindings(
    definition: DatasetDefinition,
    parser_bindings: Iterable[str],
    normalizer_bindings: Iterable[str],
    validator_bindings: Iterable[str],
) -> None:
    parser_set = set(parser_bindings)
    normalizer_set = set(normalizer_bindings)
    validator_set = set(validator_bindings)
    if (
        definition.pipeline.parser not in parser_set
        or definition.pipeline.normalizer not in normalizer_set
        or definition.pipeline.validator not in validator_set
    ):
        raise ValueError(
            "unresolvable pipeline binding: "
            f"{definition.pipeline.parser}/{definition.pipeline.normalizer}/{definition.pipeline.validator}"
        )


def _parse_simple_yaml(text: str) -> dict[str, object]:
    lines = [
        line.rstrip()
        for line in text.splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    root: dict[str, object] = {}
    stack: list[tuple[int, object]] = [(-1, root)]

    for index, line in enumerate(lines):
        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()

        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        container = stack[-1][1]

        if stripped.startswith("- "):
            if not isinstance(container, list):
                raise ValueError("invalid yaml list structure")
            container.append(_parse_scalar(stripped[2:].strip()))
            continue

        if ":" not in stripped:
            raise ValueError("invalid yaml mapping line")

        key, raw_value = stripped.split(":", 1)
        key = key.strip()
        raw_value = raw_value.strip()

        if not isinstance(container, dict):
            raise ValueError("invalid yaml nesting")

        if raw_value:
            container[key] = _parse_scalar(raw_value)
            continue

        next_line = lines[index + 1] if index + 1 < len(lines) else ""
        next_stripped = next_line.strip()
        if next_stripped.startswith("- "):
            new_container: object = []
        else:
            new_container = {}
        container[key] = new_container
        stack.append((indent, new_container))

    return root


def _parse_scalar(raw: str) -> object:
    if raw.lower() == "true":
        return True
    if raw.lower() == "false":
        return False
    if raw.startswith("[") and raw.endswith("]"):
        inner = raw[1:-1].strip()
        if not inner:
            return []
        return [_parse_scalar(item.strip()) for item in inner.split(",")]
    if raw.isdigit():
        return int(raw)
    return raw
