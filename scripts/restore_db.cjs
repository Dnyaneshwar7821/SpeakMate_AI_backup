const fs = require('fs');
const path = require('path');

// Resolve pg
function resolvePg() {
  const candidates = [
    path.resolve(__dirname, '../SpeakMateAI-Frontend/node_modules/pg'),
    path.resolve(__dirname, '../Admin_Frontend/node_modules/pg'),
    'pg'
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (e) {}
  }
  throw new Error("Could not locate 'pg' module.");
}
const { Client } = resolvePg();

// Load .env
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const connStr = process.argv[2] || process.env.DATABASE_URL;

if (!connStr) {
  console.error("❌ Error: No connection string found in arguments or .env");
  process.exit(1);
}

// Convert pooler to direct for schema/restore operations
const targetConnectionString = connStr.replace('-pooler', '');

async function run() {
  const startTime = Date.now();
  console.log("==================================================");
  console.log("SPEAKMATE AI - BULLETPROOF DATABASE RESTORE");
  console.log("Connecting to target Neon DB...");
  console.log("==================================================");

  const client = new Client({ connectionString: targetConnectionString });
  await client.connect();

  const backupJsonPath = path.resolve(__dirname, '../speakmate_db_backup.json');
  const backupData = JSON.parse(fs.readFileSync(backupJsonPath, 'utf8'));
  const backupTables = Object.keys(backupData);

  console.log("Step 1: Aligning missing columns and schema...");
  for (const table of backupTables) {
    const backupCols = backupData[table].columns;

    const tableExists = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=$1;`,
      [table]
    );

    if (tableExists.rows.length === 0) {
      console.log(`Creating table: ${table}`);
      const colDefs = backupCols.map(c => `"${c.column_name}" ${c.data_type}`);
      await client.query(`CREATE TABLE public."${table}" (\n  ${colDefs.join(',\n  ')}\n);`);
    } else {
      const existingColsRes = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1;`,
        [table]
      );
      const existingColNames = new Set(existingColsRes.rows.map(r => r.column_name));

      for (const col of backupCols) {
        if (!existingColNames.has(col.column_name)) {
          console.log(`Adding missing column "${col.column_name}" to table "${table}"`);
          let alterSql = `ALTER TABLE public."${table}" ADD COLUMN IF NOT EXISTS "${col.column_name}" ${col.data_type}`;
          if (col.column_default) alterSql += ` DEFAULT ${col.column_default}`;
          await client.query(alterSql);
        }
      }
    }
  }

  console.log("\nStep 2: Recording and temporarily dropping foreign key and check constraints...");
  const fkRes = await client.query(`
    SELECT
      conname AS constraint_name,
      conrelid::regclass::text AS table_name,
      pg_get_constraintdef(c.oid) AS constraint_def,
      contype
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE contype IN ('f', 'c') AND n.nspname = 'public';
  `);
  const constraints = fkRes.rows;
  console.log(`Found ${constraints.length} constraints (FK & Check) to lift.`);

  for (const c of constraints) {
    const cleanTable = c.table_name.replace(/^public\./, '').replace(/"/g, '');
    await client.query(`ALTER TABLE public."${cleanTable}" DROP CONSTRAINT IF EXISTS "${c.constraint_name}";`);
  }
  console.log("All constraints temporarily lifted.");

  console.log("\nStep 3: Truncating existing rows in target tables...");
  for (const table of backupTables) {
    try {
      await client.query(`TRUNCATE TABLE public."${table}" CASCADE;`);
    } catch (e) {
      try {
        await client.query(`DELETE FROM public."${table}";`);
      } catch (e2) {}
    }
  }

  console.log("\nStep 4: Inserting current backup data rows...");
  const summary = [];

  for (const table of backupTables) {
    const { columns, rows } = backupData[table];
    let inserted = 0;

    if (rows.length > 0) {
      const colNames = columns.map(c => `"${c.column_name}"`).join(', ');
      const BATCH_SIZE = 50;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const valuesList = [];
        const params = [];
        let paramIdx = 1;

        for (const row of batch) {
          const rowPlaceholders = [];
          for (const col of columns) {
            rowPlaceholders.push(`$${paramIdx++}`);
            let val = row[col.column_name];
            params.push(val === undefined ? null : val);
          }
          valuesList.push(`(${rowPlaceholders.join(', ')})`);
        }

        const insertQuery = `
          INSERT INTO public."${table}" (${colNames})
          VALUES ${valuesList.join(', ')}
          ON CONFLICT DO NOTHING;
        `;
        const res = await client.query(insertQuery, params);
        inserted += (res.rowCount || 0);
      }
    }

    summary.push({ table, rows: inserted });
    console.log(`Restored: "${table}" (${inserted} rows)`);
  }

  console.log("\nStep 5: Re-creating constraints...");
  let restoredCount = 0;
  for (const c of constraints) {
    const cleanTable = c.table_name.replace(/^public\./, '').replace(/"/g, '');
    try {
      await client.query(`
        ALTER TABLE public."${cleanTable}"
        ADD CONSTRAINT "${c.constraint_name}" ${c.constraint_def};
      `);
      restoredCount++;
    } catch (e) {
      console.warn(`Notice: Skipped outdated constraint ${c.constraint_name} on ${cleanTable}`);
    }
  }
  console.log(`Re-created ${restoredCount} of ${constraints.length} constraints.`);

  console.log("\nStep 6: Synchronizing auto-increment sequences...");
  for (const table of backupTables) {
    try {
      const seqRes = await client.query(`
        SELECT column_name, pg_get_serial_sequence('public."' || $1 || '"', column_name) as seq
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND (is_identity = 'YES' OR column_default LIKE 'nextval%');
      `, [table]);

      for (const row of seqRes.rows) {
        if (row.seq) {
          await client.query(`
            SELECT setval('${row.seq}', COALESCE((SELECT MAX("${row.column_name}") FROM public."${table}"), 1));
          `);
        }
      }
    } catch (e) {}
  }

  console.log("\n==================================================");
  console.log(`✅ RESTORE FULLY COMPLETED in ${((Date.now() - startTime) / 1000).toFixed(2)}s!`);
  console.log("==================================================");
  console.table(summary);

  await client.end();
}

run().catch(err => {
  console.error("❌ Restore execution failed:", err);
  process.exit(1);
});
