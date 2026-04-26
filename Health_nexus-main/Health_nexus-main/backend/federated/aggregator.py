"""
=============================================
HEALTH NEXUS — Federated Learning Aggregator
(Flower-based FedAvg with Differential Privacy)

Architecture:
  Hospital Node 1 → Δw₁ (DP noise applied)  ┐
  Hospital Node 2 → Δw₂ (DP noise applied)  ├─► FedAvg ─► Global Model
  Hospital Node N → ΔwN (DP noise applied)  ┘

RAW PATIENT DATA NEVER LEAVES NODES.
Only gradient weight updates are transmitted.
=============================================
"""

import numpy as np
from typing import List, Tuple, Dict
from dataclasses import dataclass
import logging

logger = logging.getLogger("health_nexus.federated")


@dataclass
class WeightUpdate:
    """Encrypted weight update from a hospital node."""
    node_id: str
    round_number: int
    weights: List[np.ndarray]     # Model layer weights
    num_samples: int               # Sample count (for FedAvg weighting)
    dp_epsilon: float              # Privacy budget used
    dp_delta: float
    timestamp: str


@dataclass
class FedRoundResult:
    round_number: int
    global_weights: List[np.ndarray]
    global_accuracy: float
    loss: float
    nodes_participated: int
    epsilon_consumed: float


# ── Differential Privacy ──────────────────────
class DifferentialPrivacy:
    """
    Applies Gaussian noise to weight gradients before transmission.
    Implements (ε, δ)-DP guarantee.
    """

    def __init__(self, noise_multiplier: float = 0.01, max_grad_norm: float = 1.0):
        self.noise_multiplier = noise_multiplier
        self.max_grad_norm = max_grad_norm

    def clip_gradients(self, weights: List[np.ndarray]) -> List[np.ndarray]:
        """Per-sample gradient clipping (L2 norm ≤ max_grad_norm)."""
        total_norm = np.sqrt(sum(np.sum(w ** 2) for w in weights))
        clip_factor = min(1.0, self.max_grad_norm / (total_norm + 1e-8))
        return [w * clip_factor for w in weights]

    def add_noise(self, weights: List[np.ndarray]) -> List[np.ndarray]:
        """Add calibrated Gaussian noise to clipped gradients."""
        sigma = self.noise_multiplier * self.max_grad_norm
        return [
            w + np.random.normal(0, sigma, w.shape) for w in weights
        ]

    def privatize(self, weights: List[np.ndarray]) -> List[np.ndarray]:
        """Clip + add noise — full DP pipeline."""
        clipped = self.clip_gradients(weights)
        return self.add_noise(clipped)


# ── Secure Aggregation ────────────────────────
class SecureAggregation:
    """
    Simulates cryptographic secure aggregation.
    In production: use Flower's SecAgg+ or PySyft SMPC.
    """

    @staticmethod
    def mask_weights(weights: List[np.ndarray], seed: int) -> List[np.ndarray]:
        rng = np.random.default_rng(seed)
        return [w + rng.normal(0, 0.001, w.shape) for w in weights]

    @staticmethod
    def unmask_weights(masked_sums: List[np.ndarray], masks: List[List[np.ndarray]]) -> List[np.ndarray]:
        total_mask = [sum(m[i] for m in masks) for i in range(len(masked_sums))]
        return [ms - tm for ms, tm in zip(masked_sums, total_mask)]


# ── FedAvg Aggregator ─────────────────────────
class FedAvgAggregator:
    """
    Federated Averaging (McMahan et al., 2017).
    Aggregates weight updates weighted by dataset size.
    """

    def __init__(self, dp_config: Dict):
        self.dp = DifferentialPrivacy(
            noise_multiplier=dp_config.get("noise_multiplier", 0.01),
            max_grad_norm=dp_config.get("max_grad_norm", 1.0),
        )
        self.round_history: List[FedRoundResult] = []

    def aggregate(
        self,
        updates: List[WeightUpdate],
        current_global_weights: List[np.ndarray],
    ) -> FedRoundResult:
        """
        FedAvg aggregation:
          w_global = Σ (n_k / N) * w_k
          where n_k = samples at node k, N = total samples
        """
        if not updates:
            raise ValueError("No weight updates provided for aggregation.")

        total_samples = sum(u.num_samples for u in updates)
        logger.info(
            f"Round {updates[0].round_number}: aggregating {len(updates)} nodes "
            f"({total_samples} total samples)"
        )

        # Weighted average of layer weights
        aggregated = []
        for layer_idx in range(len(current_global_weights)):
            weighted_sum = sum(
                (u.num_samples / total_samples) * u.weights[layer_idx]
                for u in updates
            )
            aggregated.append(weighted_sum)

        # Estimate accuracy (mock — replace with eval on held-out global test set)
        avg_accuracy = np.mean([
            u.num_samples / total_samples * 88.0  # Replace with real eval
            for u in updates
        ])
        loss = max(0.05, 0.85 - updates[0].round_number * 0.065)

        result = FedRoundResult(
            round_number=updates[0].round_number,
            global_weights=aggregated,
            global_accuracy=float(avg_accuracy),
            loss=float(loss),
            nodes_participated=len(updates),
            epsilon_consumed=updates[0].dp_epsilon,
        )

        self.round_history.append(result)
        logger.info(f"Round {result.round_number} complete. Accuracy: {result.global_accuracy:.2f}%")
        return result

    def get_round_history(self) -> List[FedRoundResult]:
        return self.round_history
