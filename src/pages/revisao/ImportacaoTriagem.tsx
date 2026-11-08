import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { get } from '../../lib/api';
import { corDaSituacao, dataHora, rotulo } from '../../lib/formato';
import type { EtapaRevisao, Revisao } from '../../lib/tipos';
import { Carregando, ErroAlerta, Vazio } from '../../components/ui';
import { useProjetoAtual } from '../projeto/ProjetoLayout';
import { aceitaImportacao, baixarModeloCsv, ImportarCsvEtapa } from './AcoesEtapa';
import { chaveEtapas } from './Revisao';

/**
 * Seção da revisão para importar as planilhas de triagem feitas fora do sistema (ex.: RIL-F1, F2, F3):
 * uma linha por etapa que recebe documentos, com a situação, as contagens e o botão de importação.
 * Depois de importar, as decisões aparecem na etapa e podem ser editadas.
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
  const lista = (etapas.data ?? []).filter((e) => aceitaImportacao(e) || (e.status === 'DISPENSADA' && e.exigeTriagem));
  const triagens = lista.filter((e) => e.exigeTriagem);
  const outras = lista.filter((e) => !e.exigeTriagem);

  const linha = (e: EtapaRevisao) => (
    <div key={e.id} className="card mb-2">
      <div className="card-body py-2 d-flex flex-wrap align-items-center gap-2">
        <div className="me-auto">
          <div className="fw-medium">
            {e.ordem}. {e.nome}
          </div>
          <div className="small text-secondary">
            {rotulo(e.categoria)} · <span className={`badge text-bg-${corDaSituacao(e.status)}`}>{rotulo(e.status)}</span>
            {e.concluidaEm && ` · concluída em ${dataHora(e.concluidaEm)}`}
          </div>
          {e.contagens && (
            <div className="small mt-1" aria-label={`Contagens da etapa ${e.nome}`}>
              {e.contagens.total} documento(s) ·{' '}
              <span className="text-success">{e.contagens.selecionados} selecionado(s)</span> ·{' '}
              <span className="text-danger">{e.contagens.excluidos} excluído(s)</span> · {e.contagens.semDecisao} sem
              decisão
            </div>
          )}
        </div>
        {e.status !== 'PENDENTE' && (
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setParams({ aba: 'etapas', etapa: e.id })}>
            <i className="bi bi-pencil-square me-1" aria-hidden="true" />
            Ver e editar decisões
          </button>
        )}
        {edita && aceitaImportacao(e) && (
          <button className="btn btn-primary btn-sm" onClick={() => setImportar(e)}>
            <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
            Importar CSV
          </button>
        )}
      </div>
    </div>
  );

  return (
    <section aria-labelledby="titulo-importacao">
      <div className="d-flex flex-wrap align-items-start gap-2 mb-3">
        <div className="me-auto" style={{ maxWidth: 760 }}>
          <h3 id="titulo-importacao" className="h5 mb-1">
            Importar planilhas de triagem
          </h3>
          <p className="small text-secondary mb-0">
            Importe o CSV de cada fase (F1, F2, F3…) na etapa correspondente, uma linha por documento, com a coluna{' '}
            <code>Situação</code> (Selecionado/Excluído) — o layout da planilha RIL é aceito como está. Os documentos
            entram na revisão (por base, para o painel), as decisões ficam registradas na etapa e podem ser editadas
            depois. Importe na ordem: primeiro a F1, depois a F2 e a F3.
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
        <ImportarCsvEtapa revisaoId={revisao.id} etapa={importar} aberto aoFechar={() => setImportar(null)} />
      )}
    </section>
  );
}
