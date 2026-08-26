const fs = require('fs');
let file = fs.readFileSync('src/pages/admin/Franqueadora.tsx', 'utf8');

file = file.replace(
  '<td className="px-6 py-4 font-medium text-slate-900">\n                        {item.razaoSocial || "—"}\n                      </td>',
  '<td className="px-6 py-4 font-bold text-slate-700">\n                        {item.numeroFranqueada || "—"}\n                      </td>\n                      <td className="px-6 py-4 font-medium text-slate-900">\n                        {item.razaoSocial || "—"}\n                      </td>'
);

file = file.replace('colSpan={4}', 'colSpan={5}');
file = file.replace('Nenhuma franqueadora encontrada.', 'Nenhuma empresa franqueada encontrada.');
file = file.replace('Nenhuma franqueadora cadastrada.', 'Nenhuma empresa franqueada cadastrada.');

fs.writeFileSync('src/pages/admin/Franqueadora.tsx', file);
