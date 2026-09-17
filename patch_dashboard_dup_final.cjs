const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Use a strict replacement targeting EXACTLY the block we want to kill
// Lines 222 to 242

const regex = /\{\/\* 3\. Classification Card \*\/\}[\s\S]*?\}\(\)\)\}/g;
content = content.replace(regex, "");

fs.writeFileSync(file, content);
