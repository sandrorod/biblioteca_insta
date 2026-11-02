// Aplica as migrations de supabase/migrations/ que ainda não rodaram, cada uma numa transação.
// Uso: DATABASE_URL no .env → `npm run db:migrate`. O controle fica na tabela biblioteca_schema_migrations.
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const dir = path.resolve(import.meta.dirname, '../supabase/migrations');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL no .env (veja .env.example).');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: url.includes('localhost') ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query(`
  create table if not exists public.biblioteca_schema_migrations (version text primary key, applied_at timestamptz not null default now());
  alter table public.biblioteca_schema_migrations enable row level security;
  revoke all on public.biblioteca_schema_migrations from anon, authenticated;
`);
const { rows } = await client.query('select version from public.biblioteca_schema_migrations');
const applied = new Set(rows.map((r) => r.version));
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

let count = 0;
for (const file of files) {
  const version = file.replace(/\.sql$/, '');
  if (applied.has(version)) continue;
  const sql = await fs.readFile(path.join(dir, file), 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into public.biblioteca_schema_migrations (version) values ($1)', [version]);
    await client.query('commit');
    console.log(`✓ ${file}`);
    count++;
  } catch (err) {
    await client.query('rollback');
    console.error(`✗ ${file}: ${err.message}`);
    process.exitCode = 1;
    break;
  }
}
console.log(count ? `${count} migration(s) aplicada(s).` : 'Nenhuma migration pendente.');
await client.end();
