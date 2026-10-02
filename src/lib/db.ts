import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// SQLite has one writer. A single connection prevents competing interactive
// transactions from starving the transaction already holding its write lock.
const databaseUrl = process.env.DATABASE_URL;
const sqliteUrl = databaseUrl?.startsWith('file:')
  ? `${databaseUrl.split('?')[0]}?${(() => {
      const params = new URLSearchParams(databaseUrl.split('?')[1]);
      params.set('connection_limit', '1');
      return params.toString();
    })()}`
  : databaseUrl;

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    ...(sqliteUrl ? { datasourceUrl: sqliteUrl } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db