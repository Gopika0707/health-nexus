import csv
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, Optional
from urllib.parse import quote_plus
from uuid import uuid4

from backend.env_loader import load_env

try:
    from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text, create_engine, text
    from sqlalchemy.exc import SQLAlchemyError
    from sqlalchemy.orm import declarative_base, relationship, sessionmaker
    SQLALCHEMY_AVAILABLE = True
except ImportError:  # pragma: no cover
    Boolean = Column = DateTime = Float = ForeignKey = Integer = JSON = String = Text = None
    create_engine = text = sessionmaker = relationship = None
    SQLAlchemyError = Exception
    SQLALCHEMY_AVAILABLE = False

    class _DummyMetadata:
        def create_all(self, bind=None) -> None:
            return None

    class _DummyBase:
        metadata = _DummyMetadata()

    def declarative_base():
        return _DummyBase

from backend.auth import hash_password


load_env()


MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "Priya@2005")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "healthnexus")
SQLITE_FALLBACK_PATH = Path(__file__).with_name("healthnexus_demo.db")

_ENCODED_PASSWORD = quote_plus(MYSQL_PASSWORD)
DATABASE_URL = f"mysql+pymysql://{MYSQL_USER}:{_ENCODED_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"
SERVER_URL = f"mysql+pymysql://{MYSQL_USER}:{_ENCODED_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/mysql"
ACTIVE_DATABASE = "mysql"

Base = declarative_base()
engine = None
SessionLocal = None
STORE_INITIALIZED = False


class User(Base):
    __tablename__ = "users"

    if SQLALCHEMY_AVAILABLE:
        id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
        user_id = Column(String(50), unique=True, nullable=False, index=True)
        password_hash = Column(Text, nullable=False)
        role = Column(String(20), nullable=False, index=True)
        is_active = Column(Boolean, default=True, nullable=False)
        doctor = relationship("Doctor", back_populates="user", uselist=False)


class Doctor(Base):
    __tablename__ = "doctors"

    if SQLALCHEMY_AVAILABLE:
        id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
        doctor_id = Column(String(30), unique=True, nullable=False, index=True)
        user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
        full_name = Column(String(255), nullable=False)
        specialty = Column(String(100), nullable=False)
        hospital = Column(String(255), nullable=False)
        experience_years = Column(Integer, default=0)
        license_number = Column(String(100), unique=True, nullable=False)
        user = relationship("User", back_populates="doctor")
        access = relationship("DoctorPatientAccess", back_populates="doctor", cascade="all, delete-orphan")


class Patient(Base):
    __tablename__ = "patients"

    if SQLALCHEMY_AVAILABLE:
        id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
        patient_id = Column(String(30), unique=True, nullable=False, index=True)
        user_id = Column(String(50), nullable=False)
        full_name = Column(String(255), nullable=False)
        age = Column(Integer, nullable=False)
        gender = Column(String(20), nullable=False)
        email = Column(String(255), nullable=False)
        blood_group = Column(String(5), nullable=False)
        condition = Column(String(255), nullable=False)
        risk = Column(String(20), nullable=False)
        last_visit = Column(String(20), nullable=False)
        previous_disease_history = Column(JSON, default=list)
        family_history = Column(JSON, default=list)
        lifestyle = Column(JSON, default=dict)
        latest_vitals = Column(JSON, default=dict)
        recommendation = Column(Text, nullable=False)
        updated_at = Column(String(40), nullable=False, default=lambda: _utc_now())
        chronic_illness = Column(Text)
        genetic_conditions = Column(Text)
        phone = Column(String(20))
        created_at = Column(String(40), nullable=False, default=lambda: _utc_now())
        reports = relationship("MedicalReport", back_populates="patient", cascade="all, delete-orphan")
        access = relationship("DoctorPatientAccess", back_populates="patient", cascade="all, delete-orphan")


class DoctorPatientAccess(Base):
    __tablename__ = "doctor_patient_access"

    if SQLALCHEMY_AVAILABLE:
        id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
        doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False)
        patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
        is_active = Column(Boolean, default=True, nullable=False)
        doctor = relationship("Doctor", back_populates="access")
        patient = relationship("Patient", back_populates="access")


class MedicalReport(Base):
    __tablename__ = "medical_reports"

    if SQLALCHEMY_AVAILABLE:
        id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
        report_id = Column(String(30), unique=True, nullable=False, index=True)
        patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
        name = Column(String(255), nullable=False)
        report_type = Column(String(20), nullable=False)
        date = Column(String(40), nullable=False)
        severity_score = Column(Integer, nullable=False)
        risk_level = Column(String(20), nullable=False)
        findings = Column(JSON, default=list)
        ai_summary = Column(Text, nullable=False)
        follow_up = Column(Text)
        explanation = Column(Text)
        recommendations = Column(JSON, default=list)
        model_version = Column(String(50))
        file_url = Column(Text)
        patient = relationship("Patient", back_populates="reports")


class HospitalNode(Base):
    __tablename__ = "hospital_nodes"

    if SQLALCHEMY_AVAILABLE:
        id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
        node_id = Column(String(20), unique=True, nullable=False, index=True)
        name = Column(String(255), nullable=False)
        location = Column(String(255), nullable=False)
        status = Column(String(20), nullable=False)
        patient_count = Column(Integer, nullable=False)
        local_accuracy = Column(Float, nullable=False)
        current_round = Column(Integer, nullable=False)


class FederatedRound(Base):
    __tablename__ = "federated_rounds"

    if SQLALCHEMY_AVAILABLE:
        id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
        round_number = Column(Integer, unique=True, nullable=False, index=True)
        global_accuracy = Column(Float, nullable=False)
        local_avg_accuracy = Column(Float, nullable=False)
        loss = Column(Float, nullable=False)
        nodes_participated = Column(Integer, nullable=False)
        timestamp = Column(String(40), nullable=False)


class AIModel(Base):
    __tablename__ = "ai_models"

    if SQLALCHEMY_AVAILABLE:
        id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
        model_key = Column(String(50), unique=True, nullable=False, index=True)
        name = Column(String(255), nullable=False)
        model_type = Column(String(100), nullable=False)
        status = Column(String(20), nullable=False)
        global_accuracy = Column(Float, nullable=False)
        deployed_nodes = Column(Integer, nullable=False)
        deployed_at = Column(String(40), nullable=False)
        version = Column(String(30), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    if SQLALCHEMY_AVAILABLE:
        id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
        audit_id = Column(String(30), unique=True, nullable=False, index=True)
        timestamp = Column(String(40), nullable=False)
        round = Column(String(20), nullable=False)
        node_id = Column(String(20), nullable=False)
        action = Column(String(255), nullable=False)
        status = Column(String(20), nullable=False)
        metadata_json = Column(JSON, default=dict)


def _utc_now() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _seed_round_rows() -> list[dict[str, Any]]:
    base = datetime.utcnow() - timedelta(days=18)
    rows = []
    for idx in range(1, 7):
        rows.append(
            {
                "round_number": idx,
                "global_accuracy": round(78.4 + idx * 1.8, 2),
                "local_avg_accuracy": round(74.8 + idx * 1.5, 2),
                "loss": round(0.62 - idx * 0.07, 3),
                "nodes_participated": 3,
                "timestamp": (base + timedelta(days=idx * 3)).replace(microsecond=0).isoformat() + "Z",
            }
        )
    return rows


def _require_sqlalchemy() -> None:
    if not SQLALCHEMY_AVAILABLE:
        raise RuntimeError("Database dependencies missing. Install backend requirements to enable MySQL connectivity.")


def _get_engine():
    global engine, SessionLocal
    _require_sqlalchemy()
    if engine is None:
        if ACTIVE_DATABASE == "sqlite":
            engine = create_engine(
                DATABASE_URL,
                connect_args={"check_same_thread": False},
            )
        else:
            engine = create_engine(
                DATABASE_URL,
                pool_pre_ping=True,
                connect_args={"connect_timeout": 5},
            )
        SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return engine


def _get_session():
    if SessionLocal is None:
        _get_engine()
    return SessionLocal()


def _bootstrap_database() -> None:
    global DATABASE_URL, ACTIVE_DATABASE, engine, SessionLocal
    _require_sqlalchemy()
    try:
        bootstrap_engine = create_engine(
            SERVER_URL,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 5},
        )
        with bootstrap_engine.connect() as connection:
            connection.execute(text(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DATABASE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            connection.commit()
    except SQLAlchemyError as exc:
        DATABASE_URL = f"sqlite:///{SQLITE_FALLBACK_PATH.as_posix()}"
        ACTIVE_DATABASE = "sqlite"
        engine = None
        SessionLocal = None


def _run_schema_updates() -> None:
    statements = [
        "ALTER TABLE patients ADD COLUMN family_history JSON NULL",
        "ALTER TABLE patients ADD COLUMN lifestyle JSON NULL",
        "ALTER TABLE patients ADD COLUMN chronic_illness TEXT NULL",
        "ALTER TABLE patients ADD COLUMN genetic_conditions TEXT NULL",
        "ALTER TABLE patients ADD COLUMN phone VARCHAR(20) NULL",
        "ALTER TABLE patients ADD COLUMN created_at VARCHAR(40) NULL",
        "ALTER TABLE patients ADD COLUMN updated_at VARCHAR(40) NULL",
    ]
    engine_ref = _get_engine()
    for statement in statements:
        try:
            with engine_ref.connect() as connection:
                connection.execute(text(statement))
                connection.commit()
        except Exception:
            continue


def _serialize_report(report: MedicalReport, patient: Patient) -> dict[str, Any]:
    return {
        "id": report.report_id,
        "patient_id": patient.patient_id,
        "name": report.name,
        "type": report.report_type,
        "date": report.date,
        "severity_score": report.severity_score,
        "risk_level": report.risk_level,
        "findings": report.findings or [],
        "ai_summary": report.ai_summary,
        "follow_up": report.follow_up,
        "file_url": report.file_url,
        "explanation": report.explanation,
        "recommendations": report.recommendations or [],
        "model_version": report.model_version,
    }


def _serialize_patient(patient: Patient) -> dict[str, Any]:
    reports = sorted(patient.reports, key=lambda item: item.date, reverse=True)
    return {
        "patient_id": patient.patient_id,
        "user_id": patient.user_id,
        "full_name": patient.full_name,
        "age": patient.age,
        "gender": patient.gender,
        "email": patient.email,
        "phone": patient.phone,
        "blood_group": patient.blood_group,
        "chronic_illness": patient.chronic_illness,
        "genetic_conditions": patient.genetic_conditions,
        "family_history": patient.family_history or [],
        "lifestyle": patient.lifestyle or {
            "smoking": "no",
            "alcohol": "none",
            "activity": "moderate",
            "sleep_hours": 7,
            "diet": "other",
            "stress_level": "medium",
        },
        "created_at": patient.created_at or _utc_now(),
        "updated_at": patient.updated_at or patient.created_at or _utc_now(),
        "condition": patient.condition,
        "risk": patient.risk,
        "last_visit": patient.last_visit,
        "previous_disease_history": patient.previous_disease_history or [],
        "latest_vitals": patient.latest_vitals or {},
        "recommendation": patient.recommendation,
        "reports": [_serialize_report(report, patient) for report in reports],
    }


def _serialize_doctor(doctor: Doctor) -> dict[str, Any]:
    active_patients = sum(1 for access in doctor.access if access.is_active)
    return {
        "doctor_id": doctor.doctor_id,
        "full_name": doctor.full_name,
        "specialty": doctor.specialty,
        "hospital": doctor.hospital,
        "experience_years": doctor.experience_years,
        "license_number": doctor.license_number,
        "active_patients": active_patients,
    }


def _serialize_node(node: HospitalNode) -> dict[str, Any]:
    return {
        "id": node.node_id,
        "name": node.name,
        "location": node.location,
        "status": node.status,
        "patient_count": node.patient_count,
        "local_accuracy": node.local_accuracy,
        "current_round": node.current_round,
    }


def _serialize_round(round_row: FederatedRound) -> dict[str, Any]:
    return {
        "round_number": round_row.round_number,
        "global_accuracy": round_row.global_accuracy,
        "local_avg_accuracy": round_row.local_avg_accuracy,
        "loss": round_row.loss,
        "nodes_participated": round_row.nodes_participated,
        "timestamp": round_row.timestamp,
    }


def _serialize_model(model: AIModel) -> dict[str, Any]:
    return {
        "id": model.model_key,
        "name": model.name,
        "type": model.model_type,
        "status": model.status,
        "global_accuracy": model.global_accuracy,
        "deployed_nodes": model.deployed_nodes,
        "deployed_at": model.deployed_at,
        "version": model.version,
    }


def _serialize_audit(log: AuditLog) -> dict[str, Any]:
    return {
        "id": log.audit_id,
        "timestamp": log.timestamp,
        "round": log.round,
        "node_id": log.node_id,
        "action": log.action,
        "status": log.status,
        "metadata": log.metadata_json or {},
    }


def ensure_store() -> None:
    global STORE_INITIALIZED
    if STORE_INITIALIZED:
        return

    _bootstrap_database()
    Base.metadata.create_all(bind=_get_engine())
    _run_schema_updates()
    session = _get_session()
    try:
        if session.query(User).count() > 0:
            demo_patients = [
                {
                    "patient_id": "PNX-84731",
                    "user_id": "alex.patient",
                    "password": "patient123",
                    "phone": "+91-9000000001",
                    "family_history": ["Hypertension"],
                    "lifestyle": {
                        "smoking": "no",
                        "alcohol": "moderate",
                        "activity": "moderate",
                        "sleep_hours": 7,
                        "diet": "non-vegetarian",
                        "occupation": "Software Engineer",
                        "stress_level": "medium",
                        "location": "Chennai",
                    },
                },
                {
                    "patient_id": "PNX-29183",
                    "user_id": "maria.patient",
                    "password": "patient123",
                    "phone": "+91-9000000002",
                    "family_history": ["Diabetes", "Heart Disease"],
                    "lifestyle": {
                        "smoking": "no",
                        "alcohol": "none",
                        "activity": "low",
                        "sleep_hours": 6,
                        "diet": "vegetarian",
                        "occupation": "Teacher",
                        "stress_level": "medium",
                        "location": "Bengaluru",
                    },
                },
            ]

            changed = False
            for demo in demo_patients:
                patient = session.query(Patient).filter_by(patient_id=demo["patient_id"]).first()
                if patient is None:
                    continue

                user = session.query(User).filter_by(user_id=demo["user_id"], role="patient").first()
                if user is None:
                    user = User(user_id=demo["user_id"], password_hash=hash_password(demo["password"]), role="patient", is_active=True)
                    session.add(user)
                    changed = True

                if patient.user_id != demo["user_id"]:
                    patient.user_id = demo["user_id"]
                    changed = True

                if not patient.phone:
                    patient.phone = demo["phone"]
                    changed = True
                if not patient.family_history:
                    patient.family_history = demo["family_history"]
                    changed = True
                if not patient.lifestyle:
                    patient.lifestyle = demo["lifestyle"]
                    changed = True
                if not patient.created_at:
                    patient.created_at = _utc_now()
                    changed = True
                if not getattr(patient, "updated_at", None):
                    patient.updated_at = patient.created_at or _utc_now()
                    changed = True

            if changed:
                session.commit()
            STORE_INITIALIZED = True
            return

        doctor_user = User(user_id="DOC-4892", password_hash=hash_password("doctor123"), role="doctor", is_active=True)
        admin_user = User(user_id="admin", password_hash=hash_password("admin123"), role="admin", is_active=True)
        session.add_all([doctor_user, admin_user])
        session.flush()

        doctor = Doctor(
            doctor_id="DOC-4892",
            user_id=doctor_user.id,
            full_name="Dr. Sarah Mitchell",
            specialty="Cardiology",
            hospital="Metro General Hospital",
            experience_years=12,
            license_number="LIC-CARD-2026-1182",
        )
        session.add(doctor)
        session.flush()

        patients = [
            Patient(
                patient_id="PNX-84731",
                user_id="alex.patient",
                full_name="Alex Johnson",
                age=34,
                gender="male",
                email="alex.johnson@example.com",
                phone="+91-9000000001",
                blood_group="O+",
                chronic_illness="Hypertension",
                genetic_conditions="",
                family_history=["Hypertension"],
                lifestyle={"smoking": "no", "alcohol": "moderate", "activity": "moderate", "sleep_hours": 7, "diet": "non-vegetarian", "occupation": "Software Engineer", "stress_level": "medium", "location": "Chennai"},
                condition="Hypertension",
                risk="Moderate",
                last_visit="2026-03-07",
                previous_disease_history=["hypertension"],
                latest_vitals={"heart_rate": 82, "systolic_bp": 135, "diastolic_bp": 88, "blood_sugar": 108, "cholesterol": 195, "ecg": "normal sinus rhythm", "oxygen_level": 97},
                recommendation="Moderate cardiovascular risk. Continue blood pressure monitoring, maintain a low-sodium diet, and schedule routine follow-up in 2 weeks.",
                created_at=_utc_now(),
                updated_at=_utc_now(),
            ),
            Patient(
                patient_id="PNX-29183",
                user_id="PT-29183",
                full_name="Maria Chen",
                age=58,
                gender="female",
                email="maria.chen@example.com",
                blood_group="A+",
                family_history=["Diabetes", "Heart Disease"],
                lifestyle={"smoking": "no", "alcohol": "none", "activity": "low", "sleep_hours": 6, "diet": "vegetarian", "occupation": "Teacher", "stress_level": "medium", "location": "Bengaluru"},
                condition="Diabetes T2 + CAD",
                risk="High",
                last_visit="2026-03-08",
                previous_disease_history=["type 2 diabetes", "coronary artery disease"],
                latest_vitals={"heart_rate": 96, "systolic_bp": 154, "diastolic_bp": 96, "blood_sugar": 186, "cholesterol": 242, "ecg": "st depression", "oxygen_level": 95},
                recommendation="High risk of cardiovascular deterioration. Recommend ECG review, lipid profile, HbA1c, medication adjustment, and cardiology consultation.",
                created_at=_utc_now(),
                updated_at=_utc_now(),
            ),
            Patient(
                patient_id="PNX-57234",
                user_id="PT-57234",
                full_name="Robert Davis",
                age=47,
                gender="male",
                email="robert.davis@example.com",
                blood_group="B+",
                family_history=["Heart Disease"],
                lifestyle={"smoking": "occasional", "alcohol": "moderate", "activity": "low", "sleep_hours": 6, "diet": "other", "occupation": "Sales", "stress_level": "high", "location": "Hyderabad"},
                condition="Arrhythmia",
                risk="Moderate",
                last_visit="2026-03-04",
                previous_disease_history=["arrhythmia"],
                latest_vitals={"heart_rate": 108, "systolic_bp": 128, "diastolic_bp": 84, "blood_sugar": 102, "cholesterol": 201, "ecg": "irregular qrs", "oxygen_level": 96},
                recommendation="Moderate rhythm risk. Suggest repeat ECG, Holter monitoring, and review of anti-arrhythmic therapy adherence.",
                created_at=_utc_now(),
                updated_at=_utc_now(),
            ),
            Patient(
                patient_id="PNX-83920",
                user_id="PT-83920",
                full_name="Priya Sharma",
                age=29,
                gender="female",
                email="priya.sharma@example.com",
                blood_group="AB+",
                family_history=["Thyroid Disorders"],
                lifestyle={"smoking": "no", "alcohol": "none", "activity": "high", "sleep_hours": 8, "diet": "vegetarian", "occupation": "Designer", "stress_level": "medium", "location": "Pune"},
                condition="Anxiety + Palpitations",
                risk="Low",
                last_visit="2026-03-09",
                previous_disease_history=["anxiety"],
                latest_vitals={"heart_rate": 88, "systolic_bp": 118, "diastolic_bp": 76, "blood_sugar": 92, "cholesterol": 168, "ecg": "normal", "oxygen_level": 99},
                recommendation="Low acute cardiometabolic risk. Continue current management, monitor symptoms, and reinforce sleep and stress-control measures.",
                created_at=_utc_now(),
                updated_at=_utc_now(),
            ),
        ]
        session.add_all(patients)
        session.flush()

        session.add_all(
            [
                User(user_id="alex.patient", password_hash=hash_password("patient123"), role="patient", is_active=True),
                User(user_id="maria.patient", password_hash=hash_password("patient123"), role="patient", is_active=True),
            ]
        )

        for patient in patients:
            session.add(DoctorPatientAccess(doctor_id=doctor.id, patient_id=patient.id, is_active=True))

        for node in [
            HospitalNode(node_id="NODE-001", name="Metro General Hospital", location="Chennai", status="training", patient_count=1240, local_accuracy=87.6, current_round=6),
            HospitalNode(node_id="NODE-002", name="South City Care", location="Bengaluru", status="idle", patient_count=980, local_accuracy=85.9, current_round=6),
            HospitalNode(node_id="NODE-003", name="Lakeside Multispeciality", location="Hyderabad", status="training", patient_count=1135, local_accuracy=86.8, current_round=6),
        ]:
            session.add(node)

        created_at = _utc_now()
        for row in _seed_round_rows():
            session.add(FederatedRound(**row))

        for model in [
            AIModel(model_key="mdl-logreg-cardiac", name="Cardio Risk Classifier", model_type="Logistic Regression", status="active", global_accuracy=88.2, deployed_nodes=3, deployed_at=created_at, version="v1.6.0"),
            AIModel(model_key="mdl-cnn-scan", name="Scan Pattern Analyzer", model_type="CNN", status="active", global_accuracy=84.9, deployed_nodes=2, deployed_at=created_at, version="v1.4.2"),
            AIModel(model_key="mdl-lstm-vitals", name="Vitals Sequence Monitor", model_type="LSTM", status="active", global_accuracy=86.7, deployed_nodes=3, deployed_at=created_at, version="v1.5.1"),
        ]:
            session.add(model)

        for audit in [
            AuditLog(audit_id="AUD-001", timestamp=created_at, round="6", node_id="NODE-001", action="federated_round_completed", status="success", metadata_json={"model_version": "v1.6.0"}),
            AuditLog(audit_id="AUD-002", timestamp=created_at, round="6", node_id="NODE-002", action="model_validation_passed", status="success", metadata_json={"accuracy": 85.9}),
        ]:
            session.add(audit)

        session.commit()
        STORE_INITIALIZED = True
    finally:
        session.close()


def get_user_for_login(user_id: str, role: str) -> Optional[dict[str, Any]]:
    ensure_store()
    session = _get_session()
    try:
        user = session.query(User).filter(User.user_id == user_id, User.role == role).first()
        if user is None:
            return None
        doctor_id = user.doctor.doctor_id if role == "doctor" and user.doctor else None
        patient = session.query(Patient).filter_by(user_id=user.user_id).first() if role == "patient" else None
        return {
            "user_id": user.user_id,
            "password_hash": user.password_hash,
            "role": user.role,
            "doctor_id": doctor_id,
            "patient_id": patient.patient_id if patient else None,
        }
    finally:
        session.close()


def get_doctor_by_public_id(doctor_id: str) -> Optional[dict[str, Any]]:
    ensure_store()
    session = _get_session()
    try:
        doctor = session.query(Doctor).filter_by(doctor_id=doctor_id).first()
        return _serialize_doctor(doctor) if doctor else None
    finally:
        session.close()


def get_patient_by_public_id(patient_id: str) -> Optional[dict[str, Any]]:
    ensure_store()
    session = _get_session()
    try:
        patient = session.query(Patient).filter_by(patient_id=patient_id).first()
        return _serialize_patient(patient) if patient else None
    finally:
        session.close()


def get_patient_by_user_id(user_id: str) -> Optional[dict[str, Any]]:
    ensure_store()
    session = _get_session()
    try:
        patient = session.query(Patient).filter_by(user_id=user_id).first()
        return _serialize_patient(patient) if patient else None
    finally:
        session.close()


def doctor_can_access(doctor_public_id: str, patient_public_id: str) -> bool:
    ensure_store()
    session = _get_session()
    try:
        query = (
            session.query(DoctorPatientAccess)
            .join(Doctor, Doctor.id == DoctorPatientAccess.doctor_id)
            .join(Patient, Patient.id == DoctorPatientAccess.patient_id)
            .filter(
                Doctor.doctor_id == doctor_public_id,
                Patient.patient_id == patient_public_id,
                DoctorPatientAccess.is_active.is_(True),
            )
        )
        return session.query(query.exists()).scalar()
    finally:
        session.close()


def get_doctor_patients(doctor_public_id: str) -> list[dict[str, Any]]:
    ensure_store()
    session = _get_session()
    try:
        patients = (
            session.query(Patient)
            .join(DoctorPatientAccess, Patient.id == DoctorPatientAccess.patient_id)
            .join(Doctor, Doctor.id == DoctorPatientAccess.doctor_id)
            .filter(Doctor.doctor_id == doctor_public_id, DoctorPatientAccess.is_active.is_(True))
            .all()
        )
        return [_serialize_patient(patient) for patient in patients]
    finally:
        session.close()


def get_patient_reports(patient_public_id: str) -> list[dict[str, Any]]:
    patient = get_patient_by_public_id(patient_public_id)
    return patient["reports"] if patient else []


def get_patient_vitals(patient_public_id: str) -> list[dict[str, Any]]:
    patient = get_patient_by_public_id(patient_public_id)
    if patient is None:
        return []
    latest = patient["latest_vitals"]
    base = datetime.utcnow() - timedelta(days=6)
    readings = []
    for offset in range(7):
        timestamp = (base + timedelta(days=offset)).replace(microsecond=0).isoformat() + "Z"
        readings.append(
            {
                "id": f"VIT-{patient_public_id}-{offset}",
                "patient_id": patient_public_id,
                "timestamp": timestamp,
                "heart_rate": max(52, int(latest["heart_rate"] + (offset % 3) - 1)),
                "systolic_bp": max(90, int(latest["systolic_bp"] + ((offset % 4) - 1))),
                "diastolic_bp": max(60, int(latest["diastolic_bp"] + ((offset % 3) - 1))),
                "blood_sugar": max(70, int(latest["blood_sugar"] + ((offset % 5) - 2))),
                "spo2": max(90, int(latest["oxygen_level"] - (offset % 2))),
                "temperature": 98.1 + (offset % 3) * 0.2,
                "bmi": 24.0 + (offset % 2) * 0.2,
                "respiratory_rate": 16 + (offset % 2),
                "status": "normal" if patient["risk"] in {"Low", "Moderate"} else "warning",
            }
        )
    return readings


def touch_patient(patient: Patient, timestamp: Optional[str] = None) -> None:
    patient.updated_at = timestamp or _utc_now()


def get_patient_vital_forecast(patient_public_id: str) -> dict[str, Any]:
    vitals = get_patient_vitals(patient_public_id)
    baseline = vitals[-1]["heart_rate"] if vitals else 75
    forecasts = []
    start = datetime.utcnow() + timedelta(days=1)
    for offset in range(3):
        forecasts.append(
            {
                "timestamp": (start + timedelta(days=offset)).replace(microsecond=0).isoformat() + "Z",
                "heart_rate": baseline + (offset % 2),
                "systolic_bp": vitals[-1]["systolic_bp"] if vitals else 120,
                "diastolic_bp": vitals[-1]["diastolic_bp"] if vitals else 80,
                "blood_sugar": vitals[-1]["blood_sugar"] if vitals else 95,
            }
        )
    return {"forecasts": forecasts}


def get_patient_diet_plan(patient_public_id: str) -> dict[str, Any]:
    patient = get_patient_by_public_id(patient_public_id)
    calories = 1850 if patient and patient["risk"] in {"Low", "Moderate"} else 1700
    return {
        "patient_id": patient_public_id,
        "daily_calorie_target": calories,
        "meals": [
            {"meal": "Breakfast", "time": "08:00 AM", "calories": 420, "items": ["Oats", "Fruit", "Curd"], "macros": {"protein": 18, "carbs": 58, "fat": 12}},
            {"meal": "Lunch", "time": "01:00 PM", "calories": 610, "items": ["Brown rice", "Dal", "Vegetables"], "macros": {"protein": 24, "carbs": 74, "fat": 16}},
            {"meal": "Dinner", "time": "07:30 PM", "calories": 480, "items": ["Soup", "Paneer / fish", "Salad"], "macros": {"protein": 28, "carbs": 36, "fat": 18}},
        ],
        "avoid_list": ["Processed sugar", "Excess salt", "Deep fried snacks"],
        "micronutrients": [
            {"name": "Vitamin D", "target": "600 IU", "current": "480 IU", "percentage": 80},
            {"name": "Iron", "target": "18 mg", "current": "14 mg", "percentage": 78},
        ],
    }


def get_patient_mental_health(patient_public_id: str) -> dict[str, Any]:
    patient = get_patient_by_public_id(patient_public_id)
    risk = "Low-Moderate" if patient and patient["risk"] in {"Low", "Moderate"} else "Moderate"
    return {
        "patient_id": patient_public_id,
        "date": _utc_now(),
        "wellness_score": 74 if risk == "Low-Moderate" else 61,
        "burnout_risk": risk,
        "dimensions": [
            {"subject": "Mood", "value": 72},
            {"subject": "Sleep", "value": 65},
            {"subject": "Energy", "value": 78},
            {"subject": "Focus", "value": 60},
            {"subject": "Social", "value": 70},
            {"subject": "Stress", "value": 45},
        ],
        "recommendations": [
            {"category": "Improvement Plan", "text": "Maintain consistent sleep timing."},
            {"category": "Mental Peace", "text": "Take short stress-management breaks during work."},
            {"category": "Physical Activity", "text": "Continue routine follow-up if symptoms worsen."},
        ],
    }


def get_doctor_dashboard(doctor_public_id: str) -> Optional[dict[str, Any]]:
    ensure_store()
    session = _get_session()
    try:
        doctor = session.query(Doctor).filter_by(doctor_id=doctor_public_id).first()
        if doctor is None:
            return None
        patients = get_doctor_patients(doctor_public_id)
        risk_distribution = {"Low": 0, "Moderate": 0, "High": 0, "Critical": 0}
        flags = []
        for patient in patients:
            risk_distribution[patient["risk"]] = risk_distribution.get(patient["risk"], 0) + 1
            if patient["risk"] in {"High", "Critical"}:
                flags.append({"patient": patient["full_name"], "level": patient["risk"], "flag": patient["recommendation"]})
        latest_round = session.query(FederatedRound).order_by(FederatedRound.round_number.desc()).first()
        first_model = session.query(AIModel).order_by(AIModel.version.desc()).first()
        return {
            "doctor": _serialize_doctor(doctor),
            "patients": patients,
            "overview": {
                "active_patients": len(patients),
                "critical_cases": sum(1 for patient in patients if patient["risk"] in {"High", "Critical"}),
                "consultations_today": 8,
                "ai_flags": len(flags),
            },
            "risk_distribution": risk_distribution,
            "recent_flags": flags[:3],
            "federated_snapshot": {
                "current_round": latest_round.round_number if latest_round else 0,
                "global_accuracy": latest_round.global_accuracy if latest_round else 0,
                "model_version": first_model.version if first_model else "n/a",
            },
        }
    finally:
        session.close()


def create_report_and_update_patient(
    patient_public_id: str,
    result: dict[str, Any],
    vitals: dict[str, Any],
    report_name: str,
    report_type: str,
    file_url: Optional[str] = None,
) -> dict[str, Any]:
    ensure_store()
    session = _get_session()
    try:
        patient = session.query(Patient).filter_by(patient_id=patient_public_id).first()
        if patient is None:
            raise ValueError("Patient not found.")

        patient.risk = result["risk_level"]
        patient.recommendation = result["ai_summary"]
        patient.latest_vitals = vitals
        touch_patient(patient)

        report = MedicalReport(
            report_id=result["id"],
            patient_id=patient.id,
            name=report_name,
            report_type=report_type,
            date=result["date"],
            severity_score=result["severity_score"],
            risk_level=result["risk_level"],
            findings=result["findings"],
            ai_summary=result["ai_summary"],
            follow_up=result.get("follow_up"),
            explanation=result.get("explanation"),
            recommendations=result.get("recommendations", []),
            model_version=result.get("model_version"),
            file_url=file_url,
        )
        session.add(report)
        session.commit()
        session.refresh(report)
        return _serialize_report(report, patient)
    finally:
        session.close()


def update_patient_live_tracking(
    patient_public_id: str,
    *,
    latest_vitals: Optional[dict[str, Any]] = None,
    recommendation: Optional[str] = None,
    condition: Optional[str] = None,
    risk: Optional[str] = None,
    last_visit: Optional[str] = None,
) -> dict[str, Any]:
    ensure_store()
    session = _get_session()
    try:
        patient = session.query(Patient).filter_by(patient_id=patient_public_id).first()
        if patient is None:
            raise ValueError("Patient not found.")

        if latest_vitals is not None:
            patient.latest_vitals = latest_vitals
        if recommendation is not None:
            patient.recommendation = recommendation
        if condition is not None:
            patient.condition = condition
        if risk is not None:
            patient.risk = risk
        if last_visit is not None:
            patient.last_visit = last_visit
        touch_patient(patient)

        session.commit()
        session.refresh(patient)
        return _serialize_patient(patient)
    finally:
        session.close()


def update_patient_report(
    patient_public_id: str,
    report_id: str,
    *,
    name: Optional[str] = None,
    follow_up: Optional[str] = None,
    ai_summary: Optional[str] = None,
    explanation: Optional[str] = None,
    recommendations: Optional[list[str]] = None,
    severity_score: Optional[int] = None,
    risk_level: Optional[str] = None,
) -> dict[str, Any]:
    ensure_store()
    session = _get_session()
    try:
        report = (
            session.query(MedicalReport)
            .join(Patient, MedicalReport.patient_id == Patient.id)
            .filter(Patient.patient_id == patient_public_id, MedicalReport.report_id == report_id)
            .first()
        )
        if report is None:
            raise ValueError("Report not found.")

        if name is not None:
            report.name = name
        if follow_up is not None:
            report.follow_up = follow_up
        if ai_summary is not None:
            report.ai_summary = ai_summary
        if explanation is not None:
            report.explanation = explanation
        if recommendations is not None:
            report.recommendations = recommendations
        if severity_score is not None:
            report.severity_score = severity_score
        if risk_level is not None:
            report.risk_level = risk_level

        session.commit()
        session.refresh(report)
        patient = session.query(Patient).filter_by(id=report.patient_id).first()
        if patient is None:
            raise ValueError("Patient not found.")
        touch_patient(patient)
        session.commit()
        return _serialize_report(report, patient)
    finally:
        session.close()


def delete_patient_report(patient_public_id: str, report_id: str) -> None:
    ensure_store()
    session = _get_session()
    try:
        report = (
            session.query(MedicalReport)
            .join(Patient, MedicalReport.patient_id == Patient.id)
            .filter(Patient.patient_id == patient_public_id, MedicalReport.report_id == report_id)
            .first()
        )
        if report is None:
            raise ValueError("Report not found.")

        session.delete(report)
        patient = session.query(Patient).filter_by(patient_id=patient_public_id).first()
        if patient is not None:
            touch_patient(patient)
        session.commit()
    finally:
        session.close()


def append_audit(action: str, status_value: str, node_id: str = "SYSTEM", round_value: Optional[str] = None, metadata: Optional[dict[str, Any]] = None) -> None:
    ensure_store()
    session = _get_session()
    try:
        if round_value is None:
            latest_round = session.query(FederatedRound).order_by(FederatedRound.round_number.desc()).first()
            round_value = str(latest_round.round_number if latest_round else 0)
        audit = AuditLog(
            audit_id=f"AUD-{uuid4().hex[:8].upper()}",
            timestamp=_utc_now(),
            round=round_value,
            node_id=node_id,
            action=action,
            status=status_value,
            metadata_json=metadata or {},
        )
        session.add(audit)
        session.commit()
    finally:
        session.close()


def get_nodes() -> list[dict[str, Any]]:
    ensure_store()
    session = _get_session()
    try:
        return [_serialize_node(node) for node in session.query(HospitalNode).order_by(HospitalNode.node_id).all()]
    finally:
        session.close()


def get_federation_stats() -> dict[str, Any]:
    ensure_store()
    session = _get_session()
    try:
        rounds = session.query(FederatedRound).order_by(FederatedRound.round_number).all()
        return {
            "current_round": rounds[-1].round_number if rounds else 0,
            "rounds": [_serialize_round(round_row) for round_row in rounds],
        }
    finally:
        session.close()


def start_federated_round() -> dict[str, Any]:
    ensure_store()
    session = _get_session()
    try:
        latest_round = session.query(FederatedRound).order_by(FederatedRound.round_number.desc()).first()
        latest_accuracy = latest_round.global_accuracy if latest_round else 84.0
        latest_loss = latest_round.loss if latest_round else 0.42
        next_round = (latest_round.round_number if latest_round else 0) + 1
        node_count = session.query(HospitalNode).count()
        new_round = FederatedRound(
            round_number=next_round,
            global_accuracy=round(min(latest_accuracy + 0.7, 93.5), 2),
            local_avg_accuracy=round(min(latest_accuracy - 1.2, 91.0), 2),
            loss=round(max(latest_loss - 0.04, 0.11), 3),
            nodes_participated=node_count,
            timestamp=_utc_now(),
        )
        session.add(new_round)
        session.commit()
        append_audit("federated_round_started", "success", metadata={"round": next_round})
        return {"round": next_round, "message": "Federated aggregation round started successfully."}
    finally:
        session.close()


def get_models() -> list[dict[str, Any]]:
    ensure_store()
    session = _get_session()
    try:
        return [_serialize_model(model) for model in session.query(AIModel).order_by(AIModel.version.desc()).all()]
    finally:
        session.close()


def get_audit_logs(limit: int = 50) -> list[dict[str, Any]]:
    ensure_store()
    session = _get_session()
    try:
        logs = session.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
        return [_serialize_audit(log) for log in logs]
    finally:
        session.close()


def register_patient(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_store()
    session = _get_session()
    try:
        if session.query(User).filter_by(user_id=payload["user_id"]).first():
            raise ValueError("User ID already exists.")
        user = User(user_id=payload["user_id"], password_hash=hash_password(payload["password"]), role="patient", is_active=True)
        session.add(user)
        session.flush()
        patient_id = f"PNX-{datetime.utcnow().strftime('%Y')}-{str(uuid4().int)[-5:]}"
        patient = Patient(
            patient_id=patient_id,
            user_id=user.user_id,
            full_name=payload["full_name"],
            age=int(payload["age"]),
            gender=payload["gender"],
            email=payload["email"],
            phone=payload.get("phone"),
            blood_group=payload["blood_group"],
            chronic_illness=payload.get("chronic_illness"),
            genetic_conditions=payload.get("genetic_conditions"),
            family_history=payload.get("family_history", []),
            lifestyle=payload.get("lifestyle", {}),
            condition=payload.get("condition", "General Monitoring"),
            risk="Low",
            last_visit=datetime.utcnow().strftime("%Y-%m-%d"),
            previous_disease_history=payload.get("family_history", []),
            latest_vitals={"heart_rate": 76, "systolic_bp": 118, "diastolic_bp": 78, "blood_sugar": 94, "cholesterol": 176, "ecg": "normal", "oxygen_level": 99},
            recommendation="Low immediate risk. Continue preventive monitoring and routine follow-up.",
            created_at=_utc_now(),
            updated_at=_utc_now(),
        )
        session.add(patient)
        session.commit()
        return {"patient_id": patient_id, "message": "Patient registered successfully."}
    finally:
        session.close()


def import_synthetic_dataset(
    dataset_root: str | Path,
    doctor_public_id: str = "DOC-4892",
    max_patients_per_hospital: int = 10,
) -> dict[str, Any]:
    ensure_store()
    root = Path(dataset_root)
    manifest_path = root / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"manifest.json not found in {root}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest_hospitals = {item["folder"]: item for item in manifest.get("hospitals", [])}

    session = _get_session()
    try:
        doctor = session.query(Doctor).filter_by(doctor_id=doctor_public_id).first()
        if doctor is None:
            raise ValueError(f"Doctor {doctor_public_id} not found.")

        imported_patients = 0
        imported_reports = 0
        imported_nodes = 0

        for folder in sorted(path for path in root.iterdir() if path.is_dir() and (path / "patients.csv").exists()):
            hospital_meta = manifest_hospitals.get(folder.name, {})
            node_id = str(hospital_meta.get("node_id", folder.name.upper()))
            hospital_name = str(hospital_meta.get("hospital_name", folder.name))
            location = str(hospital_meta.get("location", "Unknown"))
            patient_count = int(hospital_meta.get("patient_count", 0))

            node = session.query(HospitalNode).filter_by(node_id=node_id).first()
            if node is None:
                node = HospitalNode(
                    node_id=node_id,
                    name=hospital_name,
                    location=location,
                    status="training",
                    patient_count=patient_count,
                    local_accuracy=84.0,
                    current_round=6,
                )
                session.add(node)
                imported_nodes += 1
            else:
                node.name = hospital_name
                node.location = location
                node.patient_count = patient_count

            image_manifest_rows: dict[str, dict[str, str]] = {}
            with (folder / "image_manifest.csv").open("r", encoding="utf-8") as handle:
                for row in csv.DictReader(handle):
                    image_manifest_rows[row["patient_id"]] = row

            with (folder / "patients.csv").open("r", encoding="utf-8") as handle:
                for index, row in enumerate(csv.DictReader(handle)):
                    if index >= max_patients_per_hospital:
                        break

                    patient = session.query(Patient).filter_by(patient_id=row["patient_id"]).first()
                    if patient is None:
                        patient = Patient(
                            patient_id=row["patient_id"],
                            user_id=f"SYN-{row['patient_id']}",
                            full_name=f"Synthetic Patient {row['patient_id'][-4:]}",
                            age=int(row["age"]),
                            gender=row["gender"],
                            email=f"{row['patient_id'].lower()}@synthetic.demo",
                            blood_group="O+",
                            condition=row["condition"],
                            risk=row["risk_level"],
                            last_visit=datetime.utcnow().strftime("%Y-%m-%d"),
                            previous_disease_history=[item.strip() for item in row["previous_disease_history"].split(",") if item.strip()],
                            latest_vitals={
                                "heart_rate": int(row["heart_rate"]),
                                "systolic_bp": int(row["systolic_bp"]),
                                "diastolic_bp": int(row["diastolic_bp"]),
                                "blood_sugar": int(row["sugar_level"]),
                                "cholesterol": int(row["cholesterol"]),
                                "ecg": row["ecg"],
                                "oxygen_level": int(row["oxygen_level"]),
                            },
                            recommendation=(
                                f"Synthetic federated case suggests {row['risk_level'].lower()} risk. "
                                f"Recommend review for {row['condition'].lower()} and routine follow-up based on hospital protocol."
                            ),
                            updated_at=_utc_now(),
                        )
                        session.add(patient)
                        session.flush()
                        imported_patients += 1

                    access = (
                        session.query(DoctorPatientAccess)
                        .filter_by(doctor_id=doctor.id, patient_id=patient.id)
                        .first()
                    )
                    if access is None:
                        session.add(DoctorPatientAccess(doctor_id=doctor.id, patient_id=patient.id, is_active=True))

                    image_row = image_manifest_rows.get(row["patient_id"])
                    report_id = f"REP-SYN-{row['patient_id'][-6:]}"
                    report = session.query(MedicalReport).filter_by(report_id=report_id).first()
                    if report is None:
                        report = MedicalReport(
                            report_id=report_id,
                            patient_id=patient.id,
                            name=f"Synthetic Imaging Report {row['patient_id']}",
                            report_type="X-Ray",
                            date=_utc_now(),
                            severity_score=int(row["risk_score"]),
                            risk_level=row["risk_level"],
                            findings=[
                                f"Synthetic image label: {image_row['image_label']}" if image_row else "Synthetic image not available",
                                f"Condition cohort: {row['condition']}",
                            ],
                            ai_summary=(
                                f"Federated demo model flags {row['risk_level'].lower()} risk with primary pattern "
                                f"consistent with {row['condition'].lower()}."
                            ),
                            follow_up="Use for dashboard demo only; verify with clinician review workflow.",
                            explanation="Imported from synthetic federated dataset for academic dashboard demonstration.",
                            recommendations=[
                                "Review vitals trend alongside image label.",
                                "Use synthetic report for UI and workflow validation only.",
                            ],
                            model_version="FL-SYNTHETIC-1.0",
                            file_url=str(folder / image_row["image_path"]) if image_row else None,
                        )
                        session.add(report)
                        imported_reports += 1

        session.commit()
    finally:
        session.close()

    append_audit(
        "synthetic_dataset_imported",
        "success",
        metadata={
            "dataset_root": str(root),
            "doctor_id": doctor_public_id,
            "max_patients_per_hospital": max_patients_per_hospital,
        },
    )

    return {
        "dataset_root": str(root),
        "doctor_id": doctor_public_id,
        "max_patients_per_hospital": max_patients_per_hospital,
        "imported_patients": imported_patients,
        "imported_reports": imported_reports,
        "imported_nodes": imported_nodes,
    }
