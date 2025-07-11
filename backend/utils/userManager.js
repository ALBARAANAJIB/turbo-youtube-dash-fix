// backend/utils/userManager.js

const { Pool } = require('pg');

class UserManager {
    constructor(pool) {
        this.pool = pool;
        this.freeLimit = 7; // Default free limit for non-pioneer users
    }

    /**
     * Retrieves an existing user from the database or creates a new one if not found.
     * @param {string} userId - The unique ID of the user.
     * @returns {Promise<Object>} The user object from the database.
     */
    async getOrCreateUser(userId) {
        try {
            // First, try to get the existing user
            const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [userId]);

            if (result.rows.length > 0) {
                return result.rows[0]; // User found
            } else {
                // User doesn't exist, create a new one
                // Initialize daily_summary_count to 0, last_summary_date to CURRENT_DATE
                // registered_at to CURRENT_TIMESTAMP
                const newUserResult = await this.pool.query(
                    'INSERT INTO users (id, is_pioneer, daily_summary_count, last_summary_date, registered_at) VALUES ($1, FALSE, 0, CURRENT_DATE, CURRENT_TIMESTAMP) RETURNING *',
                    [userId]
                );
                console.log(`✅ New user created: ${userId}`);
                return newUserResult.rows[0];
            }
        } catch (error) {
            console.error(`❌ Error in getOrCreateUser for ${userId}:`, error);
            throw new Error('Database error during user retrieval or creation.');
        }
    }

    /**
     * Records a summary request for a user, handling daily resets and increments.
     * This function should be called AFTER a summary has been successfully generated.
     * @param {string} userId - The unique ID of the user.
     * @returns {Promise<number>} The updated daily summary count.
     */
    async recordSummaryRequest(userId) {
        try {
            const user = await this.getOrCreateUser(userId); // Get latest user data (or create if new)

            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize today's date to midnight for comparison

            let currentDailyCount = user.daily_summary_count;
            let lastSummaryDate = user.last_summary_date ? new Date(user.last_summary_date) : null;
            if (lastSummaryDate) {
                lastSummaryDate.setHours(0, 0, 0, 0); // Normalize stored date to midnight
            }

            // Check if it's a new day since the last summary request
            // If lastSummaryDate is null (new user) or if it's a past date
            if (!lastSummaryDate || lastSummaryDate.getTime() < today.getTime()) {
                console.log(`🔄 Daily count reset for user ${userId} (new day or first request).`);
                currentDailyCount = 1; // Reset count and start with 1 for the new day
            } else {
                // Same day, just increment the count
                currentDailyCount++;
            }

            // Update the database with the new count and today's date
            const updateResult = await this.pool.query(
                'UPDATE users SET daily_summary_count = $1, last_summary_date = CURRENT_DATE WHERE id = $2 RETURNING daily_summary_count',
                [currentDailyCount, userId]
            );

            const newCount = updateResult.rows[0].daily_summary_count;
            console.log(`📊 Updated summary count for ${userId}: ${newCount}`);
            return newCount;

        } catch (error) {
            console.error(`❌ Error recording summary request for user ${userId}:`, error);
            throw new Error('Failed to record summary request.');
        }
    }

    /**
     * Checks if a user is eligible to make a summary request.
     * This function performs the eligibility check WITHOUT modifying the count in the DB.
     * @param {string} userId - The unique ID of the user.
     * @param {number} [freeLimit] - Optional: custom free limit for this check. Defaults to this.freeLimit.
     * @returns {Promise<{canProceed: boolean, remaining: number|string, message?: string}>} Eligibility status.
     */
    async canMakeSummaryRequest(userId, freeLimit = this.freeLimit) {
        try {
            const user = await this.getOrCreateUser(userId); // Get user's current data

            // Pioneer users have unlimited access, always allow
            if (user.is_pioneer) {
                console.log(`🌟 Pioneer user ${userId} - unlimited access granted`);
                return { canProceed: true, remaining: 'Unlimited' };
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize today's date

            let currentDailyCount = user.daily_summary_count;
            let lastSummaryDate = user.last_summary_date ? new Date(user.last_summary_date) : null;
            if (lastSummaryDate) {
                lastSummaryDate.setHours(0, 0, 0, 0); // Normalize stored date
            }

            // IMPORTANT: For the purpose of CHECKING, if it's a new day,
            // conceptually the count resets to 0. The actual DB reset happens in recordSummaryRequest.
            if (!lastSummaryDate || lastSummaryDate.getTime() < today.getTime()) {
                currentDailyCount = 0; // Treat as 0 for this check, as it will be reset on first new-day request
            }

            const remaining = freeLimit - currentDailyCount;

            if (remaining > 0) {
                console.log(`✅ User ${userId} can proceed - ${remaining} requests remaining`);
                return { canProceed: true, remaining: remaining };
            } else {
                console.log(`❌ User ${userId} has reached daily limit (${freeLimit} requests).`);
                // --- ADDED DIAGNOSTIC LOG HERE ---
                const returnObject = { canProceed: false, remaining: 0, message: `Daily summary limit (${freeLimit}) reached for today.` };
                console.log(`DEBUG: canMakeSummaryRequest returning:`, returnObject);
                return returnObject;
                // --- END ADDED DIAGNOSTIC LOG ---
            }
        } catch (error) {
            console.error(`❌ Error checking summary request eligibility for user ${userId}:`, error);
            throw new Error('Failed to check summary eligibility.');
        }
    }

    /**
     * Upgrades a user to pioneer status (sets is_pioneer to TRUE).
     * @param {string} userId - The ID of the user to upgrade.
     * @returns {Promise<Object>} The updated user object.
     */
    async upgradeToPioneer(userId) {
        try {
            const upgradeQuery = `
                UPDATE users
                SET is_pioneer = TRUE
                WHERE id = $1
                RETURNING *
            `;
            const result = await this.pool.query(upgradeQuery, [userId]);
            if (result.rows.length > 0) {
                console.log(`✨ User ${userId} upgraded to Pioneer status.`);
                return result.rows[0];
            } else {
                throw new Error(`User ${userId} not found for pioneer upgrade.`);
            }
        } catch (error) {
            console.error(`❌ Error upgrading user ${userId} to pioneer:`, error);
            throw new Error('Failed to upgrade user to pioneer status.');
        }
    }

    /**
     * Retrieves a user's statistics.
     * @param {string} userId - The unique ID of the user.
     * @returns {Promise<Object>} An object containing user stats.
     */
    async getUserStats(userId) {
        try {
            const user = await this.getOrCreateUser(userId); // Ensure user exists and get data
            return {
                userId: user.id,
                isPioneer: user.is_pioneer,
                dailyCount: user.daily_summary_count,
                lastSummaryDate: user.last_summary_date,
                registeredAt: user.registered_at
            };
        } catch (error) {
            console.error(`❌ Error getting user stats for ${userId}:`, error);
            throw error;
        }
    }
}

module.exports = UserManager;