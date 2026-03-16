/**
 * Simple Login System - PostgreSQL Schema
 * 在 Supabase SQL Editor 中执行这个脚本
 */

-- ============================================
-- USERS 表 - 用户账户信息
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);

-- ============================================
-- 可选：插入测试用户（密码：123456，已哈希）
-- ============================================
/*
INSERT INTO users (username, password) VALUES
('testuser', '$2a$10$exampleHashedPasswordHere');
*/
