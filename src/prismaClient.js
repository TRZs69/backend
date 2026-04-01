const { PrismaClient } = require('@prisma/client');

if (process.env.DATABASE_URL) {
	if (process.env.DATABASE_URL.includes("connection_limit=")) {
		process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/connection_limit=\d+/, 'connection_limit=15');
	} else {
		process.env.DATABASE_URL += (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "connection_limit=15";
	}
}

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

module.exports = prisma;
