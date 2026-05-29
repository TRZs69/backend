const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const chapter = await prisma.chapter.findUnique({
    where: { id: 144 },
    include: { materials: true }
  });
  console.log(JSON.stringify(chapter, null, 2));
  process.exit(0);
}
run();
