import sys

with open('src/services/afiliacaoFinanceiroService.ts', 'r') as f:
    content = f.read()

target = """  const parcelasCanceladas: any[] = [];
  const parcelasMantidas: any[] = [];

  for (const docItem of existingDocs) {
    const isRecebido = docItem.status === "Recebido" || docItem.status === "Pago";

    if (isRecebido) {
      // Já liquidado, não altera
      parcelasMantidas.push(docItem);
      continue;
    }

    if (docItem.status === "Cancelado") {
      // Já está cancelado
      parcelasCanceladas.push(docItem);
      continue;
    }

    // Todos os registros presentes a receber mudam seu status para Cancelado
    const updateData = {
      status: "Cancelado",
      centroCusto: CENTRO_CUSTO_AFILIACAO,
      motivoCancelamento: options?.motivo || "Afiliação Cancelada - Registro desativado do Contas a Receber",
      dataCancelamento: baseCancelDate.toISOString(),
      canceladoEm: nowIso,
      horaCancelamento: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      canceladoPor: actor,
      updatedAt: nowIso
    };

    try {
      await updateDoc(doc(db, "contas_receber", docItem.id), updateData);
      parcelasCanceladas.push({
        ...docItem,
        ...updateData
      });
    } catch (upErr) {
      console.error(`Erro ao cancelar conta_receber ${docItem.id}:`, upErr);
    }
  }"""

replacement = """  const parcelasCanceladas: any[] = [];
  const parcelasMantidas: any[] = [];

  // Filter pending docs
  const pendingDocs = existingDocs.filter(d => d.status !== "Recebido" && d.status !== "Pago" && d.status !== "Cancelado");
  
  // Sort pending docs by due date ascending
  pendingDocs.sort((a, b) => {
    const dateA = new Date(a.dataVencimento || a.vencimento || 0).getTime();
    const dateB = new Date(b.dataVencimento || b.vencimento || 0).getTime();
    return dateA - dateB;
  });

  const docToKeep = pendingDocs.length > 0 ? pendingDocs[0] : null;

  const dataHoraCancelamento = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
  const observacaoCancelamento = `Data e hora que o cliente pediu o cancelamento da afiliação a União Condominial: ${dataHoraCancelamento}`;

  for (const docItem of existingDocs) {
    const isRecebido = docItem.status === "Recebido" || docItem.status === "Pago";

    if (isRecebido) {
      // Já liquidado, não altera
      parcelasMantidas.push(docItem);
      continue;
    }

    if (docItem.status === "Cancelado") {
      // Já está cancelado
      parcelasCanceladas.push(docItem);
      continue;
    }

    if (docToKeep && docItem.id === docToKeep.id) {
      // Manter a próxima parcela a vencer (primeira pendente)
      parcelasMantidas.push(docItem);
      continue;
    }

    // Cancelar o restante
    const updateData = {
      status: "Cancelado",
      centroCusto: CENTRO_CUSTO_AFILIACAO,
      observacoes: docItem.observacoes ? `${docItem.observacoes} | ${observacaoCancelamento}` : observacaoCancelamento,
      motivoCancelamento: options?.motivo || "Afiliação Cancelada",
      dataCancelamento: baseCancelDate.toISOString(),
      canceladoEm: nowIso,
      horaCancelamento: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      canceladoPor: actor,
      updatedAt: nowIso
    };

    try {
      await updateDoc(doc(db, "contas_receber", docItem.id), updateData);
      parcelasCanceladas.push({
        ...docItem,
        ...updateData
      });
    } catch (upErr) {
      console.error(`Erro ao cancelar conta_receber ${docItem.id}:`, upErr);
    }
  }"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/services/afiliacaoFinanceiroService.ts', 'w') as f:
        f.write(content)
    print("Success AfiliacaoFinanceiroService")
else:
    print("Target not found AfiliacaoFinanceiroService")
