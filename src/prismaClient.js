const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate');

const globalForPrisma = globalThis;

// DEBUG: Check if Vercel picked up the variable
if (process.env.NODE_ENV === 'production') {
    const hasAccelerateUrl = !!process.env.ACCELERATE_URL;
    console.log(`[LeveLearn] Prisma Accelerate URL Found: ${hasAccelerateUrl}`);
}

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
}).$extends(withAccelerate({
  endpoint: process.env.ACCELERATE_URL
}));

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
