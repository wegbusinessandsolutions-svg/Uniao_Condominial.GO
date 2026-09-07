import sys

with open('src/pages/cliente/Afiliacao.tsx', 'r') as f:
    content = f.read()

target = """      // Adicionar despesa mensal da afiliação
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

replacement = """      // Adicionar despesa mensal da afiliação (apenas se não existir)
      try {
        const qDespesas = query(
          collection(db, "despesas_condominio"), 
          where("userId", "==", user!.uid),
          where("titulo", "==", "Mensalidade Afiliação - União Condominial")
        );
        const despesasSnap = await getDocs(qDespesas);
        if (despesasSnap.empty) {
          await addDoc(collection(db, "despesas_condominio"), {
            titulo: "Mensalidade Afiliação - União Condominial",
            diaVencimento: diaVencimento || 10,
            valor: calcValorMensalidade(),
            userId: user!.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } else {
          // Atualiza a despesa existente caso tenha mudado o vencimento ou valor
          const docId = despesasSnap.docs[0].id;
          await setDoc(doc(db, "despesas_condominio", docId), {
            titulo: "Mensalidade Afiliação - União Condominial",
            diaVencimento: diaVencimento || 10,
            valor: calcValorMensalidade(),
            userId: user!.uid,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
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
