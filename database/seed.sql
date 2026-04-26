-- =============================================
-- HEALTH NEXUS — Development Seed Data
-- DO NOT run in production environments.
-- =============================================

-- ── Hospital Nodes ────────────────────────────
INSERT INTO hospital_nodes (node_id, hospital_name, location, status, patient_count)
VALUES
('NODE-001', 'Metro General Hospital',    'New York, USA',   'training', 1240),
('NODE-002', 'St. Mary Medical Center',   'London, UK',      'idle',     890),
('NODE-003', 'Tokyo Medical University',  'Tokyo, JP',       'training', 2100),
('NODE-004', 'Mumbai Health Institute',   'Mumbai, IN',      'idle',     1560),
('NODE-005', 'São Paulo Hospital',        'SP, Brazil',      'offline',  780),
('NODE-006', 'Berlin Medical Center',     'Berlin, DE',      'training', 1100)
ON CONFLICT (node_id) DO NOTHING;

-- ── AI Models ─────────────────────────────────
INSERT INTO ai_models (model_name, version, model_type, global_accuracy, status, deployed_nodes)
VALUES
('CardiacNet',   'v2.4', 'CNN - Cardiac Imaging',     89.2, 'active',     5),
('VitalLSTM',    'v1.8', 'LSTM - Vitals Forecasting', 87.1, 'active',     5),
('CardiacNet',   'v2.3', 'CNN - Cardiac Imaging',     87.4, 'frozen',     0),
('MentalScreen', 'v1.0', 'Transformer - NLP',         83.5, 'active',     4)
ON CONFLICT (model_name, version) DO NOTHING;

-- ── Federated Rounds (historical) ─────────────
INSERT INTO federated_rounds (round_number, global_accuracy, local_avg_accuracy, loss, nodes_participated, dp_epsilon, algorithm, status)
VALUES
(1,  70.2, 68.5, 0.82, 6, 0.05, 'FedAvg', 'completed'),
(2,  72.1, 70.3, 0.75, 6, 0.05, 'FedAvg', 'completed'),
(3,  74.0, 72.1, 0.68, 5, 0.05, 'FedAvg', 'completed'),
(4,  75.8, 74.0, 0.62, 6, 0.05, 'FedAvg', 'completed'),
(5,  77.5, 75.5, 0.56, 6, 0.05, 'FedAvg', 'completed'),
(6,  79.3, 77.4, 0.51, 5, 0.05, 'FedAvg', 'completed'),
(7,  81.0, 79.1, 0.45, 6, 0.05, 'FedAvg', 'completed'),
(8,  82.8, 80.8, 0.40, 6, 0.05, 'FedAvg', 'completed'),
(9,  84.5, 82.5, 0.35, 5, 0.05, 'FedAvg', 'completed'),
(10, 85.7, 83.7, 0.29, 6, 0.05, 'FedAvg', 'completed'),
(11, 87.0, 85.0, 0.23, 6, 0.05, 'FedAvg', 'completed'),
(12, 88.3, 86.3, 0.17, 5, 0.05, 'FedAvg', 'completed')
ON CONFLICT DO NOTHING;
