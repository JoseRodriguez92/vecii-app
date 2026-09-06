const fs = require('node:fs');
const pg = require('pg');

const env = {};
for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const t = l.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  let k = t.slice(0, t.indexOf('=')), v = t.slice(t.indexOf('=') + 1).trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0]) v = v.slice(1, -1);
  env[k] = v;
}

(async () => {
  for (const nombre of ['DIRECT_URL', 'DATABASE_URL']) {
    const c = new pg.Client({ connectionString: env[nombre], ssl: { rejectUnauthorized: false } });
    try {
      await c.connect();
      const r = await c.query("select table_name from information_schema.tables where table_schema='public' order by 1");
      console.log(`${nombre.padEnd(13)} CONECTA  -> ${r.rows.length} tablas: ${r.rows.map(x => x.table_name).join(', ') || '(ninguna)'}`);
      await c.end();
    } catch (e) {
      console.log(`${nombre.padEnd(13)} FALLA    -> ${e.message}`);
    }
  }
})();
