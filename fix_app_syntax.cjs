const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(';\\nimport ControleAfiliados', ';\nimport ControleAfiliados');
content = content.replace('/>\\n              <Route path="afiliados"', '/>\n              <Route path="afiliados"');

fs.writeFileSync('src/App.tsx', content);
