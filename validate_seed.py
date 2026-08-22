"""
Seed validation script — run after any change to backend/data/seed_*.json.
Loads each seed file through the Pydantic models exactly as the seeder does,
catching missing required fields (createdAt, updatedAt, id, etc.) before they
cause silent failures at runtime.

Usage:
    python validate_seed.py            # validates all seed files
    python validate_seed.py seed_mds_d2c.json   # validates one file by name
"""
import sys
import json
import os
import glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.models.graph import Entity, Relationship

SEED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "data")

def validate_file(path: str) -> bool:
    filename = os.path.basename(path)
    with open(path) as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"[FAIL] {filename}: invalid JSON — {e}")
            return False

    entities = data.get("entities", {})
    relationships = data.get("relationships", {})

    if isinstance(entities, list):
        entities = {e["id"]: e for e in entities}
    if isinstance(relationships, list):
        relationships = {r["id"]: r for r in relationships}

    errors = []

    for eid, e in entities.items():
        try:
            Entity(**e)
        except Exception as ex:
            errors.append(f"  Entity '{eid}': {ex}")

    for rid, r in relationships.items():
        try:
            Relationship(**r)
        except Exception as ex:
            errors.append(f"  Relationship '{rid}': {ex}")

    if errors:
        print(f"[FAIL] {filename} — {len(errors)} error(s):")
        for err in errors:
            print(err)
        return False

    print(f"[ OK ] {filename} — {len(entities)} entities, {len(relationships)} relationships")
    return True


def main():
    if len(sys.argv) > 1:
        targets = [os.path.join(SEED_DIR, sys.argv[1]) if not os.path.isabs(sys.argv[1]) else sys.argv[1]]
    else:
        targets = sorted(glob.glob(os.path.join(SEED_DIR, "seed_*.json")))

    if not targets:
        print("No seed files found.")
        sys.exit(1)

    results = [validate_file(t) for t in targets]

    print()
    if all(results):
        print("All seed files valid.")
    else:
        print(f"{results.count(False)} file(s) failed validation.")
        sys.exit(1)


if __name__ == "__main__":
    main()
