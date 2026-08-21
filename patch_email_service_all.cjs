const fs = require('fs');
let content = fs.readFileSync('src/lib/emailService.ts', 'utf8');

const target = /provedor:\s*payload\.apiProvider/g;
const replacement = 'provedor: payload.apiProvider || "N/A"';

content = content.replace(target, replacement);
fs.writeFileSync('src/lib/emailService.ts', content);
console.log('Patched emailService.ts (all occurrences)');
