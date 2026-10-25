#!/usr/bin/env python3
"""
make_data.py — builds the files of the website's data/ folder from the card repo.

Run it in the local copy of the card repo (the folder with 1997, 1998, ... in it):

    cd C:\\Users\\User\\Documents\\GitHub\\quartett
    python make_data.py

(or: python make_data.py "C:\\path\\to\\repo")

It makes, in a folder NEXT TO the repo  ->  ...\\GitHub\\quartett-site-data\\data\\ :

  grouped_cards_extended.json   the search index: per set (year folder / set folder) its cards with
                                card, name and — when filled in — country, info, info_left, info_right, info_image
  tree.json                     the repo's WHOLE file list, MINI and PROMO included (the website finds its card sets,
                                Mini and Promo sets in it)
  country_list.json             copied from the repo root (if it is there)
  <year>/<set>/<file>.json      a copy of every set's json, MINI/... and PROMO/... ones too
                                (the website reads these before GitHub)

and also writes grouped_cards_extended.json into the repo root (the website's fallback when data/ has none).

Then upload the CONTENTS of quartett-site-data\\data\\ into the website's quartett/data/ folder (overwrite).
Commit + push the repo first: tree.json lists what is committed in the repo, and the card pictures are loaded
from GitHub, so a set that is not pushed yet would show without pictures.

The search index is made from the year folders (4 digits) only; MINI and PROMO are not part of it.
Cards without a "card" code (e.g. empty {} entries at the end of a json) are skipped and reported.
"""

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

INFO_FIELDS = ["country", "info", "info_left", "info_right", "info_image"]   # added only when not empty
YEAR_RE = re.compile(r"^\d{4}$")
CODE_RE = re.compile(r"^([1-9])([A-D])$")


def find_repo():
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).resolve()
    here = Path(__file__).resolve().parent
    for cand in (Path.cwd(), here):
        if any(YEAR_RE.match(p.name) and p.is_dir() for p in cand.iterdir()):
            return cand
    sys.exit("No year folders (1997, 1998, ...) found here. Run this inside the card repo, or pass its path.")


def filled(v):
    return v is not None and str(v).strip() != ""


def read_json(path, problems):
    try:
        with open(path, "r", encoding="utf-8-sig") as f:   # utf-8-sig: also files saved with a BOM
            return json.load(f)
    except Exception as e:
        problems.append(f"{path}: not readable ({e})")
        return None


def git_files(repo):
    """Committed files (forward slashes), or None when git is not available / not a git repo."""
    try:
        out = subprocess.run(["git", "-C", str(repo), "ls-tree", "-r", "-z", "--name-only", "HEAD"],
                             capture_output=True, check=True).stdout.decode("utf-8")
        files = [p for p in out.split("\0") if p]
        dirty = subprocess.run(["git", "-C", str(repo), "status", "--porcelain"],
                               capture_output=True, check=True).stdout.decode("utf-8").strip()
        return files, dirty
    except Exception:
        return None, ""


def walk_files(repo):
    files = []
    for root, dirs, names in os.walk(repo):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for n in names:
            files.append(Path(root, n).relative_to(repo).as_posix())
    return sorted(files)


def main():
    repo = find_repo()
    out_root = repo.parent / (repo.name + "-site-data")
    data = out_root / "data"
    print(f"Card repo: {repo}")

    problems, notes = [], []
    grouped = []
    set_jsons = []          # (relative path, absolute path)
    total_cards = 0

    for year_dir in sorted(p for p in repo.iterdir() if p.is_dir() and YEAR_RE.match(p.name)):
        year = int(year_dir.name)
        for set_dir in sorted((p for p in year_dir.iterdir() if p.is_dir()), key=lambda p: p.name.lower()):
            jsons = sorted(p for p in set_dir.iterdir() if p.is_file() and p.suffix.lower() == ".json")
            label = f"{year}/{set_dir.name}"
            if not jsons:
                notes.append(f"{label}: no json file (not on the website)")
                continue
            if len(jsons) > 1:
                notes.append(f"{label}: {len(jsons)} json files, the website uses the first one: {jsons[0].name}")
            for j in jsons:
                set_jsons.append((j.relative_to(repo).as_posix(), j))
            d = read_json(jsons[0], problems)
            if not isinstance(d, dict) or not isinstance(d.get("cards"), list):
                problems.append(f"{label}: json has no \"cards\" list")
                continue
            # the website names a set after its folders; the json's own year / collection should agree
            if str(d.get("year")) != year_dir.name or (d.get("collection") or "") != set_dir.name:
                notes.append(f"{label}: json says year={d.get('year')!r} collection={d.get('collection')!r} (folder names are used)")

            cards, seen, empty, extra = [], set(), 0, 0
            for c in d["cards"]:
                if not isinstance(c, dict) or not filled(c.get("card")):
                    if isinstance(c, dict) and any(filled(v) for v in c.values()):
                        extra += 1          # e.g. a footnote line ("* 1A - Hybridsystem"): fine, just not a card
                    else:
                        empty += 1          # {} — can be deleted from the json
                    continue
                code = str(c["card"]).strip()
                if code in seen:
                    problems.append(f"{label}: card {code} appears twice")
                seen.add(code)
                if not CODE_RE.match(code.upper()):
                    notes.append(f"{label}: unusual card code {code!r}")
                e = {"card": code, "name": c.get("name")}
                for k in INFO_FIELDS:
                    if filled(c.get(k)):
                        e[k] = c[k]
                cards.append(e)
            if empty:
                notes.append(f"{label}: {empty} empty {{}} entr{'y' if empty == 1 else 'ies'} (can be deleted from the json)")
            if extra:
                notes.append(f"{label}: {extra} entr{'y' if extra == 1 else 'ies'} without a card code (footnotes?) left out of the search index")
            if not cards:
                problems.append(f"{label}: no cards")
                continue
            # pictures next to the json
            pics = {CODE_RE.match(p.stem[-2:].upper()).group(0) for p in set_dir.iterdir()
                    if p.is_file() and p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp") and CODE_RE.match(p.stem[-2:].upper())}
            missing = sorted(seen - pics, key=lambda x: (int(x[0]), x[1]))
            if missing:
                notes.append(f"{label}: no picture for {', '.join(missing)}")
            grouped.append({"year": year, "collection": set_dir.name, "cards": cards})
            total_cards += len(cards)

    # Mini and Promo sets: not in the search index, but their json files are copied too (MINI/Serie 1/<set>/x.json,
    # PROMO/<advert>/<set>/x.json — the website reads them from data/ like the regular sets)
    extra_sets = 0
    for top in ("MINI", "PROMO"):
        base = repo / top
        if not base.is_dir():
            notes.append(f"no {top} folder in the repo")
            continue
        for j in sorted(base.rglob("*.json")):
            if read_json(j, problems) is not None:
                set_jsons.append((j.relative_to(repo).as_posix(), j))
                extra_sets += 1

    if not grouped:
        sys.exit("No card sets found.")

    files, dirty = git_files(repo)
    own = ("make_data.py", "grouped_cards_extended.json")
    dirty = "\n".join(l for l in dirty.splitlines() if not l.strip().endswith(own))

    # ---- write
    if data.exists():
        shutil.rmtree(data)            # start clean: a set removed from the repo disappears from data/ too
    data.mkdir(parents=True)

    text = json.dumps(grouped, ensure_ascii=False, indent=2)
    (data / "grouped_cards_extended.json").write_text(text, encoding="utf-8")
    (repo / "grouped_cards_extended.json").write_text(text, encoding="utf-8")

    source = "git (committed files)"
    if files is None:
        files, source = walk_files(repo), "folder contents (git not found)"
    tree = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "paths": files}
    (data / "tree.json").write_text(json.dumps(tree, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    cl = repo / "country_list.json"
    if cl.is_file():
        shutil.copy2(cl, data / "country_list.json")
    else:
        notes.append("country_list.json not found in the repo root (not copied)")

    for rel, src in set_jsons:
        dst = data / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    # ---- report
    in_tree = {tuple(p.split("/")[:2]) for p in files if p.lower().endswith(".json") and YEAR_RE.match(p.split("/")[0])}
    not_committed = [f"{g['year']}/{g['collection']}" for g in grouped if (str(g["year"]), g["collection"]) not in in_tree]

    print(f"\n{len(grouped)} card sets, {total_cards} cards")
    print(f"Written to: {data}")
    print(f"  grouped_cards_extended.json  (also into the repo root)")
    mini_promo = sum(1 for p in files if p.startswith(("MINI/", "PROMO/")))
    print(f"  tree.json                    {len(files)} files ({mini_promo} of them MINI / PROMO), from {source}")
    print(f"  {len(set_jsons)} set json copies ({extra_sets} of them MINI / PROMO)")
    if not_committed:
        print("\nNOT COMMITTED in git yet (the website won't list them until you commit + push and run this again):")
        for s in not_committed:
            print("  - " + s)
    elif dirty and source.startswith("git"):
        print("\nNote: the repo has uncommitted changes — commit + push them so the website sees the same files.")
    if problems:
        print("\nPROBLEMS:")
        for p in problems:
            print("  ! " + p)
    if notes:
        print("\nNotes:")
        for n in notes:
            print("  - " + n)
    print(f"\nNext: upload everything inside {data} to the website's quartett/data/ folder (overwrite).")


if __name__ == "__main__":
    main()
