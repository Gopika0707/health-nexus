-- =============================================
-- HEALTH NEXUS — PostgreSQL Database Schema
-- Privacy-Preserving Federated Clinical Platform
--
-- Run: psql -U postgres -d healthnexus -f database/schema.sql
-- =============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USERS & AUTHENTICATION
-- =============================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         VARCHAR(50)  UNIQUE NOT NULL,           -- User-chosen ID
    password_hash   TEXT         NOT NULL,                  -- bcrypt / Argon2
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    is_active       BOOLEAN      DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_users_role    ON users(role);

-- =============================================
-- PATIENTS
-- =============================================

CREATE TABLE patients (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          VARCHAR(30)  UNIQUE NOT NULL,        -- e.g. PNX-2025-84731
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name           VARCHAR(255) NOT NULL,
    age                 SMALLINT     CHECK (age >= 0 AND age <= 150),
    gender              VARCHAR(10)  CHECK (gender IN ('male', 'female', 'other')),
    email               VARCHAR(320) UNIQUE NOT NULL,
    phone               VARCHAR(20),
    blood_group         VARCHAR(5)   CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
    chronic_illness     TEXT,
    genetic_conditions  TEXT,
    family_history      JSONB        DEFAULT '[]',           -- Array of disease names
    created_at          TIMESTAMPTZ  DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_patients_patient_id ON patients(patient_id);
CREATE INDEX idx_patients_user_id    ON patients(user_id);

-- Patient lifestyle data (modifiable risk factors for AI)
CREATE TABLE patient_lifestyle (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID    NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    smoking         VARCHAR(10)  CHECK (smoking IN ('no', 'yes', 'occasional')),
    alcohol         VARCHAR(10)  CHECK (alcohol IN ('none', 'moderate', 'high')),
    activity        VARCHAR(10)  CHECK (activity IN ('low', 'moderate', 'high')),
    sleep_hours     DECIMAL(4,1),
    diet_type       VARCHAR(20)  CHECK (diet_type IN ('vegetarian', 'non-vegetarian', 'vegan', 'other')),
    occupation      VARCHAR(255),
    stress_level    VARCHAR(10)  CHECK (stress_level IN ('low', 'medium', 'high')),
    location        VARCHAR(255),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- =============================================
-- DOCTORS
-- =============================================

CREATE TABLE doctors (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id        VARCHAR(30)  UNIQUE NOT NULL,           -- e.g. DOC-4892
    user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name        VARCHAR(255) NOT NULL,
    specialty        VARCHAR(100) NOT NULL,
    hospital         VARCHAR(255) NOT NULL,
    license_number   VARCHAR(100) UNIQUE NOT NULL,
    experience_years SMALLINT,
    is_verified      BOOLEAN      DEFAULT FALSE,
    created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_doctors_doctor_id ON doctors(doctor_id);

-- Doctor–Patient access relationships
CREATE TABLE doctor_patient_access (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    granted_at  TIMESTAMPTZ DEFAULT NOW(),
    is_active   BOOLEAN DEFAULT TRUE,
    UNIQUE (doctor_id, patient_id)
);

-- =============================================
-- VITALS
-- =============================================

CREATE TABLE vital_readings (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id        UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    recorded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    heart_rate        DECIMAL(5,1),          -- bpm
    systolic_bp       DECIMAL(5,1),          -- mmHg
    diastolic_bp      DECIMAL(5,1),          -- mmHg
    blood_sugar       DECIMAL(6,1),          -- mg/dL
    spo2              DECIMAL(5,2),          -- %
    temperature       DECIMAL(5,2),          -- °F
    bmi               DECIMAL(5,2),          -- kg/m²
    respiratory_rate  DECIMAL(5,1),          -- /min
    cholesterol_ldl   DECIMAL(6,1),
    cholesterol_hdl   DECIMAL(6,1),
    status            VARCHAR(10)  DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical')),
    source            VARCHAR(20)  DEFAULT 'manual' CHECK (source IN ('manual', 'device', 'iot'))
);

CREATE INDEX idx_vitals_patient_id   ON vital_readings(patient_id);
CREATE INDEX idx_vitals_recorded_at  ON vital_readings(recorded_at DESC);

-- AI-generated forecasts (from LSTM model)
CREATE TABLE vital_forecasts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    forecast_date   DATE        NOT NULL,
    heart_rate_pred DECIMAL(5,1),
    bp_systolic_pred DECIMAL(5,1),
    confidence_lower DECIMAL(5,1),
    confidence_upper DECIMAL(5,1),
    model_version   VARCHAR(20)
);

-- =============================================
-- MEDICAL REPORTS
-- =============================================

CREATE TABLE medical_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    report_name     VARCHAR(255) NOT NULL,
    report_type     VARCHAR(20)  CHECK (report_type IN ('MRI','CT','X-Ray','Blood Report','PDF','DICOM')),
    file_url        TEXT,                                    -- Encrypted storage URL
    uploaded_at     TIMESTAMPTZ  DEFAULT NOW(),
    severity_score  SMALLINT     CHECK (severity_score BETWEEN 0 AND 100),
    risk_level      VARCHAR(10)  CHECK (risk_level IN ('Low','Moderate','High','Critical')),
    ai_findings     JSONB        DEFAULT '[]',              -- Extracted findings array
    ai_summary      TEXT,                                   -- Plain-language summary
    follow_up       TEXT,
    analyzed_at     TIMESTAMPTZ,
    model_used      VARCHAR(50)                             -- 'ClinicalBERT' | 'MedGemma'
);

CREATE INDEX idx_reports_patient_id ON medical_reports(patient_id);

-- =============================================
-- MENTAL HEALTH ASSESSMENTS
-- =============================================

CREATE TABLE mental_health_assessments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assessed_at     TIMESTAMPTZ  DEFAULT NOW(),
    wellness_score  SMALLINT     CHECK (wellness_score BETWEEN 0 AND 100),
    burnout_risk    VARCHAR(20),
    dimensions      JSONB        DEFAULT '{}',              -- {mood, sleep, energy, focus, social, stress}
    questionnaire   JSONB        DEFAULT '{}',              -- Raw Q&A responses
    recommendations JSONB        DEFAULT '[]'
);

CREATE INDEX idx_mental_health_patient_id ON mental_health_assessments(patient_id);

-- =============================================
-- DRUG INTERACTION CHECKS
-- =============================================

CREATE TABLE drug_check_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID         REFERENCES patients(id) ON DELETE SET NULL,
    doctor_id       UUID         REFERENCES doctors(id) ON DELETE SET NULL,
    checked_at      TIMESTAMPTZ  DEFAULT NOW(),
    drug_names      JSONB        NOT NULL,                  -- Array of drug names checked
    interactions    JSONB        DEFAULT '[]',              -- Detected interactions
    result_summary  TEXT
);

-- =============================================
-- FEDERATED LEARNING — NODE REGISTRY
-- =============================================

CREATE TABLE hospital_nodes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id         VARCHAR(20)  UNIQUE NOT NULL,            -- e.g. NODE-001
    hospital_name   VARCHAR(255) NOT NULL,
    location        VARCHAR(255),
    ip_address      INET,
    public_key      TEXT,                                   -- For secure aggregation
    status          VARCHAR(10)  DEFAULT 'idle' CHECK (status IN ('training', 'idle', 'offline')),
    patient_count   INTEGER      DEFAULT 0,
    last_seen       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_nodes_status ON hospital_nodes(status);

-- =============================================
-- FEDERATED LEARNING — TRAINING ROUNDS
-- =============================================

CREATE TABLE federated_rounds (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_number        INTEGER      NOT NULL,
    started_at          TIMESTAMPTZ  DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    global_accuracy     DECIMAL(6,3),
    local_avg_accuracy  DECIMAL(6,3),
    loss                DECIMAL(8,6),
    nodes_participated  SMALLINT,
    total_samples       INTEGER,
    dp_epsilon          DECIMAL(8,6),                       -- Privacy budget consumed
    dp_delta            DECIMAL(12,10),
    algorithm           VARCHAR(20)  DEFAULT 'FedAvg',
    status              VARCHAR(15)  DEFAULT 'running' CHECK (status IN ('running','completed','failed'))
);

CREATE INDEX idx_fed_rounds_round_number ON federated_rounds(round_number);

-- Per-node contribution to each round
CREATE TABLE node_round_participation (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_id        UUID        NOT NULL REFERENCES federated_rounds(id) ON DELETE CASCADE,
    node_id         UUID        NOT NULL REFERENCES hospital_nodes(id) ON DELETE CASCADE,
    local_accuracy  DECIMAL(6,3),
    local_loss      DECIMAL(8,6),
    samples_used    INTEGER,
    gradient_norm   DECIMAL(8,6),
    dp_noise_applied BOOLEAN    DEFAULT TRUE,
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (round_id, node_id)
);

-- =============================================
-- MODEL REGISTRY
-- =============================================

CREATE TABLE ai_models (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name      VARCHAR(100) NOT NULL,
    version         VARCHAR(20)  NOT NULL,
    model_type      VARCHAR(50),                            -- 'CNN','LSTM','Transformer', etc.
    global_accuracy DECIMAL(6,3),
    status          VARCHAR(15)  DEFAULT 'active' CHECK (status IN ('active','frozen','deprecated')),
    deployed_nodes  SMALLINT     DEFAULT 0,
    weights_url     TEXT,                                   -- Encrypted model weights storage
    deployed_at     TIMESTAMPTZ  DEFAULT NOW(),
    deployed_by     UUID         REFERENCES users(id),
    from_round      INTEGER,
    UNIQUE (model_name, version)
);

-- =============================================
-- AUDIT TRAIL (Immutable — Append-Only)
-- =============================================

CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    logged_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    round_id    UUID         REFERENCES federated_rounds(id),
    node_id     VARCHAR(20),
    user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(255) NOT NULL,
    status      VARCHAR(10)  DEFAULT 'success' CHECK (status IN ('success', 'error', 'warning')),
    metadata    JSONB        DEFAULT '{}',
    ip_address  INET,
    user_agent  TEXT
);

-- Audit logs should never be updated or deleted
CREATE INDEX idx_audit_logged_at ON audit_logs(logged_at DESC);
CREATE INDEX idx_audit_node_id   ON audit_logs(node_id);

-- Prevent updates/deletes on audit table (append-only enforcement)
CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- =============================================
-- VIEWS (Useful for dashboards)
-- =============================================

-- Latest vital readings per patient
CREATE OR REPLACE VIEW latest_vitals AS
SELECT DISTINCT ON (patient_id)
    patient_id, recorded_at, heart_rate, systolic_bp, diastolic_bp,
    blood_sugar, spo2, temperature, bmi, status
FROM vital_readings
ORDER BY patient_id, recorded_at DESC;

-- Federated training progress summary
CREATE OR REPLACE VIEW federation_progress AS
SELECT
    round_number,
    global_accuracy,
    local_avg_accuracy,
    loss,
    nodes_participated,
    dp_epsilon,
    completed_at
FROM federated_rounds
WHERE status = 'completed'
ORDER BY round_number;

-- =============================================
-- SEED DATA (Development only)
-- =============================================

-- Default admin user (change password immediately in production!)
INSERT INTO users (user_id, password_hash, role) VALUES
('admin', '$2b$12$EXAMPLE_BCRYPT_HASH_CHANGE_THIS', 'admin')
ON CONFLICT DO NOTHING;
