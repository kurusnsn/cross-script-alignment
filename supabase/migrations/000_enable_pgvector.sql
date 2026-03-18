-- Migration: Enable pgvector extension
-- Created: 2025-01-20

-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;