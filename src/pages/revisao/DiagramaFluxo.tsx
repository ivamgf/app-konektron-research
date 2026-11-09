import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Carregando, ErroAlerta } from '../../components/ui';

export const chaveDiagrama = (revisaoId: string) => ['revisao', revisaoId, 'diagrama'] as const;

function baixar(url: string, nome: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
}

/** Imprime o SVG num iframe oculto (a página só tem o diagrama, ajustado à folha em paisagem) */
function imprimirSvg(svg: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Diagrama de fluxo</title><style>@page{size:A4 landscape;margin:10mm}html,body{margin:0}svg{width:100%;height:auto}</style></head><body>${svg}</body></html>`,
  );
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  }, 200);
}

/**
 * RF33: diagrama de fluxo da seleção, gerado pela API com os dados atuais da revisão
 * (revisões anteriores, bases de dados com as fases de triagem e outras fontes → incluídos).
 * Atualiza sozinho quando as decisões mudam (a consulta é invalidada junto com a revisão).
 */
export function DiagramaFluxo({ revisaoId, compacto = false }: { revisaoId: string; compacto?: boolean }) {
  const svg = useQuery({
    queryKey: chaveDiagrama(revisaoId),
    queryFn: () =>
      api
        .get<string>(`/revisoes/${revisaoId}/diagrama`, { params: { formato: 'svg' }, responseType: 'text' })
        .then((r) => r.data),
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!svg.data) return;
    const u = URL.createObjectURL(new Blob([svg.data], { type: 'image/svg+xml' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [svg.data]);

  const exportarPng = () => {
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      const escala = 2;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth * escala;
      c.height = img.naturalHeight * escala;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      baixar(c.toDataURL('image/png'), 'diagrama-de-fluxo.png');
    };
    img.src = url;
  };

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <div className="me-auto">
            <h3 className="h6 mb-0">Diagrama de fluxo da seleção</h3>
            {!compacto && (
              <div className="small text-secondary">
                Montado automaticamente com os dados da revisão: buscas por base, fases de triagem com os motivos de
                exclusão, revisões anteriores e outras fontes.
              </div>
            )}
          </div>
          <div className="btn-group btn-group-sm">
            <button
              className="btn btn-outline-secondary"
              disabled={svg.isFetching}
              onClick={() => svg.refetch()}
              title="Atualizar com os dados atuais"
            >
              <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              <span className="visually-hidden">Atualizar</span>
            </button>
            <button className="btn btn-outline-secondary" disabled={!svg.data} onClick={() => imprimirSvg(svg.data!)}>
              <i className="bi bi-printer me-1" aria-hidden="true" />
              Imprimir
            </button>
            <button
              className="btn btn-outline-secondary"
              disabled={!url}
              onClick={() => url && baixar(url, 'diagrama-de-fluxo.svg')}
            >
              SVG
            </button>
            <button className="btn btn-outline-secondary" disabled={!url} onClick={exportarPng}>
              PNG
            </button>
          </div>
        </div>
        {svg.isLoading && <Carregando />}
        <ErroAlerta erro={svg.error} />
        {url && (
          <div className="k-fluxograma overflow-auto">
            <img
              src={url}
              alt="Diagrama de fluxo da seleção: revisões anteriores, registros identificados por base, fases de triagem com excluídos e motivos, outras fontes e total de incluídos"
            />
          </div>
        )}
      </div>
    </div>
  );
}
