const fs = require('fs');
let content = fs.readFileSync('src/lib/emailService.ts', 'utf8');

const target = 'provedor: payload.apiProvider';
const replacement = 'provedor: payload.apiProvider || "N/A"';

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/lib/emailService.ts', content);
  console.log('Patched emailService.ts');
} else {
  console.log('Target not found');
}
