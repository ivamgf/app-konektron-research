import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { get } from '../../lib/api';
import { corDaSituacao, dataHora, rotulo } from '../../lib/formato';
import type { EtapaRevisao, Revisao } from '../../lib/tipos';
import { ErroAlerta } from '../../components/ui';
import { useProjetoAtual } from '../projeto/ProjetoLayout';
import { aceitaImportacao, EditarEtapa, etapaDeEntrada, ImportarCsvEtapa } from './AcoesEtapa';
import { chaveEtapas } from './Revisao';

/** Painel: dados da revisão e de cada etapa (situação, datas, contagens) com importação e edição */
export function DadosDaRevisao({ revisao }: { revisao: Revisao }) {
  const { edita } = useProjetoAtual();
  const [, setParams] = useSearchParams();
  const etapas = useQuery({
    queryKey: chaveEtapas(revisao.id),
    queryFn: () => get<EtapaRevisao[]>(`/revisoes/${revisao.id}/etapas`),
  });
  const [editar, setEditar] = useState<EtapaRevisao | null>(null);
  const [importar, setImportar] = useState<EtapaRevisao | null>(null);
  const lista = etapas.data ?? [];
  const concluidas = lista.filter((e) => e.status === 'CONCLUIDA' || e.status === 'DISPENSADA').length;

  return (
    <section className="mb-4" aria-labelledby="dados-revisao">
      <h3 id="dados-revisao" className="h6">
        Dados da revisão
      </h3>
      <dl className="row small mb-3">
        <dt className="col-sm-3 col-lg-2">Tipo</dt>
        <dd className="col-sm-9 col-lg-4">
          {revisao.tipoNome}
          {revisao.sistematica && <span className="badge text-bg-success ms-2">Sistemática</span>}
        </dd>
        <dt className="col-sm-3 col-lg-2">Situação</dt>
        <dd className="col-sm-9 col-lg-4">
          <span className={`badge text-bg-${corDaSituacao(revisao.status)}`}>{rotulo(revisao.status)}</span>
          {revisao.etapaAtualNome && <span className="text-secondary ms-2">etapa atual: {revisao.etapaAtualNome}</span>}
        </dd>
        <dt className="col-sm-3 col-lg-2">Diretriz de relato</dt>
        <dd className="col-sm-9 col-lg-4">
          {revisao.diretrizSigla ? `${revisao.diretrizSigla} ${revisao.diretrizVersao ?? ''}` : 'Nenhuma'}
        </dd>
        <dt className="col-sm-3 col-lg-2">Revisores</dt>
        <dd className="col-sm-9 col-lg-4">{revisao.doisRevisores ? 'Dois revisores (RN12)' : 'Um revisor'}</dd>
        <dt className="col-sm-3 col-lg-2">Progresso</dt>
        <dd className="col-sm-9 col-lg-4">
          {concluidas} de {lista.length} etapa(s) concluída(s) ou dispensada(s)
        </dd>
      </dl>

      <ErroAlerta erro={etapas.error} />
      <div className="table-responsive">
        <table className="table table-sm small align-middle">
          <caption className="visually-hidden">Etapas da revisão</caption>
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Situação</th>
              <th>Início</th>
              <th>Fim</th>
              <th className="text-end">Total</th>
              <th className="text-end">Selec.</th>
              <th className="text-end">Excl.</th>
              <th className="text-end">Pend.</th>
              {edita && <th className="text-end">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id}>
                <td>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-start"
                    onClick={() => setParams({ aba: 'etapas', etapa: e.id })}
                  >
                    {e.ordem}. {e.nome}
                  </button>
                  <div className="text-secondary">
                    {rotulo(e.categoria)}
                    {e.exigeTriagem && ' · triagem'}
                    {e.justificativaDispensa && ` · dispensada: ${e.justificativaDispensa}`}
                  </div>
                </td>
                <td>
                  <span className={`badge text-bg-${corDaSituacao(e.status)}`}>{rotulo(e.status)}</span>
                </td>
                <td>{e.iniciadaEm ? dataHora(e.iniciadaEm) : '—'}</td>
                <td>{e.concluidaEm ? dataHora(e.concluidaEm) : '—'}</td>
                <td className="text-end">{e.contagens?.total ?? '—'}</td>
                <td className="text-end text-success">{e.contagens?.selecionados ?? '—'}</td>
                <td className="text-end text-danger">{e.contagens?.excluidos ?? '—'}</td>
                <td className="text-end">
                  {e.contagens ? (
                    <>
                      {e.contagens.semDecisao}
                      {e.contagens.conflitos > 0 && (
                        <span className="text-danger fw-bold" title="Conflitos">
                          {' '}
                          · {e.contagens.conflitos} conf.
                        </span>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                {edita && (
                  <td className="text-end text-nowrap">
                    {aceitaImportacao(e) && (
                      <button
                        className="btn btn-outline-primary btn-sm me-1"
                        aria-label={`Importar CSV na etapa ${e.nome}`}
                        title="Importar CSV"
                        onClick={() => setImportar(e)}
                      >
                        <i className="bi bi-filetype-csv" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      aria-label={`Editar a etapa ${e.nome}`}
                      title="Editar etapa"
                      onClick={() => setEditar(e)}
                    >
                      <i className="bi bi-pencil" aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editar && <EditarEtapa revisaoId={revisao.id} etapa={editar} aberto aoFechar={() => setEditar(null)} />}
      {importar && (
        <ImportarCsvEtapa
          revisaoId={revisao.id}
          etapa={importar}
          entrada={etapaDeEntrada(importar, lista)}
          aberto
          aoFechar={() => setImportar(null)}
        />
      )}
    </section>
  );
}
