-- Initialize EVE Trading Assistant Database
-- This script runs when the PostgreSQL container starts for the first time

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE eve_trading'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'eve_trading');

-- Connect to the database
\c eve_trading;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for different services
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS trading;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS users;

-- Set default search path
ALTER DATABASE eve_trading SET search_path TO public, auth, market, trading, notifications, users;

-- Create basic tables structure (will be expanded in migrations)
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- EVE Characters table
CREATE TABLE IF NOT EXISTS eve_characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    character_id BIGINT UNIQUE NOT NULL,
    character_name VARCHAR(255) NOT NULL,
    corporation_id BIGINT,
    alliance_id BIGINT,
    api_key_encrypted TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_eve_characters_user_id ON eve_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_eve_characters_character_id ON eve_characters(character_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_eve_characters_updated_at BEFORE UPDATE ON eve_characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();