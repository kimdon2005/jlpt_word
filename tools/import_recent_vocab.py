#!/usr/bin/env python3
"""Import the recent non-verb list and build the isolated verb chapter."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = APP_ROOT.parent
SOURCE_DIR = WORKSPACE_ROOT / "추가md파일"
NONVERB_SOURCE = SOURCE_DIR / "JLPT_after_recent_md_nonverbs.md"
VERB_SOURCE = SOURCE_DIR / "JLPT_after_recent_md_verbs_only.md"
WORDS_CSV = APP_ROOT / "data" / "jlpt_words.csv"
WORDS_JS = APP_ROOT / "data" / "jlpt_words_data.js"
VERBS_CSV = APP_ROOT / "data" / "jlpt_verbs.csv"
VERBS_JS = APP_ROOT / "data" / "jlpt_verbs_data.js"

WORD_FIELDS = [
    "id",
    "level",
    "deck",
    "number",
    "japanese",
    "reading",
    "meaning",
    "kanji_note",
    "example",
    "example_ko",
    "source",
]

VERB_FIELDS = WORD_FIELDS + ["chapter", "word_class", "memo"]


def clean(value: str) -> str:
    value = re.sub(r"\*\*(.*?)\*\*", r"\1", value.strip())
    return re.sub(r"\s+", " ", value)


def parse_recent_table(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    section = ""

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        heading = re.match(r"^##\s+(.*)$", line)
        if heading:
            section = heading.group(1).strip()
            continue
        if not line.startswith("|") or re.match(r"^\|\s*-+", line):
            continue

        cells = [clean(cell) for cell in line.strip("|").split("|")]
        if len(cells) < 5 or cells[0] == "단어":
            continue
        rows.append(
            {
                "japanese": cells[0],
                "reading": cells[1],
                "meaning": cells[2],
                "word_class": cells[3],
                "memo": cells[4],
                "section": section,
            }
        )

    if not rows:
        raise ValueError(f"No recent vocabulary rows found in {path}")
    return rows


def term_variants(value: str) -> set[str]:
    variants: set[str] = set()
    for part in re.split(r"[／/]", clean(value)):
        part = part.strip()
        if not part:
            continue
        variants.add(part)
        if part.endswith("だ") and len(part) > 1:
            variants.add(part[:-1])
    return variants


def merge_unique(current: str, added: str) -> str:
    values = [item.strip() for item in current.split(";") if item.strip()]
    if added and added not in values:
        values.append(added)
    return "; ".join(values)


def recent_note(row: dict[str, str]) -> str:
    note = f"[최근] 품사: {row['word_class']}"
    if row["memo"]:
        note += f" · {row['memo']}"
    return note


def merge_recent_note(current: str, row: dict[str, str]) -> str:
    """Replace a previous generated recent-note while preserving original notes."""
    memo = row["memo"].strip()
    values = []
    for item in (part.strip() for part in current.split(";")):
        if not item:
            continue
        if item.startswith(("품사:", "[최근] 품사:")):
            continue
        if memo and item == memo:
            continue
        if item not in values:
            values.append(item)
    values.append(recent_note(row))
    return "; ".join(values)


def read_words() -> list[dict[str, str]]:
    with WORDS_CSV.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def build_n3_lookup(words: list[dict[str, str]]) -> dict[tuple[str, str], dict[str, str]]:
    lookup: dict[tuple[str, str], dict[str, str]] = {}
    for word in words:
        if word["level"] != "추가":
            continue
        for japanese in term_variants(word["japanese"]):
            for reading in term_variants(word["reading"]):
                lookup.setdefault((japanese, reading), word)
    return lookup


def find_existing(
    lookup: dict[tuple[str, str], dict[str, str]], row: dict[str, str]
) -> dict[str, str] | None:
    for japanese in term_variants(row["japanese"]):
        for reading in term_variants(row["reading"]):
            existing = lookup.get((japanese, reading))
            if existing:
                return existing
    return None


def next_extra_id(words: list[dict[str, str]]) -> int:
    values = []
    for word in words:
        match = re.fullmatch(r"EXTRA-(\d+)", word["id"])
        if match:
            values.append(int(match.group(1)))
    return max(values, default=0) + 1


def merge_nonverbs(
    words: list[dict[str, str]], incoming: list[dict[str, str]]
) -> tuple[int, int]:
    lookup = build_n3_lookup(words)
    next_id = next_extra_id(words)
    next_number = max(int(word["number"]) for word in words if word["level"] == "추가") + 1
    imported = 0
    merged = 0

    for row in incoming:
        existing = find_existing(lookup, row)
        if existing:
            existing["meaning"] = row["meaning"]
            existing["kanji_note"] = merge_recent_note(existing["kanji_note"], row)
            existing["source"] = merge_unique(existing["source"], NONVERB_SOURCE.name)
            merged += 1
            continue

        word = {
            "id": f"EXTRA-{next_id:03d}",
            "level": "추가",
            "deck": str((next_number - 1) // 50 + 1),
            "number": str(next_number),
            "japanese": row["japanese"],
            "reading": row["reading"],
            "meaning": row["meaning"],
            "kanji_note": recent_note(row),
            "example": "",
            "example_ko": "",
            "source": NONVERB_SOURCE.name,
        }
        words.append(word)
        for japanese in term_variants(word["japanese"]):
            for reading in term_variants(word["reading"]):
                lookup[(japanese, reading)] = word
        next_id += 1
        next_number += 1
        imported += 1

    return imported, merged


def build_verb_chapter(incoming: list[dict[str, str]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for number, row in enumerate(incoming, start=1):
        rows.append(
            {
                "id": f"VERB-{number:03d}",
                "level": "동사",
                "deck": "1",
                "number": str(number),
                "japanese": row["japanese"],
                "reading": row["reading"],
                "meaning": row["meaning"],
                "kanji_note": recent_note(row),
                "example": "",
                "example_ko": "",
                "source": VERB_SOURCE.name,
                "chapter": "verbs",
                "word_class": row["word_class"],
                "memo": row["memo"],
            }
        )
    return rows


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_js(path: Path, variable: str, rows: list[dict[str, str]]) -> None:
    path.write_text(
        f"window.{variable} = " + json.dumps(rows, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


def main() -> None:
    nonverbs = parse_recent_table(NONVERB_SOURCE)
    verbs = parse_recent_table(VERB_SOURCE)
    words = read_words()
    imported, merged = merge_nonverbs(words, nonverbs)
    verb_rows = build_verb_chapter(verbs)

    write_csv(WORDS_CSV, words, WORD_FIELDS)
    write_js(WORDS_JS, "JLPT_WORDS", words)
    write_csv(VERBS_CSV, verb_rows, VERB_FIELDS)
    write_js(VERBS_JS, "JLPT_VERBS", verb_rows)

    print(
        f"Non-verbs: imported {imported}, merged {merged}. "
        f"Verb chapter: wrote {len(verb_rows)} entries."
    )


if __name__ == "__main__":
    main()
