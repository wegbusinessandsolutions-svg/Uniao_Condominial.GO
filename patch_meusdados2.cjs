const fs = require('fs');
let content = fs.readFileSync('src/pages/cliente/MeusDados.tsx', 'utf8');

content = content.replace('import { sendEmail } from "../../lib/emailService";', 'import { sendEmailWithLog } from "../../lib/emailService";');
content = content.replace('await sendEmail({', 'await sendEmailWithLog({');
content = content.replace('});\n\n      setAfiliadoStatus', '}, "AFILIACAO_UC");\n\n      setAfiliadoStatus');

fs.writeFileSync('src/pages/cliente/MeusDados.tsx', content);
