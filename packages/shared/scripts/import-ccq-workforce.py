#!/usr/bin/env python3
"""Importe les effectifs CCQ du tableau C 21 dans ccq-workforce.ts.

Usage:
  python scripts/import-ccq-workforce.py
  python scripts/import-ccq-workforce.py "https://www.ccq.org/.../C21.pdf?rev=..."
  python scripts/import-ccq-workforce.py C21.pdf
"""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen

try:
    import pdfplumber
except ImportError as exc:  # pragma: no cover - message d'environnement
    raise SystemExit(
        "Le module Python 'pdfplumber' est requis pour lire le PDF CCQ.\n"
        "Installe-le avec: python -m pip install pdfplumber"
    ) from exc


DEFAULT_SOURCE = (
    "https://www.ccq.org/-/media/Project/Ccq/Ccq-Website/PDF/Recherche/"
    "StatistiquesHistoriques/2025/C21.pdf?rev=2b528bf7a0aa41a2b4c98076964c7dfe"
)
WORKFORCE_PATH = Path(__file__).resolve().parents[1] / "src" / "ccq-workforce.ts"
TARGET_YEAR = 2025

TRADE_LABELS: dict[str, list[str]] = {
    "briqueteur-macon": ["Briqueteur-maçon"],
    "calorifugeur": ["Calorifugeur"],
    "carreleur": ["Carreleur"],
    "charpentier-menuisier": ["Charpentier-menuisier"],
    "chaudronnier": ["Chaudronnier"],
    "cimentier-applicateur": ["Cimentier-applicateur"],
    "couvreur": ["Couvreur"],
    "contremaitre": [],
    "electricien": ["Électricien"],
    "ferblantier": ["Ferblantier"],
    "ferrailleur": ["Ferrailleur"],
    "frigoriste": ["Frigoriste"],
    "grutier": ["Grutier"],
    "manoeuvre-specialise": [],
    "manoeuvre": ["Manœuvre"],
    "mecanicien-ascenseur": ["Mécanicien d'ascenseur"],
    "mecanicien-protection-incendie": ["Mécanicien en protection-incendie"],
    "mecanicien-chantier": ["Mécanicien de chantier"],
    "monteur-acier": ["Monteur-assembleur"],
    "monteur-vitrier": ["Monteur-mécanicien (vitrier)"],
    "operateur-equipement-lourd": ["Opérateur de pelles", "Opérateur d'équipement lourd"],
    "peintre": ["Peintre"],
    "platrier": ["Plâtrier"],
    "plombier": ["Tuyauteur"],
    "poseur-revetements-souples": ["Poseur de revêtements souples"],
    "poseur-systemes-interieurs": ["Poseur de systèmes intérieurs"],
    "serrurier-batiment": [],
    "tuyauteur": ["Tuyauteur"],
    "soudeur": ["Soudeur"],
}


def read_pdf_source(source: str) -> bytes:
    if source.startswith(("http://", "https://")):
        req = Request(source, headers={"User-Agent": "Mozilla/5.0 JobCCQ workforce importer"})
        with urlopen(req, timeout=45) as response:
            content_type = response.headers.get("content-type", "")
            data = response.read()
            if not data.startswith(b"%PDF"):
                raise RuntimeError(f"La source ne retourne pas un PDF: {content_type}")
            return data

    data = Path(source).read_bytes()
    if not data.startswith(b"%PDF"):
        raise RuntimeError(f"Le fichier n'est pas un PDF: {source}")
    return data


def extract_pdf_rows(pdf_bytes: bytes, year: int = TARGET_YEAR) -> dict[str, int]:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = Path(tmp.name)

    try:
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                for table in page.extract_tables():
                    header = table[0]
                    if not header or "Métier/occupation" not in header:
                        continue
                    year_index = header.index(str(year))
                    for row in table[1:]:
                        label_cell = row[0] or ""
                        if "Briqueteur-maçon" not in label_cell:
                            continue
                        labels = [part.strip() for part in label_cell.splitlines() if part.strip()]
                        values = [
                            parse_number(part)
                            for part in (row[year_index] or "").splitlines()
                            if re.fullmatch(r"\d{1,3}(?: \d{3})*|\d+", part.strip())
                        ]
                        if len(values) != len(labels):
                            raise RuntimeError(
                                f"Table CCQ mal alignée pour {year}: {len(labels)} libellés, {len(values)} valeurs"
                            )
                        return dict(zip(labels, values))
        raise RuntimeError(f"Table C21 introuvable dans le PDF CCQ pour {year}")
    finally:
        tmp_path.unlink(missing_ok=True)


def parse_number(value: str) -> int:
    return int(value.replace(" ", ""))


def extract_workforce(rows: dict[str, int]) -> dict[str, int | None]:
    workforce: dict[str, int | None] = {}
    for trade_id, labels in TRADE_LABELS.items():
        if not labels:
            workforce[trade_id] = None
            continue
        try:
            workforce[trade_id] = sum(rows[label] for label in labels)
        except KeyError as exc:
            raise RuntimeError(f"Ligne introuvable dans le PDF CCQ: {exc.args[0]}") from exc
    return workforce


def format_value(value: int | None) -> str:
    return "null" if value is None else str(value)


def render_table(workforce: dict[str, int | None]) -> str:
    lines = ["export const CCQ_WORKFORCE: Readonly<Record<string, number | null>> = {"]
    for trade_id in TRADE_LABELS:
        value = format_value(workforce[trade_id])
        key = trade_id if re.fullmatch(r"[a-z][a-z0-9]*", trade_id) else f'"{trade_id}"'
        lines.append(f"  {key}: {value},")
    lines.append("};")
    return "\n".join(lines)


def update_workforce_file(workforce: dict[str, int | None]) -> None:
    source = WORKFORCE_PATH.read_text(encoding="utf-8")
    replacement = render_table(workforce)
    updated = re.sub(
        r"export const CCQ_WORKFORCE: Readonly<Record<string, number \| null>> = \{.*?\n\};",
        replacement,
        source,
        flags=re.S,
    )
    if updated == source:
        raise RuntimeError(f"Table CCQ_WORKFORCE introuvable dans {WORKFORCE_PATH}")
    WORKFORCE_PATH.write_text(updated, encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?", default=DEFAULT_SOURCE, help="URL ou chemin du PDF C21")
    parser.add_argument("--check", action="store_true", help="Valide l'extraction sans modifier ccq-workforce.ts")
    args = parser.parse_args()

    rows = extract_pdf_rows(read_pdf_source(args.source))
    workforce = extract_workforce(rows)
    if not args.check:
        update_workforce_file(workforce)

    known = sum(value is not None for value in workforce.values())
    print(f"CCQ {TARGET_YEAR}: {known}/{len(workforce)} effectifs extraits depuis C21")
    for trade_id, value in workforce.items():
        print(f"{trade_id}: {format_value(value)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
