import sys

with open('src/pages/financeiro/ContasReceber.tsx', 'r') as f:
    content = f.read()

target_th = '                <th className="px-6 py-4 whitespace-nowrap">Observações</th>'
if target_th in content:
    content = content.replace(target_th, '')
else:
    print("TH not found")

target_td = """                      <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-500" title={item.observacoes || ""}>
                        {item.observacoes || "-"}
                      </td>"""
if target_td in content:
    content = content.replace(target_td, '')
else:
    print("TD not found")

with open('src/pages/financeiro/ContasReceber.tsx', 'w') as f:
    f.write(content)

print("Removed Observações from ContasReceber grid")
