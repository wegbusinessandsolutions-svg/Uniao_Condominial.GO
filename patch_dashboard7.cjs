const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/      \}\)\n    <\/div>/, "      })()}\n    </div>");

fs.writeFileSync(file, content);
