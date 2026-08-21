import React from "react";
import GenericModulePage from "./GenericModulePage";
import { parseServiceValue, formatCurrencyBR } from "../../lib/serviceUtils";

export default function ServicosEssenciaisAdmin() {
  return (
    <GenericModulePage
      title="Serviços Condominiais Rotineiros"
      description="Gerenciamento de serviços e faturamento"
      collectionName="servicos_essenciais"
      onAddMessage="Novo Serviço"
      fields={[
        { key: "codigo", label: "Código / SKU", type: "text", required: true },
        { key: "nome", label: "Nome do Serviço", type: "text", required: true },
        { key: "ncm", label: "NCM / NBS", type: "text" },
        { key: "cfop", label: "CFOP", type: "text" },
        { key: "iss", label: "Alíquota ISS (%)", type: "text" },
        { key: "valor", label: "Valor Fixo (R$)", type: "text", required: true },
        { key: "descricao", label: "Descrição Detalhada", type: "textarea" },
        { key: "prazoExecucaoHoras", label: "Prazo previsto para execução do serviço em horas", type: "text" },
        { key: "preRequisitos", label: "Pré-requisitos para execução do serviço", type: "textarea" },
        { key: "imagem", label: "Imagem Principal", type: "image", required: true },
        { key: "galeria1", label: "Imagem Galeria 1", type: "image" },
        { key: "galeria2", label: "Imagem Galeria 2", type: "image" },
        { key: "galeria3", label: "Imagem Galeria 3", type: "image" },
      ]}
      columns={[
        {
          key: "imagem",
          label: "Imagem",
          render: (val: any) =>
            val ? (
              <img
                src={val}
                alt="Serviço"
                className="w-12 h-12 object-cover rounded-lg border border-slate-200"
              />
            ) : (
              <span className="text-slate-400">—</span>
            ),
        },
        { key: "codigo", label: "Código" },
        { key: "nome", label: "Nome" },
        { key: "valor", label: "Valor", render: (val: any) => {
          if (val === null || val === undefined || val === "") return "—";
          const num = parseServiceValue(val);
          if (num === 0) return "Sob consulta";
          return formatCurrencyBR(num);
        }},
        { key: "prazoExecucaoHoras", label: "Prazo Previsto", render: (val: any) => val ? `${val}h` : "—" },
        { key: "ncm", label: "NCM/NBS" },
      ]}
    />
  );
}
