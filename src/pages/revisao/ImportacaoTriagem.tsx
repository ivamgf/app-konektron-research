import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { get } from '../../lib/api';
import { corDaSituacao, dataHora, rotulo } from '../../lib/formato';
import type { EtapaRevisao, Revisao } from '../../lib/tipos';
import { Carregando, ErroAlerta, Vazio } from '../../components/ui';
import { useProjetoAtual } from '../projeto/ProjetoLayout';
import { aceitaImportacao, baixarModeloCsv, etapaDeEntrada, ImportarCsvEtapa } from './AcoesEtapa';
import { chaveEtapas } from './Revisao';

/**
 * Seção da revisão para importar as planilhas de triagem feitas fora do sistema (ex.: RIL-F1, F2, F3).
 * O CSV só é necessário na F1: os selecionados de cada fase passam sozinhos para a seguinte (F1 → F2 → F3).
 * O upload continua disponível em todas as fases, para quem fez a F2/F3 fora do sistema ou quer corrigir.
 */
export function ImportacaoTriagem({ revisao }: { revisao: Revisao }) {
  const { edita } = useProjetoAtual();
  const [, setParams] = useSearchParams();
  const [importar, setImportar] = useState<EtapaRevisao | null>(null);
  const etapas = useQuery({
    queryKey: chaveEtapas(revisao.id),
    queryFn: () => get<EtapaRevisao[]>(`/revisoes/${revisao.id}/etapas`),
  });
  if (etapas.isLoading) return <Carregando />;
  const todas = etapas.data ?? [];
  const lista = todas.filter((e) => aceitaImportacao(e) || (e.status === 'DISPENSADA' && e.exigeTriagem));
  const triagens = lista.filter((e) => e.exigeTriagem);
  const outras = lista.filter((e) => !e.exigeTriagem);

  const linha = (e: EtapaRevisao) => {
    const entrada = etapaDeEntrada(e, todas);
    // fase anterior (a F1 para a F2, a F2 para a F3): de onde vêm os documentos desta
    const anterior = e.exigeTriagem ? triagens.filter((x) => x.ordem < e.ordem).at(-1) : undefined;
    const vindos = e.contagens?.total ?? 0;
    return (
      <div key={e.id} className={`card mb-2 ${entrada && e.exigeTriagem ? 'border-primary' : ''}`}>
        <div className="card-body py-2 d-flex flex-wrap align-items-center gap-2">
          <div className="me-auto">
            <div className="fw-medium d-flex flex-wrap align-items-center gap-2">
              <span>
                {e.ordem}. {e.nome}
              </span>
              {entrada && e.exigeTriagem && (
                <span className="badge text-bg-primary">
                  <i className="bi bi-upload me-1" aria-hidden="true" />
                  Importe aqui
                </span>
              )}
            </div>
            <div className="small text-secondary">
              {rotulo(e.categoria)} ·{' '}
              <span className={`badge text-bg-${corDaSituacao(e.status)}`}>{rotulo(e.status)}</span>
              {e.concluidaEm && ` · concluída em ${dataHora(e.concluidaEm)}`}
            </div>
            {anterior && (
              <div className="small mt-1 text-primary-emphasis">
                <i className="bi bi-arrow-return-right me-1" aria-hidden="true" />
                {vindos > 0
                  ? `${vindos} documento(s) selecionado(s) em "${anterior.nome}" já estão nesta fase — não é preciso importar de novo.`
                  : `Recebe automaticamente os documentos selecionados em "${anterior.nome}".`}
              </div>
            )}
            {e.contagens && (
              <div className="small mt-1" aria-label={`Contagens da etapa ${e.nome}`}>
                {e.contagens.total} documento(s) ·{' '}
                <span className="text-success">{e.contagens.selecionados} selecionado(s)</span> ·{' '}
                <span className="text-danger">{e.contagens.excluidos} excluído(s)</span> · {e.contagens.semDecisao} sem
                decisão
              </div>
            )}
          </div>
          {(e.status !== 'PENDENTE' || (anterior && vindos > 0)) && (
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setParams({ aba: 'etapas', etapa: e.id })}
            >
              <i
                className={`bi ${e.status === 'PENDENTE' ? 'bi-play-circle' : 'bi-pencil-square'} me-1`}
                aria-hidden="true"
              />
              {e.status === 'PENDENTE' ? 'Abrir e triar na etapa' : 'Ver e editar decisões'}
            </button>
          )}
          {edita && aceitaImportacao(e) && (
            <button
              className={`btn btn-sm ${entrada || !e.exigeTriagem ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setImportar(e)}
            >
              <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
              {entrada || !e.exigeTriagem ? 'Importar CSV' : 'Importar CSV (opcional)'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section aria-labelledby="titulo-importacao">
      <div className="d-flex flex-wrap align-items-start gap-2 mb-3">
        <div className="me-auto" style={{ maxWidth: 760 }}>
          <h3 id="titulo-importacao" className="h5 mb-1">
            Importar planilhas de triagem
          </h3>
          <p className="small text-secondary mb-2">
            Basta importar o CSV na <strong>primeira fase (F1)</strong>, uma linha por documento, com a coluna{' '}
            <code>Situação</code> (Selecionado/Excluído) — o layout da planilha RIL é aceito como está. Os selecionados
            na F1 passam automaticamente para a F2, e os selecionados na F2 para a F3, sem novo upload.
          </p>
          <p className="small text-secondary mb-0">
            Pode enviar um arquivo por base (ex.: <code>ieee.csv</code>, <code>pubmed.csv</code>,{' '}
            <code>scielo.csv</code>
            ): escolha <em>Adicionar</em> para somar ao que já foi importado, <em>Substituir só as bases do arquivo</em>{' '}
            para corrigir um arquivo enviado antes, ou <em>Substituir tudo</em>. A F2 e a F3 também aceitam CSV, se a
            triagem delas foi feita fora do sistema.
          </p>
        </div>
        <button type="button" className="btn btn-link btn-sm" onClick={baixarModeloCsv}>
          <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
          Baixar modelo CSV
        </button>
      </div>
      <ErroAlerta erro={etapas.error} />
      {triagens.length ? (
        triagens.map(linha)
      ) : (
        <Vazio icone="bi-funnel">Esta revisão não tem etapas de triagem. Ajuste as etapas no tipo de revisão.</Vazio>
      )}
      {outras.length > 0 && (
        <details className="mt-3">
          <summary className="small">Outras etapas que aceitam CSV (busca, deduplicação, inclusão)</summary>
          <div className="mt-2">{outras.map(linha)}</div>
        </details>
      )}
      {importar && (
        <ImportarCsvEtapa
          revisaoId={revisao.id}
          etapa={importar}
          entrada={etapaDeEntrada(importar, todas)}
          aberto
          aoFechar={() => setImportar(null)}
        />
      )}
    </section>
  );
}
