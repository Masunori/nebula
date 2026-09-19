"""Backwards-compatibility re-export module for schedule validation.

All implementation logic has been consolidated into schedule_validator.py.
"""

from __future__ import annotations

from .schedule_validator import (
    INTEGER_FIELDS,
    SCHEMAS,
    InvalidScheduleError,
    main,
    score_directory,
    validate_directory,
    validate_schedule,
)

__all__ = [
    "INTEGER_FIELDS",
    "SCHEMAS",
    "InvalidScheduleError",
    "main",
    "score_directory",
    "validate_directory",
    "validate_schedule",
]

if __name__ == "__main__":
    main()
