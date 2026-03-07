const fs = require('fs');
const path = require('path');

const seedFile = path.join(__dirname, 'prisma', 'seed.js');
let content = fs.readFileSync(seedFile, 'utf8');

const seen = {};

content = content.replace(/username:\s*'([^']+)',/g, (match, username) => {
    if (seen[username] === undefined) {
        seen[username] = 0;
        return match; // First time, no change
    } else {
        seen[username]++;
        return `username: '${username}${seen[username]}',`;
    }
});

fs.writeFileSync(seedFile, content, 'utf8');
console.log('Fixed duplicate usernames in seed.js');
