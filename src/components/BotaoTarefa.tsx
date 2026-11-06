import { useEffect, useState, type ReactNode } from 'react';
import { get, mensagemDeErro, post } from '../lib/api';
import type { Tarefa } from '../lib/tipos';

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
    const consultar = async () => {
      try {
        const t = await get<Tarefa>(`/tarefas/${tarefaId}`);
        if (!vivo) return;
        setTarefa(t);
        if (t.status === 'PENDENTE' || t.status === 'PROCESSANDO') timer = setTimeout(consultar, intervaloMs);
        else if (t.status === 'ERRO') setErro(t.erro ?? 'A tarefa falhou');
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

  const andamento = !!tarefaId && !erro && (!tarefa || tarefa.status === 'PENDENTE' || tarefa.status === 'PROCESSANDO');
  return { iniciar, tarefa, erro, andamento, url: tarefa?.status === 'CONCLUIDA' ? tarefa.resultado?.url : undefined };
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
      {t.url && (
        <a className="btn btn-success" href={t.url} target="_blank" rel="noreferrer">
          <i className="bi bi-download me-1" aria-hidden="true" />
          {textoPronto}
        </a>
      )}
      {t.erro && (
        <span className="text-danger small" role="alert">
          {t.erro}
        </span>
      )}
    </span>
  );
}
