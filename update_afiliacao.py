import sys

with open('src/pages/cliente/Afiliacao.tsx', 'r') as f:
    content = f.read()

target = """      } catch (syncErr) {
        console.warn("Aviso ao sincronizar contas a receber:", syncErr);
      }"""

replacement = """      } catch (syncErr) {
        console.warn("Aviso ao sincronizar contas a receber:", syncErr);
      }

      // Adicionar despesa mensal da afiliação
      try {
        await addDoc(collection(db, "despesas_condominio"), {
          titulo: "Mensalidade Afiliação - União Condominial",
          diaVencimento: diaVencimento || 10,
          valor: validacaoPrevia.valorTotalAfiliacao,
          userId: user!.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (despesaErr) {
        console.warn("Aviso ao registrar despesa mensal:", despesaErr);
      }"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/pages/cliente/Afiliacao.tsx', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Target not found")
