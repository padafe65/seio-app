import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const testDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'seio_test_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create a connection pool for testing
const testPool = mysql.createPool(testDbConfig);

// Function to initialize the test database
async function initializeTestDatabase() {
  let connection;
  try {
    // Connect to MySQL without selecting a database
    connection = await mysql.createConnection({
      host: testDbConfig.host,
      user: testDbConfig.user,
      password: testDbConfig.password
    });

    // Create the test database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${testDbConfig.database}\``);
    
    // Switch to the test database
    await connection.query(`USE \`${testDbConfig.database}\``);
    
    // Import the database schema
    // Note: You'll need to create a schema.sql file with your database structure
    // or use your existing migration files
    
    console.log('Test database initialized successfully');
  } catch (error) {
    console.error('Error initializing test database:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

// Function to clear the test database
export async function clearTestDatabase() {
  try {
    const connection = await testPool.getConnection();
    
    // Get all tables in the database
    const [tables] = await connection.query(
      'SHOW TABLES'
    );
    
    // Disable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop all tables
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    }
    
    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    await connection.release();
    console.log('Test database cleared');
  } catch (error) {
    console.error('Error clearing test database:', error);
    throw error;
  }
}

export { testPool as pool };
export default testPool;
