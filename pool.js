require('dotenv').config()
const mysql2 = require('mysql2')


const env = process.env

/**
 * Fill in the .env with DB connection data
 */
const pool = mysql2.createPool(
    {
        host: env.AUTH_DB_HOST,
        port: env.AUTH_DB_PORT,
        user: env.AUTH_DB_USER,
        password: env.AUTH_DB_PASSWORD,
        database: env.AUTH_DB_DB,
        waitForConnections: env.AUTH_WAIT_FOR_CONNECTION || true,
        connectionLimit: env.AUTH_CONNECTION_LIMIT || 10,
        queueLimit: env.AUTH_QUEUE_LIMIT || 0
    }
)

module.exports = pool.promise()