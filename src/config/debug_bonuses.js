const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DRIVER_ID = '85fb80236ffa474db93fdccd0cdab66b'; // From logs

async function debugBonuses() {
  console.log('Connecting to database...');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'g2g_bonus_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const connection = await pool.getConnection();
    console.log(`Checking bonuses for driver: ${DRIVER_ID}`);

    // 1. Check Driver Status
    const [driver] = await connection.query('SELECT * FROM drivers WHERE driver_id = ?', [DRIVER_ID]);
    console.log('Driver Record:', driver[0]);

    // 2. Check Bonuses
    const [bonuses] = await connection.query('SELECT * FROM bonuses WHERE driver_id = ?', [DRIVER_ID]);
    console.log(`Found ${bonuses.length} bonus records:`);
    bonuses.forEach(b => {
        console.log(` - ID: ${b.id}, Date: ${b.week_date}, Amount: ${b.net_payout}, PaymentID: ${b.payment_id}`);
    });

    // 3. Check Aggregation
    const [agg] = await connection.query(`
        SELECT 
          d.driver_id,
          SUM(b.net_payout) as total_pending,
          COUNT(b.id) as weeks_pending
        FROM drivers d
        JOIN bonuses b ON d.driver_id = b.driver_id
        WHERE d.verified = FALSE AND b.payment_id IS NULL AND d.driver_id = ?
        GROUP BY d.driver_id
    `, [DRIVER_ID]);
    console.log('Aggregation Query Result:', agg[0]);

    connection.release();
  } catch (error) {
    console.error('Debug failed:', error);
  } finally {
    pool.end();
  }
}

debugBonuses();
