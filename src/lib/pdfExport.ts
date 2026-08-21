import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { parseServiceValue, formatCurrencyBR } from "./serviceUtils";

export async function exportBeneficiosPdf(
  items: any[],
  customTitle: string = "Clube de Benefícios",
  extraData?: {
    userName?: string;
    userCpf?: string;
    condominioName?: string;
    condominioCnpj?: string;
    cardSuffix?: string;
  }
) {
  if (!items || items.length === 0) {
    alert("Nenhum benefício disponível para exportar em PDF.");
    return;
  }

  const cardCondominioName = extraData?.condominioName || "Condomínio Residencial Beneficiado";
  
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Organização inteligente de páginas:
  // Página 1: Cabeçalho Completo + Caixa de Comunicado do Síndico + Barra de Título -> 3 benefícios
  // Páginas 2 em diante: Topo de continuação limpo -> 4 benefícios por página
  const PAGE_1_ITEMS = 3;
  const SUBSEQUENT_PAGE_ITEMS = 4;

  const pages: any[][] = [];
  if (items.length <= PAGE_1_ITEMS) {
    pages.push(items);
  } else {
    pages.push(items.slice(0, PAGE_1_ITEMS));
    let remaining = items.slice(PAGE_1_ITEMS);
    while (remaining.length > 0) {
      pages.push(remaining.slice(0, SUBSEQUENT_PAGE_ITEMS));
      remaining = remaining.slice(SUBSEQUENT_PAGE_ITEMS);
    }
  }

  const totalPages = pages.length;

  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.left = "-9999px";
  wrapper.style.top = "0";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.backgroundColor = "#ffffff";

  // Helper para renderizar cada card de benefício de forma compacta e íntegra
  const renderItemHtml = (item: any, globalIndex: number) => {
    const fullAddress = [
      item.endereco && `${item.endereco}${item.numero ? `, nº ${item.numero}` : ""}`,
      item.complemento,
      item.bairro,
      item.cidade && item.estado ? `${item.cidade} - ${item.estado}` : item.cidade || item.estado,
      item.cep && `CEP ${item.cep}`,
    ]
      .filter(Boolean)
      .join(" · ");

    let discountBig = "25%";
    let discountSuffix = "DE<br/>DESCONTO";

    if (item.tipo === "Desconto (%)" && item.valor) {
      discountBig = item.valor.toString().includes("%") ? item.valor : `${item.valor}%`;
      discountSuffix = "DE<br/>DESCONTO";
    } else if (item.tipo === "Desconto (R$)" && item.valor) {
      discountBig = item.valor.toString().includes("R$") ? item.valor : `R$ ${item.valor}`;
      discountSuffix = "DE<br/>DESCONTO";
    } else if (item.desconto) {
      discountBig = item.desconto;
      discountSuffix = "VANTAGEM<br/>EXCLUSIVA";
    } else if (item.valor) {
      discountBig = String(item.valor);
      discountSuffix = "VANTAGEM<br/>EXCLUSIVA";
    }

    const mainImgSrc = item.imagem || item.imagemUrl || item.logo || item.logomarca || item.foto || "";

    return `
      <div style="width: 100%; box-sizing: border-box; background-color: #ffffff; padding: 12px 0; border-bottom: 1px solid #e2e8f0; display: flex; gap: 20px; justify-content: space-between; align-items: flex-start;">
        
        <!-- Lado Esquerdo: Identificação, Imagem Principal, Descrição e Regras -->
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
            PARCEIRO CREDENCIADO · ${(globalIndex + 1).toString().padStart(2, '0')}
          </div>

          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 6px;">
            ${
              mainImgSrc
                ? `
              <div style="width: 52px; height: 52px; border-radius: 10px; border: 1px solid #e2e8f0; background-color: #f8fafc; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <img
                  src="${mainImgSrc}"
                  alt="${item.nome || "Parceiro"}"
                  crossorigin="anonymous"
                  style="max-width: 100%; max-height: 100%; object-fit: contain;"
                />
              </div>
            `
                : ""
            }
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;">
                ${item.nome || "Benefício Sem Nome"}
              </h3>
              ${item.categoria ? `<span style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 1px; display: block;">${item.categoria}</span>` : ""}
            </div>
          </div>

          ${
            item.descricao
              ? `
            <div style="font-size: 11px; color: #334155; line-height: 1.45; margin-bottom: 5px; white-space: pre-wrap;">
              ${item.descricao}
            </div>
          `
              : ""
          }

          <div style="font-size: 10.5px; color: #334155; line-height: 1.35;">
            <strong style="color: #0f172a;">Regras de uso —</strong> ${
              item.regras ||
              'apresente o cartão virtual do Clube de Benefícios da União Condominial ou este documento e solicite o seu desconto.'
            }
          </div>
        </div>

        <!-- Lado Direito: Desconto em Destaque, Contatos e QR Code Localização -->
        <div style="width: 240px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-start;">
          <!-- Desconto -->
          <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px;">
            <span style="font-size: 26px; font-weight: 800; color: #0284c7; line-height: 1; letter-spacing: -0.5px;">
              ${discountBig}
            </span>
            <span style="font-size: 9.5px; font-weight: 800; color: #0284c7; line-height: 1.15; text-transform: uppercase;">
              ${discountSuffix}
            </span>
          </div>

          <!-- Dados de Contato e Endereço -->
          <div style="font-size: 10.5px; color: #334155; line-height: 1.4; margin-bottom: 8px; width: 100%;">
            ${
              fullAddress
                ? `<div style="margin-bottom: 3px;"><strong style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">ENDEREÇO</strong> ${fullAddress}</div>`
                : ""
            }
            ${
              item.telefone
                ? `<div style="margin-bottom: 2px;"><strong style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">TELEFONE</strong> ${item.telefone}</div>`
                : ""
            }
            ${
              item.whatsapp
                ? `<div style="margin-bottom: 2px;"><strong style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">WHATSAPP</strong> ${item.whatsapp}</div>`
                : ""
            }
            ${
              item.website
                ? `<div><strong style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">SITE</strong> ${item.website.replace(/^https?:\/\//, '')}</div>`
                : ""
            }
          </div>

          <!-- QR Code para Mapa -->
          <div style="display: flex; align-items: center; gap: 8px; margin-top: auto;">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                item.mapaLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress || item.nome)}`
              )}"
              alt="QR Code"
              crossorigin="anonymous"
              style="width: 40px; height: 40px; border-radius: 4px; border: 1px solid #e2e8f0; padding: 2px; flex-shrink: 0;"
            />
            <span style="font-size: 9.5px; color: #94a3b8; line-height: 1.2;">
              Escaneie para<br/>abrir o mapa
            </span>
          </div>
        </div>

      </div>
    `;
  };

  // Construir cada página como um container A4 isolado (800px x 1131px)
  let currentGlobalIndex = 0;
  pages.forEach((pageItems, pageIdx) => {
    const pageEl = document.createElement("div");
    pageEl.className = "pdf-page-container";
    pageEl.style.width = "800px";
    pageEl.style.height = "1131px";
    pageEl.style.minHeight = "1131px";
    pageEl.style.maxHeight = "1131px";
    pageEl.style.boxSizing = "border-box";
    pageEl.style.padding = "36px 44px";
    pageEl.style.display = "flex";
    pageEl.style.flexDirection = "column";
    pageEl.style.justifyContent = "space-between";
    pageEl.style.backgroundColor = "#ffffff";
    pageEl.style.color = "#0f172a";
    pageEl.style.fontFamily = "'Helvetica Neue', Arial, sans-serif";
    pageEl.style.position = "relative";
    pageEl.style.overflow = "hidden";

    const itemsContent = pageItems
      .map((it) => {
        const html = renderItemHtml(it, currentGlobalIndex);
        currentGlobalIndex++;
        return html;
      })
      .join("");

    if (pageIdx === 0) {
      // Página 1: Cabeçalho Completo + Caixa do Síndico + Título
      pageEl.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          <!-- Topo Oficial -->
          <div style="margin-bottom: 18px; text-align: left;">
            <div style="font-size: 10.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">
              GUIA OFICIAL DE VANTAGENS &nbsp;·&nbsp; CORTESIA EXCLUSIVA
            </div>
            <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; line-height: 1.1; letter-spacing: -0.5px;">
              Clube de Benefícios
            </h1>
            <div style="font-size: 12px; color: #64748b; font-weight: 500; line-height: 1.35;">
              Empresas parceiras com vantagens e descontos exclusivos para os condôminos do ${cardCondominioName} e seus familiares.
            </div>
          </div>

          <!-- Caixa de Comunicado do Condomínio -->
          <div style="border-left: 3px solid #0f172a; padding: 10px 16px; margin-bottom: 16px; background-color: #f8fafc; border-radius: 0 8px 8px 0; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; flex-wrap: wrap; gap: 8px;">
              <strong style="font-size: 12px; color: #0f172a; font-weight: 800;">${cardCondominioName}</strong>
              ${extraData?.condominioCnpj ? `<span style="font-size: 10px; color: #64748b; font-weight: 600;">C.N.P.J. Nº ${extraData.condominioCnpj}</span>` : ''}
            </div>
            <p style="font-size: 11.5px; color: #0f172a; font-weight: 700; margin: 0 0 3px 0;">
              Prezados Condôminos e Moradores,
            </p>
            <p style="font-size: 11px; color: #334155; line-height: 1.45; margin: 0;">
              Apresentamos a relação das empresas parceiras credenciadas que oferecem descontos e vantagens exclusivas para os condôminos do nosso condomínio e seus familiares. Esta iniciativa é uma cortesia exclusiva para proporcionar mais economia, conveniência e facilidades no seu dia a dia. Para usufruir dos benefícios, basta apresentar este documento no estabelecimento participante.
            </p>
          </div>

          <!-- Barra de Título da Seção -->
          <div style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #0f172a; display: flex; justify-content: space-between; align-items: flex-end; text-align: left;">
            <div>
              <div style="font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 1.5px;">
                EMPRESAS PARCEIRAS &amp; VANTAGENS EXCLUSIVAS
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                Apresente este documento ou escaneie o código para localizar o estabelecimento.
              </div>
            </div>
            <div style="font-size: 10px; color: #94a3b8; font-weight: 600;">
              ${items.length.toString().padStart(2, '0')} credenciadas
            </div>
          </div>

          <!-- Lista de Participantes da Página 1 (Exatamente 3) -->
          <div style="display: flex; flex-direction: column;">
            ${itemsContent}
          </div>
        </div>

        <!-- Rodapé da Página 1 -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #94a3b8; font-weight: 500;">
          <div>
            Documento emitido como cortesia exclusiva aos condomínios participantes da União Condominial (www.uniaocondominial.com.br)
          </div>
          <div>
            Página 1 de ${totalPages}
          </div>
        </div>
      `;
    } else {
      // Páginas 2 em diante: Topo de continuação
      pageEl.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          <!-- Topo Compacto Continuação -->
          <div style="margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #0f172a; display: flex; justify-content: space-between; align-items: flex-end; text-align: left;">
            <div>
              <div style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 1.5px;">
                CLUBE DE BENEFÍCIOS · EMPRESAS CREDENCIADAS (CONTINUAÇÃO)
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px;">
                ${cardCondominioName} &nbsp;·&nbsp; Vantagens e Descontos Exclusivos
              </div>
            </div>
            <div style="font-size: 10px; color: #94a3b8; font-weight: 600;">
              Página ${pageIdx + 1} de ${totalPages}
            </div>
          </div>

          <!-- Lista de Participantes desta Página -->
          <div style="display: flex; flex-direction: column;">
            ${itemsContent}
          </div>
        </div>

        <!-- Rodapé das Páginas Subsequentes -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #94a3b8; font-weight: 500;">
          <div>
            Documento emitido como cortesia exclusiva aos condomínios participantes da União Condominial (www.uniaocondominial.com.br)
          </div>
          <div>
            Página ${pageIdx + 1} de ${totalPages}
          </div>
        </div>
      `;
    }

    wrapper.appendChild(pageEl);
  });

  document.body.appendChild(wrapper);

  try {
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const pageContainers = wrapper.querySelectorAll(".pdf-page-container");

    for (let p = 0; p < pageContainers.length; p++) {
      const pageElement = pageContainers[p] as HTMLElement;

      const canvas = await html2canvas(pageElement, {
        scale: 2, // 2 proporciona alta nitidez sem borrões
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      if (p > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    }

    pdf.save(`Clube_de_Beneficios_Condominos_${dateStr.replace(/\//g, "-")}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF do Clube de Benefícios:", error);
    alert("Erro ao gerar PDF do Clube de Benefícios.");
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
}

export async function exportServicosPdf(
  items: any[],
  customTitle: string = "Serviços Condominiais Rotineiros",
  columns: any[] = [],
  extraData?: {
    userName?: string;
    condominioName?: string;
  }
) {
  if (!items || items.length === 0) {
    alert("Nenhum serviço disponível para exportar em PDF.");
    return;
  }

  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const condominio = extraData?.condominioName || "Condomínio";

  const PAGE_1_ITEMS = 4;
  const SUBSEQUENT_PAGE_ITEMS = 4;

  const pages: any[][] = [];
  if (items.length <= PAGE_1_ITEMS) {
    pages.push(items);
  } else {
    pages.push(items.slice(0, PAGE_1_ITEMS));
    let remaining = items.slice(PAGE_1_ITEMS);
    while (remaining.length > 0) {
      pages.push(remaining.slice(0, SUBSEQUENT_PAGE_ITEMS));
      remaining = remaining.slice(SUBSEQUENT_PAGE_ITEMS);
    }
  }

  const totalPages = pages.length;

  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.left = "-9999px";
  wrapper.style.top = "0";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.backgroundColor = "#ffffff";

  const renderServiceHtml = (item: any, globalIndex: number) => {
    const precoFormatted = (item.valor !== undefined && item.valor !== null && item.valor !== "")
      ? formatCurrencyBR(item.valor)
      : "Sob Consulta";

    const prazo = item.prazoExecucaoHoras || item.prazoPrevisto || item.prazoHoras || item.prazo_execucao;
    const preReq = item.preRequisitos || item.pre_requisitos || item.prerequisitos;

    return `
      <div style="width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px; background-color: #ffffff; padding: 14px 18px; margin-bottom: 12px; page-break-inside: avoid; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <div>
            <span style="font-size: 10px; font-weight: 800; color: #0071e3; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">
              ${item.codigo ? `CÓDIGO: ${item.codigo}` : `SERVIÇO #${globalIndex + 1}`}
            </span>
            <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0;">
              ${item.nome || "Serviço sem nome"}
            </h3>
          </div>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-weight: 800; font-size: 13px; padding: 4px 12px; border-radius: 8px; flex-shrink: 0; white-space: nowrap;">
            ${precoFormatted}
          </div>
        </div>

        ${
          item.descricao
            ? `<div style="font-size: 11.5px; color: #334155; margin-bottom: 8px; line-height: 1.45; white-space: pre-wrap;"><strong>Descrição:</strong> ${item.descricao}</div>`
            : ""
        }

        <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 10.5px; margin-top: 6px;">
          ${
            prazo
              ? `<div style="background-color: #eff6ff; border: 1px solid #dbeafe; color: #1e40af; font-weight: 700; padding: 3px 8px; border-radius: 6px;">⏱️ Prazo Previsto: ${prazo}h</div>`
              : ""
          }
          ${
            preReq
              ? `<div style="background-color: #fffbeb; border: 1px solid #fef3c7; color: #92400e; font-weight: 700; padding: 3px 8px; border-radius: 6px;">📋 Pré-requisitos: ${preReq}</div>`
              : ""
          }
          ${
            item.ncm
              ? `<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; color: #475569; font-weight: 600; padding: 3px 8px; border-radius: 6px;">NCM/NBS: ${item.ncm}</div>`
              : ""
          }
        </div>
      </div>
    `;
  };

  let currentGlobalIndex = 0;
  pages.forEach((pageItems, pageIdx) => {
    const pageEl = document.createElement("div");
    pageEl.className = "pdf-page-container";
    pageEl.style.width = "800px";
    pageEl.style.height = "1131px";
    pageEl.style.minHeight = "1131px";
    pageEl.style.maxHeight = "1131px";
    pageEl.style.boxSizing = "border-box";
    pageEl.style.padding = "36px 44px";
    pageEl.style.display = "flex";
    pageEl.style.flexDirection = "column";
    pageEl.style.justifyContent = "space-between";
    pageEl.style.backgroundColor = "#ffffff";
    pageEl.style.color = "#0f172a";
    pageEl.style.fontFamily = "'Helvetica Neue', Arial, sans-serif";
    pageEl.style.position = "relative";
    pageEl.style.overflow = "hidden";

    const itemsContent = pageItems
      .map((it) => {
        const html = renderServiceHtml(it, currentGlobalIndex);
        currentGlobalIndex++;
        return html;
      })
      .join("");

    pageEl.innerHTML = `
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
        <!-- Header -->
        <div style="border-bottom: 3px solid #0071e3; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 10.5px; font-weight: 800; color: #0071e3; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 3px;">
              CATÁLOGO OFICIAL DE SERVIÇOS ${pageIdx > 0 ? `(CONTINUAÇÃO)` : ""}
            </span>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">
              ${customTitle}
            </h1>
            <div style="font-size: 11.5px; color: #64748b; margin-top: 3px; font-weight: 600;">
              Emissão para: ${condominio} &nbsp;•&nbsp; Data: ${dateStr}
            </div>
          </div>
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; font-weight: 800; font-size: 11.5px; padding: 6px 14px; border-radius: 8px; text-align: center;">
            TOTAL: ${items.length} ITENS
          </div>
        </div>

        <!-- Content -->
        <div style="display: flex; flex-direction: column;">
          ${itemsContent}
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b; font-weight: 600;">
        <div>Relatório gerado em ${dateStr} pelo Sistema de Gestão Condominial.</div>
        <div>Página ${pageIdx + 1} de ${totalPages}</div>
      </div>
    `;

    wrapper.appendChild(pageEl);
  });

  document.body.appendChild(wrapper);

  try {
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const pageContainers = wrapper.querySelectorAll(".pdf-page-container");

    for (let p = 0; p < pageContainers.length; p++) {
      const pageElement = pageContainers[p] as HTMLElement;

      const canvas = await html2canvas(pageElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      if (p > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    }

    const filename = `${customTitle.replace(/\s+/g, "_")}_${dateStr.replace(/\//g, "-")}.pdf`;
    pdf.save(filename);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Erro ao gerar arquivo PDF.");
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
}

export async function exportGenericPdf(
  items: any[],
  customTitle: string = "Relatório",
  columns: { key: string; label: string; render?: any }[] = [],
  extraData?: {
    userName?: string;
    condominioName?: string;
  }
) {
  if (!items || items.length === 0) {
    alert("Nenhum registro disponível para exportar em PDF.");
    return;
  }

  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const condominio = extraData?.condominioName || "Condomínio";

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#0f172a";
  container.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  container.style.padding = "40px";
  container.style.boxSizing = "border-box";

  const tableHeaders = columns
    .map(
      (c) =>
        `<th style="padding: 10px 12px; background-color: #f1f5f9; color: #334155; font-size: 11px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; text-align: left;">${c.label}</th>`
    )
    .join("");

  const tableRows = items
    .map((item, idx) => {
      const cells = columns
        .map((c) => {
          let val = item[c.key];
          if (val === undefined || val === null) val = "—";
          return `<td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #1e293b; text-align: left;">${String(val)}</td>`;
        })
        .join("");
      const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background-color: ${bg};">${cells}</tr>`;
    })
    .join("");

  container.innerHTML = `
    <!-- Header -->
    <div style="border-bottom: 3px solid #0071e3; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="font-size: 11px; font-weight: 800; color: #0071e3; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">
          RELATÓRIO DE DADOS
        </span>
        <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">
          ${customTitle}
        </h1>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 600;">
          ${condominio} &nbsp;•&nbsp; Data: ${dateStr}
        </div>
      </div>
      <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; font-weight: 800; font-size: 12px; padding: 8px 16px; border-radius: 8px; text-align: center;">
        TOTAL: ${items.length} REGISTRO(S)
      </div>
    </div>

    <!-- Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr>${tableHeaders}</tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- Footer -->
    <div style="margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 16px; text-align: center; font-size: 11px; color: #64748b; font-weight: 600;">
      Relatório gerado em ${dateStr} pelo Sistema de Gestão.
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    const pdf = new jsPDF("p", "mm", "a4");

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    const filename = `${customTitle.replace(/\s+/g, "_")}_${dateStr.replace(/\//g, "-")}.pdf`;
    pdf.save(filename);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Erro ao gerar arquivo PDF.");
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}


export function exportTableToPdf(
  items: any[],
  customTitle: string = "Relatório",
  columns: { key: string; label: string; render?: any; format?: string }[] = [],
  extraData?: {
    userName?: string;
    condominioName?: string;
  }
) {
  if (!items || items.length === 0) {
    alert("Nenhum registro disponível para exportar em PDF.");
    return;
  }
  
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const pdf = new jsPDF("p", "pt", "a4");
  
  pdf.setFontSize(14);
  pdf.text(customTitle, 40, 40);
  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`Data de Emissão: ${dateStr}`, 40, 55);
  if (extraData?.condominioName) {
    pdf.text(`Condomínio: ${extraData.condominioName}`, 40, 70);
  }

  const tableData = items.map(item => {
    return columns.map(col => {
      let val = item[col.key];
      if (val === undefined || val === null) val = "";
      
      // Basic formatting helpers for common data types in the finance module
      if (col.format === "currency") {
         return typeof val === "number" ? formatCurrencyBR(val) : val;
      }
      if (col.format === "date" && val) {
         if (typeof val === "string" && val.includes("-")) {
           const [y, m, d] = val.split("-");
           return `${d}/${m}/${y}`;
         }
      }
      if (col.format === "boolean") {
         return val ? "Sim" : "Não";
      }
      
      return String(val);
    });
  });

  autoTable(pdf, {
    head: [columns.map(c => c.label)],
    body: tableData,
    startY: extraData?.condominioName ? 85 : 70,
    theme: "striped",
    headStyles: {
      fillColor: [0, 113, 227],
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
  });

  const filename = `${customTitle.replace(/\s+/g, "_")}_${dateStr.replace(/[\/:]/g, "")}.pdf`;
  pdf.save(filename);
}
