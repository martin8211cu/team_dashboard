import pg from "pg";

const { Client } = pg;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function targetDatabaseName(connectionUrl: string): string {
  const url = new URL(connectionUrl);
  const name = decodeURIComponent(url.pathname.replace(/^\//, "") || "postgres");
  if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(
      `Database name "${name}" cannot be auto-created (use letters, digits, underscore, hyphen; start with letter or _)`,
    );
  }
  return name;
}

function adminConnectionUrl(connectionUrl: string): string {
  const url = new URL(connectionUrl);
  const adminDb = process.env.DATABASE_ADMIN_DATABASE?.trim() || "postgres";
  url.pathname = `/${adminDb}`;
  return url.toString();
}

export async function ensureDatabaseExists(connectionUrl: string): Promise<void> {
  const databaseName = targetDatabaseName(connectionUrl);
  if (databaseName === "postgres" || databaseName === "template1") {
    return;
  }

  const client = new Client({ connectionString: adminConnectionUrl(connectionUrl) });
  try {
    await client.connect();
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      databaseName,
    ]);
    if ((exists.rowCount ?? 0) > 0) {
      return;
    }
    await client.query(`CREATE DATABASE ${quoteIdent(databaseName)}`);
    console.log(`Created database ${databaseName}`);
  } finally {
    await client.end();
  }
}
