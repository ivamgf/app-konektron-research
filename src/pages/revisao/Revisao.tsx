import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, put } from '../../lib/api';
import { chaves } from '../../lib/consultas';
import { corDaSituacao, dataHora, ICONE_SITUACAO, rotulo } from '../../lib/formato';
import type { EtapaRevisao, Revisao as TRevisao } from '../../lib/tipos';
import { Abas, Carregando, ErroAlerta, Modal, Situacao } from '../../components/ui';
import { BotaoTarefa } from '../../components/BotaoTarefa';
import { useProjetoAtual } from '../projeto/ProjetoLayout';
import { Buscas } from './Buscas';
import { Triagem } from './Triagem';
import { Inclusao } from './Inclusao';
import { Painel } from './Painel';
import { Checklist } from './Checklist';
import { DocumentosDaRevisao } from './DocumentosDaRevisao';
import { Duplicados } from './Duplicados';
import { aceitaImportacao, EditarEtapa, etapaDeEntrada, ImportarCsvEtapa } from './AcoesEtapa';
import { ImportacaoTriagem } from './ImportacaoTriagem';
import { DiagramaFluxo } from './DiagramaFluxo';
import { RegistroDaRevisao } from './RegistroDaRevisao';
import { erroOrdemDasFases } from './termosBusca';

const ABAS = [
  { id: 'etapas', texto: 'Etapas', icone: 'bi-signpost-split' },
  { id: 'importar', texto: 'Importar triagem', icone: 'bi-filetype-csv' },
  { id: 'painel', texto: 'Painel de etapas', icone: 'bi-bar-chart' },
  { id: 'diagrama', texto: 'Diagrama de fluxo', icone: 'bi-diagram-3' },
  { id: 'checklist', texto: 'Checklist de relato', icone: 'bi-list-check' },
  { id: 'documentos', texto: 'Documentos', icone: 'bi-files' },
] as const;

export const chaveEtapas = (revisaoId: string) => ['revisao', revisaoId, 'etapas'] as const;

export default function Revisao() {
  const { revisaoId = '' } = useParams();
  const { projeto } = useProjetoAtual();
  const [params, setParams] = useSearchParams();
  const aba = (ABAS.find((a) => a.id === params.get('aba'))?.id ?? 'etapas') as (typeof ABAS)[number]['id'];
  const revisao = useQuery({
    queryKey: chaves.revisao(revisaoId),
    queryFn: () => get<TRevisao>(`/revisoes/${revisaoId}`),
  });
  if (revisao.isLoading) return <Carregando />;
  if (revisao.error || !revisao.data) return <ErroAlerta erro={revisao.error ?? 'Revisão não encontrada'} />;
  const r = revisao.data;
  return (
    <>
      <div className="d-flex flex-wrap align-items-start gap-2 mb-3">
        <div className="me-auto">
          <div className="small">
            <Link to={`/projetos/${projeto.id}/revisoes`}>
              <i className="bi bi-arrow-left me-1" aria-hidden="true" />
              Revisões
            </Link>
          </div>
          <h2 className="h4 mb-1">{r.titulo}</h2>
          <div className="small text-secondary">
            {r.tipoNome}
            {r.sistematica && <span className="badge text-bg-success ms-2">Sistemática</span>}
            {r.diretrizSigla && (
              <>
                {' · '}
                {r.diretrizUrl ? (
                  <a href={r.diretrizUrl} target="_blank" rel="noreferrer">
                    {r.diretrizSigla} {r.diretrizVersao}
                    <span className="visually-hidden"> (abre em nova aba)</span>
                  </a>
                ) : (
                  `${r.diretrizSigla} ${r.diretrizVersao ?? ''}`
                )}{' '}
                (referência; o checklist é o genérico do sistema)
              </>
            )}
            {r.doisRevisores && ' · dois revisores'}
          </div>
        </div>
        <Situacao valor={r.status} />
        <BotaoTarefa
          url={`/revisoes/${r.id}/relatorio`}
          className="btn btn-outline-primary btn-sm"
          textoPronto="Abrir relatório"
        >
          <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
          Relatório PDF
        </BotaoTarefa>
        <BotaoTarefa
          url={`/revisoes/${r.id}/relatorio`}
          corpo={{ formato: 'docx' }}
          className="btn btn-outline-primary btn-sm"
          textoPronto="Baixar DOCX"
        >
          <i className="bi bi-file-earmark-word me-1" aria-hidden="true" />
          Relatório DOCX
        </BotaoTarefa>
      </div>
      <Abas
        abas={ABAS}
        atual={aba}
        aoMudar={(id) => setParams({ aba: id })}
        rotulo="Seções da revisão"
        className="nav nav-pills mb-3"
      >
        {aba === 'etapas' && <Etapas revisao={r} />}
        {aba === 'importar' && <ImportacaoTriagem revisao={r} />}
        {aba === 'painel' && <Painel revisao={r} />}
        {aba === 'diagrama' && <DiagramaFluxo revisaoId={r.id} />}
        {aba === 'checklist' && <Checklist revisaoId={r.id} />}
        {aba === 'documentos' && <DocumentosDaRevisao revisaoId={r.id} />}
      </Abas>
      <RegistroDaRevisao revisao={r} />
    </>
  );
}

function iconeEtapa(e: EtapaRevisao) {
  const cor =
    e.status === 'CONCLUIDA'
      ? 'success'
      : e.status === 'DISPENSADA'
        ? 'secondary'
        : e.status === 'EM_ANDAMENTO'
          ? 'warning'
          : 'secondary';
  const icone = e.status === 'PENDENTE' ? 'bi-lock' : (ICONE_SITUACAO[cor] ?? 'bi-circle');
  return <i className={`bi ${icone} text-${cor === 'secondary' ? 'secondary' : cor}`} aria-hidden="true" />;
}

/** Linha do tempo vertical das etapas + conteúdo da etapa à direita (ERS 8.4) */
function Etapas({ revisao }: { revisao: TRevisao }) {
  const [params, setParams] = useSearchParams();
  const etapas = useQuery({
    queryKey: chaveEtapas(revisao.id),
    queryFn: () => get<EtapaRevisao[]>(`/revisoes/${revisao.id}/etapas`),
  });
  const selecionada = params.get('etapa') ?? revisao.etapaAtualId ?? etapas.data?.[0]?.id;
  const etapa = etapas.data?.find((e) => e.id === selecionada);

  if (etapas.isLoading) return <Carregando />;
  return (
    <div className="row g-4">
      <div className="col-lg-3">
        <ErroAlerta erro={etapas.error} />
        <ol className="k-timeline" aria-label="Etapas da revisão">
          {etapas.data?.map((e) => (
            <li key={e.id}>
              {iconeEtapa(e)}
              <button
                type="button"
                className={`k-etapa ${e.id === selecionada ? 'ativa' : ''} ${e.status === 'PENDENTE' ? 'bloqueada' : ''}`}
                aria-current={e.id === selecionada ? 'true' : undefined}
                onClick={() => setParams({ aba: 'etapas', etapa: e.id })}
              >
                <span className="d-block small fw-medium">
                  {e.ordem}. {e.nome}
                </span>
                <span className="d-block small text-secondary">
                  {rotulo(e.status)}
                  {e.contagens && ` · ${e.contagens.selecionados} sel. / ${e.contagens.excluidos} exc.`}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="col-lg-9">
        {etapa && <PainelEtapa revisao={revisao} etapa={etapa} etapas={etapas.data ?? []} />}
      </div>
    </div>
  );
}

function PainelEtapa({ revisao, etapa, etapas }: { revisao: TRevisao; etapa: EtapaRevisao; etapas: EtapaRevisao[] }) {
  const { edita, dono } = useProjetoAtual();
  const qc = useQueryClient();
  const [dispensar, setDispensar] = useState(false);
  const [editar, setEditar] = useState(false);
  const [importar, setImportar] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const recarregar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: chaves.revisao(revisao.id) }),
      qc.invalidateQueries({ queryKey: chaveEtapas(revisao.id) }),
    ]);
  const acao = useMutation({
    mutationFn: (corpo: { acao?: string; justificativa?: string }) =>
      patch(`/revisoes/${revisao.id}/etapas/${etapa.id}`, corpo),
    onSuccess: async () => {
      setDispensar(false);
      setJustificativa('');
      await recarregar();
    },
  });
  const ordenar = useMutation({
    mutationFn: (ids: string[]) => put(`/revisoes/${revisao.id}/etapas/ordem`, { ids }),
    onSuccess: recarregar,
  });
  const i = etapas.findIndex((e) => e.id === etapa.id);
  /** lista com a etapa trocada de lugar com a vizinha (d = -1 sobe, +1 desce) */
  const trocada = (d: number) => {
    const l = [...etapas];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    return l;
  };
  const mover = (d: number) => ordenar.mutate(trocada(d).map((e) => e.id));
  // F1 → F2 → F3: não deixa mover uma fase para antes de uma de número menor
  const quebraFases = (d: number) =>
    i + d >= 0 && i + d < etapas.length && !erroOrdemDasFases(etapas) && !!erroOrdemDasFases(trocada(d));
  const pendente = etapa.status === 'PENDENTE';
  const andamento = etapa.status === 'EM_ANDAMENTO';
  const fechada = etapa.status === 'CONCLUIDA' || etapa.status === 'DISPENSADA';
  const anterioresFechadas = etapas.slice(0, i).every((e) => e.status === 'CONCLUIDA' || e.status === 'DISPENSADA');

  return (
    <div className="card">
      <div className="card-header d-flex flex-wrap align-items-center gap-2">
        <div className="me-auto">
          <span className="k-label text-secondary me-2">{rotulo(etapa.categoria)}</span>
          <span className={`badge text-bg-${corDaSituacao(etapa.status)}`}>{rotulo(etapa.status)}</span>
          {etapa.iniciadaEm && <span className="small text-secondary ms-2">início {dataHora(etapa.iniciadaEm)}</span>}
          {etapa.concluidaEm && <span className="small text-secondary ms-2">fim {dataHora(etapa.concluidaEm)}</span>}
        </div>
        {edita && pendente && anterioresFechadas && (
          <button
            className="btn btn-primary btn-sm"
            disabled={acao.isPending}
            onClick={() => acao.mutate({ acao: 'INICIAR' })}
          >
            Iniciar etapa
          </button>
        )}
        {edita && andamento && (
          <button
            className="btn btn-primary btn-sm"
            disabled={acao.isPending}
            onClick={() => acao.mutate({ acao: 'CONCLUIR' })}
          >
            <i className="bi bi-check2-circle me-1" aria-hidden="true" />
            Concluir etapa
          </button>
        )}
        {edita && (pendente || andamento) && (
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setDispensar(true)}>
            Dispensar
          </button>
        )}
        {edita && fechada && (
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={acao.isPending}
            onClick={() => acao.mutate({ acao: 'REABRIR' })}
          >
            Reabrir
          </button>
        )}
        {edita && aceitaImportacao(etapa) && (
          <button className="btn btn-outline-primary btn-sm" onClick={() => setImportar(true)}>
            <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
            Importar CSV
          </button>
        )}
        {edita && (
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditar(true)}>
            <i className="bi bi-pencil me-1" aria-hidden="true" />
            Editar etapa
          </button>
        )}
      </div>
      <div className="card-body">
        <h3 className="h5">
          {etapa.ordem}. {etapa.nome}
        </h3>
        <ErroAlerta erro={acao.error ?? ordenar.error} />
        {etapa.justificativaDispensa && (
          <div className="alert alert-secondary small">Dispensada: {etapa.justificativaDispensa}</div>
        )}
        {etapa.contagens && (
          <div className="d-flex flex-wrap gap-3 small mb-3" aria-label="Contagens da etapa">
            <span>Total: {etapa.contagens.total}</span>
            <span className="text-success">Selecionados: {etapa.contagens.selecionados}</span>
            <span className="text-danger">Excluídos: {etapa.contagens.excluidos}</span>
            <span className="text-warning-emphasis">Sem decisão: {etapa.contagens.semDecisao}</span>
            {etapa.contagens.conflitos > 0 && (
              <span className="text-danger fw-bold">Conflitos: {etapa.contagens.conflitos}</span>
            )}
          </div>
        )}

        {pendente && dono && (
          <div className="border rounded p-3 mb-3 bg-body-tertiary">
            <div className="small fw-medium mb-2">Ordem (só antes de iniciar, RF22)</div>
            <div className="small text-secondary mb-2">As fases da triagem ficam sempre na sequência F1 → F2 → F3.</div>
            <div className="btn-group btn-group-sm">
              <button
                className="btn btn-outline-secondary"
                disabled={i === 0 || etapas[i - 1].status !== 'PENDENTE' || quebraFases(-1)}
                onClick={() => mover(-1)}
              >
                <i className="bi bi-arrow-up me-1" aria-hidden="true" />
                Mover para cima
              </button>
              <button
                className="btn btn-outline-secondary"
                disabled={i === etapas.length - 1 || quebraFases(1)}
                onClick={() => mover(1)}
              >
                <i className="bi bi-arrow-down me-1" aria-hidden="true" />
                Mover para baixo
              </button>
            </div>
          </div>
        )}

        {pendente && !anterioresFechadas && (
          <p className="text-secondary small">Conclua ou dispense as etapas anteriores para iniciar esta (RF23).</p>
        )}
        {!pendente && <ConteudoEtapa revisao={revisao} etapa={etapa} />}
      </div>

      <EditarEtapa revisaoId={revisao.id} etapa={etapa} aberto={editar} aoFechar={() => setEditar(false)} />
      <ImportarCsvEtapa
        revisaoId={revisao.id}
        etapa={etapa}
        entrada={etapaDeEntrada(etapa, etapas)}
        aberto={importar}
        aoFechar={() => setImportar(false)}
      />
      <Modal
        titulo="Dispensar etapa"
        aberto={dispensar}
        aoFechar={() => setDispensar(false)}
        rodape={
          <button
            className="btn btn-primary"
            disabled={justificativa.trim().length < 3 || acao.isPending}
            onClick={() => acao.mutate({ acao: 'DISPENSAR', justificativa: justificativa.trim() })}
          >
            Dispensar
          </button>
        }
      >
        <ErroAlerta erro={acao.error} />
        <label htmlFor="just-dispensa" className="form-label">
          Justificativa (obrigatória)
        </label>
        <textarea
          id="just-dispensa"
          className="form-control"
          rows={3}
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
        />
      </Modal>
    </div>
  );
}

/** O que mostrar em cada categoria de etapa (ERS 5.2 e diagrama A2) */
function ConteudoEtapa({ revisao, etapa }: { revisao: TRevisao; etapa: EtapaRevisao }) {
  const { projeto } = useProjetoAtual();
  switch (etapa.categoria) {
    case 'PROTOCOLO':
      return (
        <p>
          A revisão segue o protocolo do projeto.{' '}
          <Link to={`/projetos/${projeto.id}/protocolo`}>Abrir o protocolo</Link>
        </p>
      );
    case 'BUSCA':
      return <Buscas revisaoId={revisao.id} etapa={etapa} />;
    case 'DEDUPLICACAO':
      return <Duplicados revisao={revisao} etapa={etapa} />;
    case 'TRIAGEM':
      return <Triagem revisao={revisao} etapa={etapa} />;
    case 'INCLUSAO':
      return <Inclusao revisaoId={revisao.id} etapa={etapa} />;
    case 'ANALISE':
    case 'SINTESE':
    case 'DISCUSSAO':
      return (
        <p>
          Respostas às questões, matriz de síntese e discussão ficam na página de análise.{' '}
          <Link to={`/projetos/${projeto.id}/analises`}>Ir para as análises</Link>
        </p>
      );
    case 'CHECKLIST':
      return <Checklist revisaoId={revisao.id} />;
    default:
      return etapa.exigeTriagem || etapa.permiteExclusao ? (
        <Triagem revisao={revisao} etapa={etapa} />
      ) : (
        <p className="text-secondary">Etapa livre: registre o andamento e conclua quando terminar.</p>
      );
  }
}
