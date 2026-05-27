import MDBReader from 'mdb-reader';
import { readFileSync } from 'fs';

const buf = readFileSync('C:/Users/Dev/source/WAGL App/WAGL2010.mdb');
const db = new MDBReader(buf);

const tables = db.getTableNames();
console.log(`\n=== WAGL2010.mdb — ${tables.length} tables ===\n`);
console.log('Tables:', tables.join(', '));

// Show schema and sample data for each table
for (const name of tables) {
  const table = db.getTable(name);
  const columns = table.getColumnNames();
  const rows = table.getData();
  console.log(`\n--- ${name} (${rows.length} rows) ---`);
  console.log('Columns:', columns.join(', '));
  // Show first 3 rows
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const row = {};
    for (const col of columns) {
      row[col] = rows[i][col];
    }
    console.log(JSON.stringify(row));
  }
}
