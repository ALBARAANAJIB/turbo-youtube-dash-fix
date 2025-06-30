
// User management utilities for rate limiting and subscription handling

const { Pool } = require('pg');

class UserManager {
    constructor(pool) {
        this.pool = pool;
    }

    // Get or create user in database
    async getOrCreateUser(userId) {
        try {
            // First try to get existing user
            const getUserQuery = 'SELECT * FROM users WHERE id = $1';
            const result = await this.pool.query(getUserQuery, [userId]);

            if (result.rows.length > 0) {
                return result.rows[0];
            }

            // User doesn't exist, create new one
            const createUserQuery = `
                INSERT INTO users (id, is_pioneer, daily_summary_count, last_summary_date)
                VALUES ($1, FALSE, 0, CURRENT_DATE)
                RETURNING *
            `;
            const newUserResult = await this.pool.query(createUserQuery, [userId]);
            console.log(`✅ New user created: ${userId}`);
            return newUserResult.rows[0];

        } catch (error) {
            console.error('❌ Error in getOrCreateUser:', error);
            throw error;
        }
    }

    // Check if user can make summary request
    async canMakeSummaryRequest(userId, freeLimit = 3) {
        try {
            const user = await this.getOrCreateUser(userId);

            // Pioneer users have unlimited access
            if (user.is_pioneer) {
                console.log(`🌟 Pioneer user ${userId} - unlimited access granted`);
                return { canProceed: true, isPioneer: true, remainingCount: -1 };
            }

            // Check if it's a new day (reset counter if needed)
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            if (user.last_summary_date !== today) {
                // Reset daily count for new day
                const resetQuery = `
                    UPDATE users 
                    SET daily_summary_count = 0, last_summary_date = CURRENT_DATE
                    WHERE id = $1
                    RETURNING daily_summary_count
                `;
                await this.pool.query(resetQuery, [userId]);
                user.daily_summary_count = 0;
                console.log(`🔄 Daily count reset for user ${userId}`);
            }

            // Check if user has exceeded daily limit
            if (user.daily_summary_count >= freeLimit) {
                console.log(`⛔ User ${userId} has reached daily limit (${freeLimit})`);
                return { 
                    canProceed: false, 
                    isPioneer: false, 
                    remainingCount: 0,
                    limitReached: true 
                };
            }

            const remainingCount = freeLimit - user.daily_summary_count;
            console.log(`✅ User ${userId} can proceed - ${remainingCount} requests remaining`);
            return { 
                canProceed: true, 
                isPioneer: false, 
                remainingCount: remainingCount 
            };

        } catch (error) {
            console.error('❌ Error checking user permissions:', error);
            throw error;
        }
    }

    // Increment user's daily summary count
    async incrementSummaryCount(userId) {
        try {
            const updateQuery = `
                UPDATE users 
                SET daily_summary_count = daily_summary_count + 1,
                    last_summary_date = CURRENT_DATE
                WHERE id = $1
                RETURNING daily_summary_count
            `;
            const result = await this.pool.query(updateQuery, [userId]);
            const newCount = result.rows[0]?.daily_summary_count || 0;
            console.log(`📊 Updated summary count for ${userId}: ${newCount}`);
            return newCount;

        } catch (error) {
            console.error('❌ Error incrementing summary count:', error);
            throw error;
        }
    }

    // Upgrade user to pioneer status
    async upgradeToPioneer(userId) {
        try {
            const upgradeQuery = `
                UPDATE users 
                SET is_pioneer = TRUE
                WHERE id = $1
                RETURNING *
            `;
            const result = await this.pool.query(upgradeQuery, [userId]);
            console.log(`🌟 User ${userId} upgraded to Pioneer status`);
            return result.rows[0];

        } catch (error) {
            console.error('❌ Error upgrading user to pioneer:', error);
            throw error;
        }
    }

    // Get user stats
    async getUserStats(userId) {
        try {
            const user = await this.getOrCreateUser(userId);
            return {
                userId: user.id,
                isPioneer: user.is_pioneer,
                dailyCount: user.daily_summary_count,
                lastSummaryDate: user.last_summary_date,
                registeredAt: user.registered_at
            };
        } catch (error) {
            console.error('❌ Error getting user stats:', error);
            throw error;
        }
    }
}

module.exports = UserManager;
