from __future__ import annotations

import argparse
import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np

from backend.federated.aggregator import FedAvgAggregator, WeightUpdate


ECG_TERMS = ["normal", "sinus", "depression", "irregular", "ectopy", "tachycardia"]
CONDITION_TERMS = [
    "Hypertension",
    "Type 2 Diabetes",
    "Coronary Artery Disease",
    "Arrhythmia",
    "Chronic Respiratory Risk",
    "Low Immediate Risk",
]


@dataclass
class HospitalDataset:
    node_id: str
    path: Path
    features: np.ndarray
    labels: np.ndarray


def sigmoid(values: np.ndarray) -> np.ndarray:
    clipped = np.clip(values, -40, 40)
    return 1.0 / (1.0 + np.exp(-clipped))


def encode_row(row: dict[str, str]) -> np.ndarray:
    numeric = np.array(
        [
            float(row["age"]) / 100.0,
            float(row["systolic_bp"]) / 200.0,
            float(row["diastolic_bp"]) / 140.0,
            float(row["sugar_level"]) / 300.0,
            float(row["cholesterol"]) / 320.0,
            float(row["heart_rate"]) / 150.0,
            float(row["oxygen_level"]) / 100.0,
            float(row["risk_score"]) / 100.0,
        ],
        dtype=np.float64,
    )
    gender = row["gender"].strip().lower()
    gender_features = np.array(
        [1.0 if gender == "male" else 0.0, 1.0 if gender == "female" else 0.0, 1.0 if gender == "other" else 0.0],
        dtype=np.float64,
    )
    ecg = row["ecg"].strip().lower()
    ecg_features = np.array([1.0 if term in ecg else 0.0 for term in ECG_TERMS], dtype=np.float64)
    condition_features = np.array([1.0 if row["condition"] == term else 0.0 for term in CONDITION_TERMS], dtype=np.float64)
    return np.concatenate([numeric, gender_features, ecg_features, condition_features])


def load_hospital_dataset(folder: Path) -> HospitalDataset:
    csv_path = folder / "patients.csv"
    rows: list[dict[str, str]] = []
    with csv_path.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows.extend(reader)

    if not rows:
        raise ValueError(f"No rows found in {csv_path}")

    features = np.vstack([encode_row(row) for row in rows])
    labels = np.array([float(row["diagnosis_label"]) for row in rows], dtype=np.float64)
    node_id = rows[0]["hospital_node"]
    return HospitalDataset(node_id=node_id, path=folder, features=features, labels=labels)


def predict_probabilities(features: np.ndarray, weights: np.ndarray, bias: float) -> np.ndarray:
    return sigmoid(features @ weights + bias)


def binary_accuracy(features: np.ndarray, labels: np.ndarray, weights: np.ndarray, bias: float) -> float:
    predictions = predict_probabilities(features, weights, bias) >= 0.5
    return float(np.mean(predictions == labels))


def local_train(
    dataset: HospitalDataset,
    global_weights: np.ndarray,
    global_bias: float,
    learning_rate: float,
    local_epochs: int,
) -> tuple[np.ndarray, float, float, float]:
    weights = global_weights.copy()
    bias = float(global_bias)

    for _ in range(local_epochs):
        probabilities = predict_probabilities(dataset.features, weights, bias)
        errors = probabilities - dataset.labels
        weight_gradient = (dataset.features.T @ errors) / len(dataset.labels)
        bias_gradient = float(np.mean(errors))
        weights -= learning_rate * weight_gradient
        bias -= learning_rate * bias_gradient

    accuracy = binary_accuracy(dataset.features, dataset.labels, weights, bias)
    loss = binary_loss(dataset.features, dataset.labels, weights, bias)
    return weights, bias, accuracy, loss


def fit_federated(
    datasets: list[HospitalDataset],
    rounds: int,
    learning_rate: float,
    local_epochs: int,
    noise_multiplier: float,
) -> dict[str, object]:
    feature_count = datasets[0].features.shape[1]
    global_weights = np.zeros(feature_count, dtype=np.float64)
    global_bias = 0.0
    aggregator = FedAvgAggregator({"noise_multiplier": noise_multiplier, "max_grad_norm": 1.0})
    history: list[dict[str, object]] = []

    all_features = np.vstack([dataset.features for dataset in datasets])
    all_labels = np.concatenate([dataset.labels for dataset in datasets])

    for round_number in range(1, rounds + 1):
        updates: list[WeightUpdate] = []
        local_metrics: list[dict[str, object]] = []

        for dataset in datasets:
            local_weights, local_bias, local_accuracy, local_loss = local_train(
                dataset=dataset,
                global_weights=global_weights,
                global_bias=global_bias,
                learning_rate=learning_rate,
                local_epochs=local_epochs,
            )
            updates.append(
                WeightUpdate(
                    node_id=dataset.node_id,
                    round_number=round_number,
                    weights=[local_weights, np.array([local_bias], dtype=np.float64)],
                    num_samples=len(dataset.labels),
                    dp_epsilon=1.0,
                    dp_delta=1e-5,
                    timestamp="synthetic",
                )
            )
            local_metrics.append(
                {
                    "node_id": dataset.node_id,
                    "samples": len(dataset.labels),
                    "accuracy": round(local_accuracy * 100, 2),
                    "loss": round(local_loss, 4),
                }
            )

        aggregation = aggregator.aggregate(updates, [global_weights, np.array([global_bias], dtype=np.float64)])
        global_weights = aggregation.global_weights[0]
        global_bias = float(aggregation.global_weights[1][0])
        global_accuracy = binary_accuracy(all_features, all_labels, global_weights, global_bias)
        global_loss = binary_loss(all_features, all_labels, global_weights, global_bias)

        history.append(
            {
                "round_number": round_number,
                "global_accuracy": round(global_accuracy * 100, 2),
                "global_loss": round(global_loss, 4),
                "nodes_participated": len(datasets),
                "local_metrics": local_metrics,
            }
        )

    return {
        "feature_count": feature_count,
        "weights": global_weights.tolist(),
        "bias": global_bias,
        "history": history,
        "final_accuracy": round(binary_accuracy(all_features, all_labels, global_weights, global_bias) * 100, 2),
        "final_loss": round(binary_loss(all_features, all_labels, global_weights, global_bias), 4),
    }


def binary_loss(features: np.ndarray, labels: np.ndarray, weights: np.ndarray, bias: float) -> float:
    probabilities = predict_probabilities(features, weights, bias)
    probabilities = np.clip(probabilities, 1e-7, 1 - 1e-7)
    return float(-np.mean(labels * np.log(probabilities) + (1 - labels) * np.log(1 - probabilities)))


def hospital_folders(dataset_root: Path) -> Iterable[Path]:
    return sorted(path for path in dataset_root.iterdir() if path.is_dir() and (path / "patients.csv").exists())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a synthetic federated logistic regression model.")
    parser.add_argument("--data-dir", default="demo_data/federated", help="Root folder containing hospital subfolders.")
    parser.add_argument("--rounds", type=int, default=8, help="Federated aggregation rounds.")
    parser.add_argument("--local-epochs", type=int, default=5, help="Gradient steps per hospital per round.")
    parser.add_argument("--learning-rate", type=float, default=0.8, help="Local learning rate.")
    parser.add_argument("--noise-multiplier", type=float, default=0.0, help="DP noise multiplier for the aggregator.")
    parser.add_argument("--output", default="demo_data/federated/training_summary.json", help="JSON file for training results.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dataset_root = Path(args.data_dir)
    folders = list(hospital_folders(dataset_root))
    if not folders:
        raise SystemExit(f"No hospital folders with patients.csv found in {dataset_root}")

    datasets = [load_hospital_dataset(folder) for folder in folders]
    summary = fit_federated(
        datasets=datasets,
        rounds=args.rounds,
        learning_rate=args.learning_rate,
        local_epochs=args.local_epochs,
        noise_multiplier=args.noise_multiplier,
    )

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "data_dir": str(dataset_root),
        "rounds": args.rounds,
        "local_epochs": args.local_epochs,
        "learning_rate": args.learning_rate,
        "noise_multiplier": args.noise_multiplier,
        "hospitals": [dataset.node_id for dataset in datasets],
        **summary,
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(output_path), "final_accuracy": payload["final_accuracy"], "rounds": args.rounds}, indent=2))


if __name__ == "__main__":
    main()
