import sys

with open('src/services/afiliacaoFinanceiroService.ts', 'r') as f:
    content = f.read()

target = """  return {
    success: true,
    afiliadoId,
    nomeCondominio,
    totalParcelas: 12,"""

replacement = """  // Adicionar despesa mensal da afiliação (apenas se não existir) na conta do cliente
  try {
    const qDespesas = query(
      collection(db, "despesas_condominio"), 
      where("userId", "==", afiliadoId),
      where("titulo", "==", "Mensalidade Afiliação - União Condominial")
    );
    const despesasSnap = await getDocs(qDespesas);
    if (despesasSnap.empty) {
      await addDoc(collection(db, "despesas_condominio"), {
        titulo: "Mensalidade Afiliação - União Condominial",
        diaVencimento: diaVenc,
        valor: valorMensal,
        userId: afiliadoId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      // Atualiza a despesa existente caso tenha mudado o vencimento ou valor
      const docId = despesasSnap.docs[0].id;
      await setDoc(doc(db, "despesas_condominio", docId), {
        titulo: "Mensalidade Afiliação - União Condominial",
        diaVencimento: diaVenc,
        valor: valorMensal,
        userId: afiliadoId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (despesaErr) {
    console.warn("Aviso ao registrar despesa mensal da afiliação:", despesaErr);
  }

  return {
    success: true,
    afiliadoId,
    nomeCondominio,
    totalParcelas: 12,"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/services/afiliacaoFinanceiroService.ts', 'w') as f:
        f.write(content)
    print("Success Service update")
else:
    print("Target not found Service update")
