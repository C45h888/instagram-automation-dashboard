-- ==========================================
-- TOKEN ENCRYPTION FUNCTIONS
-- ==========================================
-- File: supabase/migrations/003_add_token_encryption_functions.sql
-- Purpose: Add encryption/decryption functions for Instagram tokens
-- Required by: backend.api/services/instagram-tokens.js
--
-- These functions use Supabase's built-in pgsodium extension
-- for secure encryption at rest
-- ==========================================

-- Enable pgsodium extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- ==========================================
-- FUNCTION: encrypt_instagram_token
-- ==========================================
-- Encrypts an Instagram access token using pgsodium
--
-- @param token TEXT - The plain text token to encrypt
-- @returns TEXT - The encrypted token (base64 encoded)
--
-- Usage:
--   SELECT encrypt_instagram_token('EAABw...');
-- ==========================================
CREATE OR REPLACE FUNCTION encrypt_instagram_token(token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key BYTEA;
  encrypted_data BYTEA;
BEGIN
  -- Get encryption key from environment (set in Supabase dashboard)
  -- Alternative: Use a fixed key stored in vault
  encryption_key := pgsodium.crypto_secretbox_keygen();

  -- Encrypt the token
  encrypted_data := pgsodium.crypto_secretbox(
    convert_to(token, 'utf8'),
    pgsodium.crypto_secretbox_noncegen(),
    encryption_key
  );

  -- Return base64 encoded encrypted data
  RETURN encode(encrypted_data, 'base64');
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Token encryption failed: %', SQLERRM;
END;
$$;

-- ==========================================
-- FUNCTION: decrypt_instagram_token
-- ==========================================
-- Decrypts an Instagram access token
--
-- @param encrypted_token TEXT - The base64 encoded encrypted token
-- @returns TEXT - The decrypted plain text token
--
-- Usage:
--   SELECT decrypt_instagram_token('base64_encrypted_string');
-- ==========================================
CREATE OR REPLACE FUNCTION decrypt_instagram_token(encrypted_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key BYTEA;
  encrypted_data BYTEA;
  decrypted_data BYTEA;
BEGIN
  -- Decode base64 encrypted data
  encrypted_data := decode(encrypted_token, 'base64');

  -- Get the same encryption key used for encryption
  encryption_key := pgsodium.crypto_secretbox_keygen();

  -- Decrypt the token
  decrypted_data := pgsodium.crypto_secretbox_open(
    encrypted_data,
    pgsodium.crypto_secretbox_noncegen(),
    encryption_key
  );

  -- Return decrypted text
  RETURN convert_from(decrypted_data, 'utf8');
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Token decryption failed: %', SQLERRM;
END;
$$;

-- ==========================================
-- SIMPLER ALTERNATIVE: Use AES Encryption
-- ==========================================
-- The above functions use pgsodium which requires key management
-- A simpler approach uses PostgreSQL's built-in pgcrypto with a fixed key

-- Drop the pgsodium functions if you prefer this approach
-- DROP FUNCTION IF EXISTS encrypt_instagram_token(TEXT);
-- DROP FUNCTION IF EXISTS decrypt_instagram_token(TEXT);

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create or replace with pgcrypto-based functions
CREATE OR REPLACE FUNCTION encrypt_instagram_token(token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- IMPORTANT: Store this encryption key in Supabase Vault in production
  -- For now, using a placeholder. Replace with actual key from env/vault
  encryption_key TEXT := 'your-32-character-encryption-key-here-replace-me';
BEGIN
  -- Encrypt using AES-256
  RETURN encode(
    pgp_sym_encrypt(token, encryption_key),
    'base64'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Token encryption failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_instagram_token(encrypted_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Must match the encryption key above
  encryption_key TEXT := 'your-32-character-encryption-key-here-replace-me';
BEGIN
  -- Decrypt using AES-256
  RETURN pgp_sym_decrypt(
    decode(encrypted_token, 'base64'),
    encryption_key
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Token decryption failed: %', SQLERRM;
END;
$$;

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================
-- Allow the service role to execute these functions
GRANT EXECUTE ON FUNCTION encrypt_instagram_token(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_instagram_token(TEXT) TO service_role;

-- ==========================================
-- TEST THE FUNCTIONS
-- ==========================================
-- Uncomment to test:
-- SELECT encrypt_instagram_token('test_token_123') AS encrypted;
-- SELECT decrypt_instagram_token(encrypt_instagram_token('test_token_123')) AS decrypted;
-- Expected: decrypted = 'test_token_123'
