
-- Users table for rate limiting and subscription management
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    is_pioneer BOOLEAN DEFAULT FALSE,
    daily_summary_count INTEGER DEFAULT 0,
    last_summary_date DATE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on last_summary_date for better query performance
CREATE INDEX IF NOT EXISTS idx_users_last_summary_date ON users(last_summary_date);

-- Create an index on is_pioneer for quick filtering
CREATE INDEX IF NOT EXISTS idx_users_is_pioneer ON users(is_pioneer);
