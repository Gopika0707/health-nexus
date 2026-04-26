from __future__ import annotations

import argparse
import csv
import json
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path


CONDITIONS = [
    "Hypertension",
    "Type 2 Diabetes",
    "Coronary Artery Disease",
    "Arrhythmia",
    "Chronic Respiratory Risk",
    "Low Immediate Risk",
]

GENDERS = ["male", "female", "other"]
ECG_PATTERNS = ["normal", "normal sinus rhythm", "st depression", "irregular qrs", "atrial ectopy", "sinus tachycardia"]
IMAGE_LABELS = ["normal", "cardiomegaly", "suspected-infiltrate", "vascular-congestion"]
HOSPITAL_NAMES = [
    ("NODE-001", "Metro General Hospital", "Chennai"),
    ("NODE-002", "South City Care", "Bengaluru"),
    ("NODE-003", "Lakeside Multispeciality", "Hyderabad"),
    ("NODE-004", "Riverfront Medical Center", "Coimbatore"),
    ("NODE-005", "North Valley Clinic", "Pune"),
]


@dataclass
class GeneratorConfig:
    output_dir: Path
    hospitals: int
    patients_per_hospital: int
    time_steps: int
    seed: int
    image_size: int


def _risk_from_values(systolic_bp: int, diastolic_bp: int, sugar: int, cholesterol: int, oxygen: int, ecg: str) -> tuple[str, int]:
    score = 0
    if systolic_bp >= 160 or diastolic_bp >= 100:
        score += 30
    elif systolic_bp >= 140 or diastolic_bp >= 90:
        score += 20
    elif systolic_bp >= 130 or diastolic_bp >= 85:
        score += 10

    if sugar >= 180:
        score += 24
    elif sugar >= 126:
        score += 15
    elif sugar >= 100:
        score += 8

    if cholesterol >= 240:
        score += 18
    elif cholesterol >= 200:
        score += 10

    if oxygen < 92:
        score += 18
    elif oxygen < 95:
        score += 8

    if any(term in ecg for term in ("depression", "irregular", "ectopy", "tachy")):
        score += 20

    if score >= 85:
        return "Critical", score
    if score >= 65:
        return "High", score
    if score >= 40:
        return "Moderate", score
    return "Low", score


def _condition_from_risk(risk: str, sugar: int, systolic_bp: int, ecg: str) -> str:
    if sugar >= 140:
        return "Type 2 Diabetes"
    if any(term in ecg for term in ("irregular", "ectopy", "tachy")):
        return "Arrhythmia"
    if systolic_bp >= 145:
        return "Hypertension"
    if risk in {"High", "Critical"}:
        return "Coronary Artery Disease"
    return "Low Immediate Risk"


def _history_for_condition(condition: str) -> str:
    mapping = {
        "Hypertension": "hypertension, lifestyle risk",
        "Type 2 Diabetes": "type 2 diabetes, obesity risk",
        "Coronary Artery Disease": "hypertension, dyslipidemia",
        "Arrhythmia": "palpitations, rhythm irregularity",
        "Chronic Respiratory Risk": "smoking history, breathlessness",
        "Low Immediate Risk": "routine preventive follow-up",
    }
    return mapping.get(condition, "routine preventive follow-up")


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _clean_directory(directory: Path) -> None:
    if not directory.exists():
        return
    for child in directory.rglob("*"):
        if child.is_file():
            child.unlink()
    for child in sorted(directory.rglob("*"), reverse=True):
        if child.is_dir():
            child.rmdir()


def _clamp(value: float, lower: int = 0, upper: int = 255) -> int:
    return max(lower, min(upper, int(value)))


def _empty_canvas(size: int, base: int = 18) -> list[list[int]]:
    return [[base for _ in range(size)] for _ in range(size)]


def _add_circle(canvas: list[list[int]], cx: float, cy: float, radius: float, intensity: int) -> None:
    size = len(canvas)
    for y in range(size):
        for x in range(size):
            distance = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            if distance <= radius:
                falloff = 1.0 - (distance / max(radius, 1))
                canvas[y][x] = _clamp(canvas[y][x] + intensity * falloff)


def _add_band(canvas: list[list[int]], y_center: float, thickness: int, intensity: int) -> None:
    size = len(canvas)
    for y in range(size):
        distance = abs(y - y_center)
        if distance <= thickness:
            for x in range(size):
                falloff = 1.0 - (distance / max(thickness, 1))
                canvas[y][x] = _clamp(canvas[y][x] + intensity * falloff * (0.5 + x / (2 * size)))


def _add_branching_lines(canvas: list[list[int]], rng: random.Random, intensity: int) -> None:
    size = len(canvas)
    for branch in range(5):
        x = size // 2 + rng.randint(-3, 3)
        y = size // 3 + branch * 2
        for _ in range(size // 2):
            if 0 <= x < size and 0 <= y < size:
                canvas[y][x] = _clamp(canvas[y][x] + intensity)
            x += rng.choice([-1, 0, 1])
            y += 1


def _add_noise(canvas: list[list[int]], rng: random.Random, magnitude: int = 8) -> None:
    size = len(canvas)
    for y in range(size):
        for x in range(size):
            canvas[y][x] = _clamp(canvas[y][x] + rng.randint(-magnitude, magnitude))


def _generate_image_pixels(label: str, diagnosis_label: int, size: int, seed: int) -> list[list[int]]:
    rng = random.Random(seed)
    canvas = _empty_canvas(size, base=20 + diagnosis_label * 8)
    mid = size / 2

    _add_circle(canvas, mid - size * 0.18, mid, size * 0.22, 55)
    _add_circle(canvas, mid + size * 0.18, mid, size * 0.22, 55)

    if label == "cardiomegaly":
        _add_circle(canvas, mid, mid + size * 0.06, size * 0.24, 95)
    elif label == "suspected-infiltrate":
        for _ in range(3):
            _add_circle(
                canvas,
                mid + rng.randint(-10, 10),
                mid + rng.randint(-8, 10),
                rng.randint(size // 10, size // 6),
                rng.randint(60, 110),
            )
    elif label == "vascular-congestion":
        _add_branching_lines(canvas, rng, 85)
        _add_band(canvas, mid + size * 0.08, 4, 45)
    else:
        _add_band(canvas, mid + size * 0.14, 3, 20)

    _add_noise(canvas, rng, magnitude=10 if diagnosis_label else 6)
    return canvas


def _write_pgm(path: Path, pixels: list[list[int]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    height = len(pixels)
    width = len(pixels[0]) if pixels else 0
    with path.open("w", encoding="utf-8") as handle:
        handle.write(f"P2\n{width} {height}\n255\n")
        for row in pixels:
            handle.write(" ".join(str(value) for value in row))
            handle.write("\n")


def generate_dataset(config: GeneratorConfig) -> dict[str, object]:
    rng = random.Random(config.seed)
    generated_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    manifest_hospitals: list[dict[str, object]] = []
    config.output_dir.mkdir(parents=True, exist_ok=True)

    for idx in range(config.hospitals):
        node_id, hospital_name, location = HOSPITAL_NAMES[idx % len(HOSPITAL_NAMES)]
        hospital_dir = config.output_dir / f"hospital_{idx + 1}_{node_id.lower()}"
        _clean_directory(hospital_dir)
        images_dir = hospital_dir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        patient_rows: list[dict[str, object]] = []
        vitals_rows: list[dict[str, object]] = []
        image_rows: list[dict[str, object]] = []

        base_date = datetime.utcnow() - timedelta(days=config.time_steps)
        for patient_idx in range(config.patients_per_hospital):
            public_id = f"PNX-{idx + 1:02d}{patient_idx + 1:04d}"
            age = rng.randint(24, 82)
            gender = rng.choice(GENDERS)
            systolic_bp = rng.randint(110, 178)
            diastolic_bp = rng.randint(68, 110)
            sugar = rng.randint(82, 228)
            cholesterol = rng.randint(150, 285)
            heart_rate = rng.randint(58, 118)
            oxygen = rng.randint(90, 100)
            ecg = rng.choice(ECG_PATTERNS)
            risk, score = _risk_from_values(systolic_bp, diastolic_bp, sugar, cholesterol, oxygen, ecg)
            condition = _condition_from_risk(risk, sugar, systolic_bp, ecg)
            diagnosis_label = 1 if risk in {"High", "Critical"} else 0
            image_label = rng.choice(IMAGE_LABELS if diagnosis_label else IMAGE_LABELS[:2])

            patient_rows.append(
                {
                    "patient_id": public_id,
                    "hospital_node": node_id,
                    "age": age,
                    "gender": gender,
                    "systolic_bp": systolic_bp,
                    "diastolic_bp": diastolic_bp,
                    "sugar_level": sugar,
                    "cholesterol": cholesterol,
                    "ecg": ecg,
                    "heart_rate": heart_rate,
                    "oxygen_level": oxygen,
                    "previous_disease_history": _history_for_condition(condition),
                    "condition": condition,
                    "risk_level": risk,
                    "risk_score": score,
                    "diagnosis_label": diagnosis_label,
                }
            )

            for step in range(config.time_steps):
                observed_at = (base_date + timedelta(days=step)).replace(microsecond=0).isoformat() + "Z"
                trend = step / max(config.time_steps - 1, 1)
                vitals_rows.append(
                    {
                        "patient_id": public_id,
                        "hospital_node": node_id,
                        "timestamp": observed_at,
                        "heart_rate": max(48, int(heart_rate + rng.randint(-6, 6) + trend * (4 if diagnosis_label else 1))),
                        "systolic_bp": max(90, int(systolic_bp + rng.randint(-8, 8) + trend * (6 if diagnosis_label else 2))),
                        "diastolic_bp": max(55, int(diastolic_bp + rng.randint(-5, 5) + trend * (4 if diagnosis_label else 1))),
                        "blood_sugar": max(70, int(sugar + rng.randint(-12, 12) + trend * (10 if "Diabetes" in condition else 2))),
                        "spo2": max(86, min(100, int(oxygen + rng.randint(-2, 2) - trend * (2 if condition == "Chronic Respiratory Risk" else 0)))),
                        "temperature": round(97.0 + rng.random() * 2.4, 1),
                        "bmi": round(19.0 + rng.random() * 12.0, 1),
                        "respiratory_rate": rng.randint(12, 24),
                        "condition_label": condition,
                        "risk_level": risk,
                    }
                )

            image_file = f"{public_id.lower()}_{image_label}.pgm"
            pixel_seed = config.seed * 10_000 + idx * 1_000 + patient_idx
            pixels = _generate_image_pixels(image_label, diagnosis_label, config.image_size, pixel_seed)
            image_rows.append(
                {
                    "patient_id": public_id,
                    "hospital_node": node_id,
                    "image_path": f"images/{image_file}",
                    "image_label": image_label,
                    "modality": "X-Ray",
                    "diagnosis_label": diagnosis_label,
                    "width": config.image_size,
                    "height": config.image_size,
                }
            )
            _write_pgm(images_dir / image_file, pixels)

        _write_csv(
            hospital_dir / "patients.csv",
            [
                "patient_id", "hospital_node", "age", "gender", "systolic_bp", "diastolic_bp",
                "sugar_level", "cholesterol", "ecg", "heart_rate", "oxygen_level",
                "previous_disease_history", "condition", "risk_level", "risk_score", "diagnosis_label",
            ],
            patient_rows,
        )
        _write_csv(
            hospital_dir / "vitals_timeseries.csv",
            [
                "patient_id", "hospital_node", "timestamp", "heart_rate", "systolic_bp", "diastolic_bp",
                "blood_sugar", "spo2", "temperature", "bmi", "respiratory_rate",
                "condition_label", "risk_level",
            ],
            vitals_rows,
        )
        _write_csv(
            hospital_dir / "image_manifest.csv",
            ["patient_id", "hospital_node", "image_path", "image_label", "modality", "diagnosis_label", "width", "height"],
            image_rows,
        )

        manifest_hospitals.append(
            {
                "node_id": node_id,
                "hospital_name": hospital_name,
                "location": location,
                "folder": hospital_dir.name,
                "patient_count": len(patient_rows),
                "timeseries_rows": len(vitals_rows),
                "image_rows": len(image_rows),
            }
        )

    manifest = {
        "generated_at": generated_at,
        "seed": config.seed,
        "hospitals": manifest_hospitals,
        "patients_per_hospital": config.patients_per_hospital,
        "time_steps": config.time_steps,
        "image_size": config.image_size,
        "files": ["patients.csv", "vitals_timeseries.csv", "image_manifest.csv"],
    }
    (config.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def parse_args() -> GeneratorConfig:
    parser = argparse.ArgumentParser(description="Generate synthetic hospital-wise federated learning datasets.")
    parser.add_argument("--output-dir", default="demo_data/federated", help="Directory for generated hospital folders.")
    parser.add_argument("--hospitals", type=int, default=3, help="Number of hospital nodes to generate.")
    parser.add_argument("--patients-per-hospital", type=int, default=120, help="Patients to generate for each hospital.")
    parser.add_argument("--time-steps", type=int, default=30, help="Vital-sign observations per patient.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducible generation.")
    parser.add_argument("--image-size", type=int, default=64, help="Width and height for synthetic grayscale images.")
    args = parser.parse_args()
    return GeneratorConfig(
        output_dir=Path(args.output_dir),
        hospitals=args.hospitals,
        patients_per_hospital=args.patients_per_hospital,
        time_steps=args.time_steps,
        seed=args.seed,
        image_size=args.image_size,
    )


if __name__ == "__main__":
    config = parse_args()
    manifest = generate_dataset(config)
    print(json.dumps(manifest, indent=2))
