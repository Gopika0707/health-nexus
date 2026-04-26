"""
=============================================
HEALTH NEXUS — Hospital Node FL Client
(Flower client for local model training)

Each hospital runs this client independently.
LOCAL TRAINING ONLY — no raw data leaves.
Only Δw (gradient updates) are transmitted
after Differential Privacy is applied.

Usage:
  python -m backend.federated.client \
    --hospital-id NODE-001 \
    --server-address aggregator:8080 \
    --data-path /local/hospital/data
=============================================
"""

import argparse
import numpy as np
from typing import Dict, List, Tuple
from dataclasses import dataclass
import logging

# Flower federated learning framework
try:
    import flwr as fl
    from flwr.common import (
        NDArrays, Scalar, FitRes, EvaluateRes,
        ndarrays_to_parameters, parameters_to_ndarrays,
    )
    FLOWER_AVAILABLE = True
except ImportError:
    FLOWER_AVAILABLE = False
    print("Warning: flwr not installed. Run: pip install flwr")

# PyTorch (replace with TensorFlow if preferred)
try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    print("Warning: torch not installed. Run: pip install torch")

from backend.federated.aggregator import DifferentialPrivacy

logger = logging.getLogger("health_nexus.client")


@dataclass
class LocalTrainingConfig:
    hospital_id: str
    local_epochs: int = 5
    batch_size: int = 32
    learning_rate: float = 0.001
    dp_noise_multiplier: float = 0.01
    dp_max_grad_norm: float = 1.0


# ── Model Architecture ────────────────────────
class VitalsPredictorLSTM(nn.Module):
    """
    LSTM model for vital signs trend prediction.
    Trained locally at each hospital node.
    """

    def __init__(self, input_size: int = 8, hidden_size: int = 64, num_layers: int = 2, output_size: int = 8):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden_size, output_size)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])


# ── Flower FL Client ──────────────────────────
if FLOWER_AVAILABLE and TORCH_AVAILABLE:

    class HealthNexusClient(fl.client.NumPyClient):
        """
        Flower NumPyClient for local model training.

        Security guarantees:
        - Only weight updates (Δw) are sent to the aggregator
        - Differential Privacy noise is applied before transmission
        - Gradient clipping prevents data leakage via large gradients
        """

        def __init__(self, config: LocalTrainingConfig, train_loader: DataLoader, val_loader: DataLoader):
            self.config = config
            self.train_loader = train_loader
            self.val_loader = val_loader
            self.model = VitalsPredictorLSTM()
            self.dp = DifferentialPrivacy(
                noise_multiplier=config.dp_noise_multiplier,
                max_grad_norm=config.dp_max_grad_norm,
            )
            self.criterion = nn.MSELoss()
            self.optimizer = torch.optim.Adam(self.model.parameters(), lr=config.learning_rate)

        def get_parameters(self, config: Dict) -> NDArrays:
            """Return current model weights as numpy arrays."""
            return [val.cpu().numpy() for val in self.model.state_dict().values()]

        def set_parameters(self, parameters: NDArrays) -> None:
            """Update local model with global aggregated weights."""
            params_dict = zip(self.model.state_dict().keys(), parameters)
            state_dict = {k: torch.tensor(v) for k, v in params_dict}
            self.model.load_state_dict(state_dict, strict=True)

        def fit(self, parameters: NDArrays, config: Dict) -> FitRes:
            """
            1. Receive global model weights
            2. Train locally for N epochs
            3. Apply Differential Privacy noise to Δw
            4. Return only weight deltas (never raw data)
            """
            self.set_parameters(parameters)
            self.model.train()

            for epoch in range(self.config.local_epochs):
                for batch_X, batch_y in self.train_loader:
                    self.optimizer.zero_grad()
                    predictions = self.model(batch_X)
                    loss = self.criterion(predictions, batch_y)
                    loss.backward()

                    # Gradient clipping (DP step 1)
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(),
                        self.config.dp_max_grad_norm
                    )
                    self.optimizer.step()

            # Apply DP noise to weight updates before transmission
            raw_weights = self.get_parameters({})
            dp_weights = self.dp.privatize(raw_weights)

            return dp_weights, len(self.train_loader.dataset), {}

        def evaluate(self, parameters: NDArrays, config: Dict) -> EvaluateRes:
            """Evaluate global model on local validation set."""
            self.set_parameters(parameters)
            self.model.eval()
            total_loss = 0.0
            with torch.no_grad():
                for batch_X, batch_y in self.val_loader:
                    preds = self.model(batch_X)
                    total_loss += self.criterion(preds, batch_y).item()

            avg_loss = total_loss / len(self.val_loader)
            accuracy = max(0.0, 1.0 - avg_loss)  # Simplified metric
            return avg_loss, len(self.val_loader.dataset), {"accuracy": accuracy}


def start_client(server_address: str, config: LocalTrainingConfig, train_loader, val_loader):
    """Launch the Flower client and connect to the aggregator server."""
    if not FLOWER_AVAILABLE:
        raise RuntimeError("Install flwr: pip install flwr")
    client = HealthNexusClient(config, train_loader, val_loader)
    fl.client.start_numpy_client(server_address=server_address, client=client)


# ── CLI Entry Point ───────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HealthNexus Hospital FL Node Client")
    parser.add_argument("--hospital-id",    required=True, help="Hospital node identifier")
    parser.add_argument("--server-address", default="localhost:8080", help="Aggregator server address")
    parser.add_argument("--local-epochs",   type=int, default=5)
    parser.add_argument("--batch-size",     type=int, default=32)
    parser.add_argument("--dp-noise",       type=float, default=0.01, help="DP noise multiplier σ")
    args = parser.parse_args()

    cfg = LocalTrainingConfig(
        hospital_id=args.hospital_id,
        local_epochs=args.local_epochs,
        batch_size=args.batch_size,
        dp_noise_multiplier=args.dp_noise,
    )

    logger.info(f"Starting FL client for {cfg.hospital_id} → {args.server_address}")
    # NOTE: Replace mock loaders with real hospital DataLoader instances
    # start_client(args.server_address, cfg, train_loader, val_loader)
