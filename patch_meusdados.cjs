const fs = require('fs');

let file = fs.readFileSync('src/pages/cliente/MeusDados.tsx', 'utf8');

const start = file.indexOf('{/* Form Section to become affiliated */}');
const end = file.indexOf('{/* Modal de Confirmação de Cancelamento de Afiliação */}');
const afterModal = file.indexOf('{/* Modal de Confirmação de Exclusão da Conta */}', end);

if (start !== -1 && end !== -1 && afterModal !== -1) {
  // Replace the entire block from start up to (and excluding) afterModal
  file = file.substring(0, start) + "\n          </dl>\n        </div>\n      </div>\n      " + file.substring(afterModal);
  fs.writeFileSync('src/pages/cliente/MeusDados.tsx', file);
  console.log("Successfully removed affiliation UI from MeusDados");
} else {
  console.log("Could not find blocks in MeusDados", {
    start: start !== -1,
    end: end !== -1,
    afterModal: afterModal !== -1
  });
}
