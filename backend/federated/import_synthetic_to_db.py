from __future__ import annotations

import argparse
import json
from pathlib import Path

from backend.data_store import import_synthetic_dataset


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import a subset of synthetic federated data into MySQL for dashboard demos.")
    parser.add_argument("--data-dir", default="demo_data/federated", help="Synthetic dataset root containing hospital folders.")
    parser.add_argument("--doctor-id", default="DOC-4892", help="Doctor who should receive access to imported patients.")
    parser.add_argument("--max-patients-per-hospital", type=int, default=8, help="Number of synthetic patients to import from each hospital.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    summary = import_synthetic_dataset(
        dataset_root=Path(args.data_dir),
        doctor_public_id=args.doctor_id,
        max_patients_per_hospital=args.max_patients_per_hospital,
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
