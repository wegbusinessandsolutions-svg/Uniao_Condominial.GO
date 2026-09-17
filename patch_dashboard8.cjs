const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\{\/\* GPS Confirmado removido a pedido do cliente \*\/\}\s*<\/div>/,
  `{/* GPS Confirmado removido a pedido do cliente */}
              </div>
            </div>
            {/* The Classification Badge was here, currently removed. */}
          </div>`
);

fs.writeFileSync(file, content);
