const { PrismaClient } = require('@prisma/client');

if (process.env.DATABASE_URL) {
	if (process.env.DATABASE_URL.includes("connection_limit=")) {
		process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/connection_limit=\d+/, 'connection_limit=20');
	} else {
		process.env.DATABASE_URL += (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "connection_limit=20";
	}
    
    // Antrian request di Prisma Pool agar saat diakses banyak siswa bersamaan tidak langsung ditolak
    if (!process.env.DATABASE_URL.includes("pool_timeout=")) {
        process.env.DATABASE_URL += "&pool_timeout=60";
    }
}

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
