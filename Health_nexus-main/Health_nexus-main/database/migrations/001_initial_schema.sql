-- =============================================
-- HEALTH NEXUS — Migration 001: Initial Schema
-- Run after schema.sql is applied.
-- Alembic version tracking.
-- =============================================

CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL PRIMARY KEY
);

INSERT INTO alembic_version (version_num) VALUES ('001_initial_schema')
ON CONFLICT DO NOTHING;
