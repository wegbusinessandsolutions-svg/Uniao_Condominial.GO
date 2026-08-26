const fs = require('fs');
let file = fs.readFileSync('src/pages/admin/Franqueadora.tsx', 'utf8');

file = file.replace(
  '<th className="px-6 py-3 font-semibold">Razão Social</th>',
  '<th className="px-6 py-3 font-semibold w-24">Nº</th>\n                  <th className="px-6 py-3 font-semibold">Razão Social</th>'
);

file = file.replace(
  '<td className="px-6 py-4 font-medium text-slate-900">\n                          {item.razaoSocial}',
  '<td className="px-6 py-4 font-bold text-slate-700">\n                          {item.numeroFranqueada || "—"}\n                        </td>\n                        <td className="px-6 py-4 font-medium text-slate-900">\n                          {item.razaoSocial}'
);

// We should also add it to the report
file = file.replace(
  '<tr className="border-b border-slate-200">\n                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">\n                  Razão Social\n                </td>\n                <td className="px-3 py-2">{printingItem.razaoSocial || "—"}</td>\n              </tr>',
  '<tr className="border-b border-slate-200">\n                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">\n                  Número da Franqueada\n                </td>\n                <td className="px-3 py-2 font-bold">{printingItem.numeroFranqueada || "—"}</td>\n              </tr>\n              <tr className="border-b border-slate-200">\n                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">\n                  Razão Social\n                </td>\n                <td className="px-3 py-2">{printingItem.razaoSocial || "—"}</td>\n              </tr>'
);

// Fix pulse loading state
file = file.replace(
  '<td className="px-6 py-4">\n                        <div className="h-4 bg-slate-100 rounded w-48" />\n                      </td>\n                      <td className="px-6 py-4">\n                        <div className="h-4 bg-slate-100 rounded w-32" />\n                      </td>',
  '<td className="px-6 py-4">\n                        <div className="h-4 bg-slate-100 rounded w-8" />\n                      </td>\n                      <td className="px-6 py-4">\n                        <div className="h-4 bg-slate-100 rounded w-48" />\n                      </td>\n                      <td className="px-6 py-4">\n                        <div className="h-4 bg-slate-100 rounded w-32" />\n                      </td>'
);

fs.writeFileSync('src/pages/admin/Franqueadora.tsx', file);
