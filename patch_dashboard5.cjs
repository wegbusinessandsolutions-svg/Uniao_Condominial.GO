const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix suggestionText.trim
content = content.replace(/!suggestionText\.trim\n/g, "!suggestionText.trim()}\n");

// Any other trim?
content = content.replace(/\.trim\n/g, ".trim()}\n");

fs.writeFileSync(file, content);
