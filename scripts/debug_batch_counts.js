const pool = require("../src/config/database");

async function debugBatch() {
  try {
    const batchId = "BATCH-20260114-1001-00001"; // From user's previous message
    console.log(`Debugging Batch: ${batchId}`);

    // 1. Get Batch Info
    const [batches] = await pool.query(
      "SELECT * FROM payment_batches WHERE batch_id = ?",
      [batchId]
    );
    if (batches.length === 0) {
      console.log("Batch not found!");
      return;
    }
    const batch = batches[0];
    console.log("Batch Record:", batch);

    // 2. Count Payments Linked to this Batch Internal ID
    const [payments] = await pool.query(
      "SELECT id, status, total_amount FROM payments WHERE batch_internal_id = ?",
      [batch.id]
    );
    console.log(`Total Payments Found: ${payments.length}`);
    console.log(
      "Payment Statuses:",
      payments.map((p) => p.status)
    );

    // List All Batches
    const query = `
        SELECT pb.batch_id,
               pb.driver_count,
               COUNT(p.id) as payment_count,
               SUM(CASE WHEN p.status = 'paid' THEN 1 ELSE 0 END) as paid_count,
               pb.status
        FROM payment_batches pb
        LEFT JOIN payments p ON pb.id = p.batch_internal_id
        GROUP BY pb.id
        ORDER BY pb.exported_at DESC
        LIMIT 5
      `;
    const [results] = await pool.query(query);
    console.table(results);
  } catch (error) {
    console.error("Debug Error:", error);
  } finally {
    process.exit();
  }
}

debugBatch();
