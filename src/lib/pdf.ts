/**
 * Abre a janela de impressão de um PDF sem sair do app: baixa o arquivo, carrega num iframe
 * oculto (blob da mesma origem) e chama print(). Se o navegador não deixar (CORS, Safari),
 * abre o PDF numa aba nova — a API serve PDFs inline, então ele já abre pronto para imprimir.
 */
export async function imprimirPdf(url: string) {
  try {
    const r = await fetch(url, { credentials: 'omit' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    const blobUrl = URL.createObjectURL(blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' }));
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    frame.src = blobUrl;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(blobUrl, '_blank', 'noopener');
      }
      // dá tempo de a janela de impressão ler o arquivo antes de liberar
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(blobUrl);
      }, 60_000);
    };
    document.body.appendChild(frame);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

export const ehPdf = (arquivo?: { nomeOriginal?: string; mimeType?: string }) =>
  arquivo?.mimeType === 'application/pdf' || /\.pdf$/i.test(arquivo?.nomeOriginal ?? '');
