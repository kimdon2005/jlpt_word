#!/usr/bin/env python3
"""Import a JLPT vocabulary Markdown table into the N3 app data."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "jlpt_words.csv"
JS_PATH = ROOT / "data" / "jlpt_words_data.js"
FIELDS = [
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


def parse_markdown(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    row_pattern = re.compile(
        r"^\|\s*(\d+)\s*\|\s*\*\*(.*?)\*\*\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$"
    )

    for line in path.read_text(encoding="utf-8").splitlines():
        match = row_pattern.match(line)
        if not match:
            continue
        source_number, japanese, reading, meaning, kanji_note = match.groups()
        rows.append(
            {
                "source_number": source_number,
                "japanese": japanese.strip(),
                "reading": reading.strip(),
                "meaning": meaning.strip(),
                "kanji_note": kanji_note.strip(),
            }
        )

    if not rows:
        raise ValueError(f"No vocabulary rows found in {path}")
    return rows


def read_words() -> list[dict[str, str]]:
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def next_extra_id(words: list[dict[str, str]]) -> int:
    numbers = []
    for word in words:
        match = re.fullmatch(r"EXTRA-(\d+)", word["id"])
        if match:
            numbers.append(int(match.group(1)))
    return max(numbers, default=0) + 1


def merge_source(current: str, added: str) -> str:
    sources = [item.strip() for item in current.split(";") if item.strip()]
    if added not in sources:
        sources.append(added)
    return "; ".join(sources)


def import_rows(
    words: list[dict[str, str]], incoming: list[dict[str, str]], source: str
) -> tuple[int, int]:
    n3_words = [word for word in words if word["level"] == "추가"]
    by_term = {(word["japanese"], word["reading"]): word for word in n3_words}
    next_number = max((int(word["number"]) for word in n3_words), default=0) + 1
    next_id = next_extra_id(words)
    imported = 0
    merged = 0

    for row in incoming:
        key = (row["japanese"], row["reading"])
        existing = by_term.get(key)
        if existing:
            existing["meaning"] = row["meaning"]
            existing["kanji_note"] = row["kanji_note"]
            existing["source"] = merge_source(existing["source"], source)
            merged += 1
            continue

        word = {
            "id": f"EXTRA-{next_id:03d}",
            "level": "추가",
            "deck": str((next_number - 1) // 20 + 1),
            "number": str(next_number),
            "japanese": row["japanese"],
            "reading": row["reading"],
            "meaning": row["meaning"],
            "kanji_note": row["kanji_note"],
            "example": "",
            "example_ko": "",
            "source": source,
        }
        words.append(word)
        by_term[key] = word
        imported += 1
        next_id += 1
        next_number += 1

    return imported, merged


def write_data(words: list[dict[str, str]]) -> None:
    for word in words:
        if word["level"] == "추가":
            word["deck"] = str((int(word["number"]) - 1) // 20 + 1)

    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(words)

    JS_PATH.write_text(
        "window.JLPT_WORDS = " + json.dumps(words, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("markdown", type=Path)
    args = parser.parse_args()

    markdown = args.markdown.resolve()
    incoming = parse_markdown(markdown)
    words = read_words()
    imported, merged = import_rows(words, incoming, markdown.name)
    write_data(words)
    print(
        f"Imported {imported} new N3 words and merged {merged} existing words "
        f"from {markdown.name}"
    )


if __name__ == "__main__":
    main()
