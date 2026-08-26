const fs = require('fs');

let file = fs.readFileSync('src/pages/cliente/MeusDados.tsx', 'utf8');

const start = file.indexOf('{/* Form Section to become affiliated */}');
const end = file.indexOf('<div className="mt-6 bg-slate-50');

if (start !== -1 && end !== -1) {
  file = file.substring(0, start) + "\n          </dl>\n        </div>\n      </div>\n      " + file.substring(end);
  fs.writeFileSync('src/pages/cliente/MeusDados.tsx', file);
  console.log("Successfully removed affiliation UI from MeusDados");
} else {
  console.log("Could not find blocks in MeusDados");
}
