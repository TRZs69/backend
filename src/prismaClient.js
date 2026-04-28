const { PrismaClient } = require('@prisma/client');

if (process.env.DATABASE_URL) {
	const connectionLimit = process.env.DB_CONNECTION_LIMIT;
	const poolTimeout = process.env.DB_POOL_TIMEOUT;

	if (process.env.DATABASE_URL.includes("connection_limit=")) {
		process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
			/connection_limit=\d+/,
			`connection_limit=${connectionLimit}`
		);
	} else {
		process.env.DATABASE_URL +=
			(process.env.DATABASE_URL.includes("?") ? "&" : "?") +
			`connection_limit=${connectionLimit}`;
	}

	if (!process.env.DATABASE_URL.includes("pool_timeout=")) {
		process.env.DATABASE_URL += `&pool_timeout=${poolTimeout}`;
	}
}

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
