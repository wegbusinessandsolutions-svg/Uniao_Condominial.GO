const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The regex below removes the inline 3. Classification Card from the LEFT column
const removeInlineCardRegex = /\{\/\* 3\. Classification Card \*\/\}[\s\S]*?\}\(\)\)\}/;
content = content.replace(removeInlineCardRegex, "");

fs.writeFileSync(file, content);
