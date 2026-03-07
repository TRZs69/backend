const fs = require('fs');
const path = require('path');

const seedFile = path.join(__dirname, 'prisma', 'seed.js');
let content = fs.readFileSync(seedFile, 'utf8');

// Replace the first 4 occurrences of `await prisma.user.create({` that creates a Role.STUDENT
// We know they start after `const studentPassword = ...`
const vars = ['student', 'emely', 'gerry', 'gerald'];
let count = 0;

content = content.replace(/await prisma\.user\.create\(\{\s*data:\s*\{\s*username:\s*'[^']+',\s*password:\s*studentPassword/g, (match) => {
    if (count < vars.length) {
        const replacement = `const ${vars[count]} = await prisma.user.create({`;
        // Then we still need the data, etc. wait, let's do a simpler regex:
        return match; // fallback if complex regex is not used
    }
    return match;
});

// simpler way by directly modifying the exact lines of known students:
content = content.replace(/await prisma\.user\.create\(\{\s*data:\s*\{\s*username:\s*'obenhard',/, "const student = await prisma.user.create({\n      data: {\n        username: 'obenhard',");
content = content.replace(/await prisma\.user\.create\(\{\s*data:\s*\{\s*username:\s*'sefa',/, "const emely = await prisma.user.create({\n      data: {\n        username: 'sefa',");
content = content.replace(/await prisma\.user\.create\(\{\s*data:\s*\{\s*username:\s*'rudi',/, "const gerry = await prisma.user.create({\n      data: {\n        username: 'rudi',");
content = content.replace(/await prisma\.user\.create\(\{\s*data:\s*\{\s*username:\s*'christo',/, "const gerald = await prisma.user.create({\n      data: {\n        username: 'christo',");

fs.writeFileSync(seedFile, content, 'utf8');
console.log('Fixed variable assignments in seed.js');
