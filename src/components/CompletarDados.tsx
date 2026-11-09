import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTarefa } from './BotaoTarefa';

type Resultado = { analisados?: number; completados?: number; resumos?: number; palavrasChave?: number };

/**
 * Procura na web (OpenAlex, Crossref, Semantic Scholar e a página do link) os resumos e as
 * palavras-chave em branco dos documentos importados. Roda no worker da API; só preenche o vazio.
 */
export function BotaoCompletarDados({
  url,
  texto = 'Completar resumos e palavras-chave da web',
  className = 'btn btn-outline-primary btn-sm',
}: {
  /** POST que enfileira a tarefa: /revisoes/:id/completar-metadados ou /projetos/:id/documentos/completar */
  url: string;
  texto?: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const t = useTarefa(3000, 60 * 60_000);
  const r = (t.tarefa?.status === 'CONCLUIDA' ? t.tarefa.resultado : undefined) as Resultado | undefined;
  const atualizou = useRef(false);

  useEffect(() => {
    if (!r || atualizou.current) return;
    atualizou.current = true;
    // documentos, triagem e análise passam a ver os campos completados
    qc.invalidateQueries({ queryKey: ['projeto'] });
    qc.invalidateQueries({ queryKey: ['etapa'] });
    qc.invalidateQueries({ queryKey: ['documento'] });
  }, [r, qc]);

  return (
    <span className="d-inline-flex flex-wrap align-items-center gap-2">
      <button
        type="button"
        className={className}
        disabled={t.andamento}
        onClick={() => {
          atualizou.current = false;
          t.iniciar(url);
        }}
        title="Busca em fontes abertas (OpenAlex, Crossref, Semantic Scholar e a página do link) só os campos em branco"
      >
        {t.andamento ? (
          <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
        ) : (
          <i className="bi bi-cloud-download me-1" aria-hidden="true" />
        )}
        {t.andamento ? 'Procurando na web… (pode levar alguns minutos)' : texto}
      </button>
      <span className="small" role="status">
        {r &&
          (r.analisados
            ? `${r.analisados} documento(s) com campos em branco: ${r.resumos ?? 0} resumo(s) e ${r.palavrasChave ?? 0} lista(s) de palavras-chave completados.`
            : 'Nenhum documento com resumo ou palavras-chave em branco.')}
      </span>
      {t.erro && (
        <span className="text-danger small" role="alert">
          {t.erro}
        </span>
      )}
    </span>
  );
}
