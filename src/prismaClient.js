const { PrismaClient } = require('@prisma/client');

if (process.env.DATABASE_URL) {
	if (process.env.DATABASE_URL.includes("connection_limit=")) {
		process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/connection_limit=\d+/, 'connection_limit=50');
	} else {
		process.env.DATABASE_URL += (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "connection_limit=50";
	}
}

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

// Add connection retry logic
const connectWithRetry = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('Database connected successfully');
      return;
    } catch (error) {
      console.error(`Database connection attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, disconnecting from database...');
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, disconnecting from database...');
  await prisma.$disconnect();
});

// Connect on startup
connectWithRetry().catch(console.error);

module.exports = prisma;
