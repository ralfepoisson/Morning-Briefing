import process from 'node:process';
import { Client } from 'pg';

function stripQuery(value: string): string {
  return value.split('?')[0] ?? value;
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"';
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const targetUrl = new URL(databaseUrl);
  const databaseName = stripQuery(targetUrl.pathname.replace(/^\//, ''));

  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name.');
  }

  const adminUrl = new URL(process.env.DATABASE_ADMIN_URL || databaseUrl);
  adminUrl.pathname = '/' + (stripQuery(adminUrl.pathname.replace(/^\//, '')) || 'postgres');

  const client = new Client({
    connectionString: adminUrl.toString()
  });

  await client.connect();

  try {
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName]
    );

    if (result.rowCount && result.rowCount > 0) {
      console.log(`Database "${databaseName}" already exists.`);
      return;
    }

    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`Database "${databaseName}" created.`);
  } finally {
    await client.end();
  }
}

main().catch(function handleError(error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
