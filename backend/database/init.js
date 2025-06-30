
// Database initialization utilities

const fs = require('fs');
const path = require('path');

class DatabaseInitializer {
    constructor(pool) {
        this.pool = pool;
    }

    async initializeDatabase() {
        try {
            console.log('🗄️ Initializing database schema...');
            
            // Read and execute schema.sql
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            
            await this.pool.query(schemaSql);
            console.log('✅ Database schema initialized successfully!');
            
            // Check if tables exist and show count
            const userCountResult = await this.pool.query('SELECT COUNT(*) FROM users');
            const userCount = userCountResult.rows[0].count;
            console.log(`📊 Users table ready - ${userCount} existing users`);
            
            return true;
        } catch (error) {
            console.error('❌ Error initializing database:', error);
            throw error;
        }
    }

    async healthCheck() {
        try {
            const result = await this.pool.query('SELECT NOW() as current_time');
            console.log('💓 Database health check passed:', result.rows[0].current_time);
            return true;
        } catch (error) {
            console.error('❌ Database health check failed:', error);
            return false;
        }
    }
}

module.exports = DatabaseInitializer;
