import { useEffect, useState, type ReactNode } from 'react';
import { get, mensagemDeErro, post } from '../lib/api';
import type { Tarefa } from '../lib/tipos';
import { baixarArquivo, ehPdf, imprimirPdf } from '../lib/pdf';

// qualquer status que não seja final (PENDENTE, EXECUTANDO...) continua sendo acompanhado
const emAndamento = (s?: Tarefa['status']) => s !== 'CONCLUIDA' && s !== 'ERRO';
const LIMITE_MS = 5 * 60_000;

/**
 * PDFs, importações e exportações rodam no worker: a API responde 202 com `tarefaId`
 * e o app consulta GET /tarefas/:id até CONCLUIDA (resultado traz a URL assinada de 15 min).
 */
export function useTarefa(intervaloMs = 2000) {
  const [tarefaId, setTarefaId] = useState<number | null>(null);
  const [tarefa, setTarefa] = useState<Tarefa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!tarefaId) return;
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;
    const inicio = Date.now();
    const consultar = async () => {
      try {
        const t = await get<Tarefa>(`/tarefas/${tarefaId}`);
        if (!vivo) return;
        setTarefa(t);
        if (emAndamento(t.status)) {
          if (Date.now() - inicio > LIMITE_MS)
            setErro('A geração está demorando mais que o normal. Tente de novo em alguns minutos.');
          else timer = setTimeout(consultar, intervaloMs);
        } else if (t.status === 'ERRO') setErro(t.erro ?? 'A tarefa falhou');
      } catch (e) {
        if (vivo) setErro(mensagemDeErro(e));
      }
    };
    consultar();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [tarefaId, intervaloMs]);

  const iniciar = async (url: string, corpo?: unknown) => {
    setErro(null);
    setTarefa(null);
    try {
      const r = await post<{ tarefaId: number }>(url, corpo ?? {});
      setTarefaId(r.tarefaId);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  const andamento = !!tarefaId && !erro && (!tarefa || emAndamento(tarefa.status));
  const url = tarefa?.status === 'CONCLUIDA' ? tarefa.resultado?.url : undefined;
  return {
    iniciar,
    tarefa,
    erro,
    andamento,
    url,
    pdf: !!url && ehPdf(tarefa?.resultado?.arquivo),
    nome: tarefa?.resultado?.arquivo?.nomeOriginal,
  };
}

/** Botão que dispara a tarefa e, ao concluir, mostra o link de download */
export function BotaoTarefa({
  url,
  corpo,
  children,
  className = 'btn btn-outline-primary',
  textoPronto = 'Baixar arquivo',
}: {
  url: string;
  corpo?: unknown;
  children: ReactNode;
  className?: string;
  textoPronto?: string;
}) {
  const t = useTarefa();
  return (
    <span className="d-inline-flex flex-wrap align-items-center gap-2">
      <button type="button" className={className} disabled={t.andamento} onClick={() => t.iniciar(url, corpo)}>
        {t.andamento ? <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" /> : null}
        {t.andamento ? 'Gerando…' : children}
      </button>
      {t.url && <LinksDoArquivo url={t.url} pdf={t.pdf} texto={textoPronto} nome={t.nome} />}
      {t.erro && (
        <span className="text-danger small" role="alert">
          {t.erro}
        </span>
      )}
    </span>
  );
}

/** PDF: visualizar numa aba nova, imprimir (janela de impressão) e baixar; outros arquivos: baixar */
export function LinksDoArquivo({ url, pdf, texto, nome }: { url: string; pdf: boolean; texto: string; nome?: string }) {
  const [baixando, setBaixando] = useState(false);
  const baixar = async () => {
    setBaixando(true);
    try {
      await baixarArquivo(url, nome ?? (pdf ? 'documento.pdf' : 'arquivo'));
    } finally {
      setBaixando(false);
    }
  };
  if (!pdf)
    return (
      <button type="button" className="btn btn-success" disabled={baixando} onClick={baixar}>
        <i className="bi bi-download me-1" aria-hidden="true" />
        {texto}
      </button>
    );
  return (
    <span className="btn-group" role="group" aria-label="PDF gerado">
      <a className="btn btn-success" href={url} target="_blank" rel="noreferrer">
        <i className="bi bi-eye me-1" aria-hidden="true" />
        {texto}
        <span className="visually-hidden"> (abre em nova aba)</span>
      </a>
      <button type="button" className="btn btn-outline-success" onClick={() => imprimirPdf(url)}>
        <i className="bi bi-printer me-1" aria-hidden="true" />
        Imprimir
      </button>
      <button type="button" className="btn btn-outline-success" disabled={baixando} onClick={baixar}>
        <i className="bi bi-file-earmark-arrow-down me-1" aria-hidden="true" />
        Baixar PDF
      </button>
    </span>
  );
}
