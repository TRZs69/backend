const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMaterial137() {
  try {
    const material = await prisma.material.findFirst({
      where: { chapterId: 137 }
    });
    console.log("MATERIAL FOR CHAPTER 9 (ID 137):");
    console.log(JSON.stringify(material, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkMaterial137();
