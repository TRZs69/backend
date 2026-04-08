const { PrismaClient } = require('@prisma/client');

const DEFAULT_CONNECTION_LIMIT = process.env.NODE_ENV === 'production' ? 5 : 50;
const configuredLimit = Number(process.env.PRISMA_CONNECTION_LIMIT) || DEFAULT_CONNECTION_LIMIT;
const connectionLimit = Number.isInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : DEFAULT_CONNECTION_LIMIT;

const datasourceUrl = process.env.PRISMA_URL || process.env.DATABASE_URL;
const dbUrl = datasourceUrl ? appendConnectionLimit(datasourceUrl, connectionLimit) : undefined;

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
});

globalForPrisma.prisma = prisma;

function appendConnectionLimit(url, limit) {
  const param = `connection_limit=${limit}`;
  if (url.includes('connection_limit=')) {
    return url.replace(/connection_limit=\d+/, param);
  }
  return `${url}${url.includes('?') ? '&' : '?'}${param}`;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
