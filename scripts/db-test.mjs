// Roda os testes SQL de supabase/tests/ (cada arquivo numa transação desfeita no final).
// Uso: DATABASE_URL no .env → `npm run test:db`. Passe "perf" para incluir o teste de desempenho.
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL no .env (veja .env.example).');
  process.exit(1);
}
const dir = path.resolve(import.meta.dirname, '../supabase/tests');
const files = ['biblioteca_test.sql', ...(process.argv.includes('perf') ? ['biblioteca_perf.sql'] : [])];

const client = new pg.Client({ connectionString: url, ssl: url.includes('localhost') ? false : { rejectUnauthorized: false } });
await client.connect();
for (const file of files) {
  try {
    const results = await client.query(await fs.readFile(path.join(dir, file), 'utf8'));
    const last = [...(Array.isArray(results) ? results : [results])].reverse().find((r) => r.rows?.length);
    console.log(`✓ ${file}`);
    if (last) console.table(last.rows);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error(`✗ ${file}: ${err.message}`);
    process.exitCode = 1;
  }
}
await client.end();
