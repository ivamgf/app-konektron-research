import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import { caminhoDoTipo, chaves, useChecklists, useDiretrizes, useRevisoes, useTiposRevisao } from '../../lib/consultas';
import { rotulo } from '../../lib/formato';
import type { CategoriaEtapa, Revisao, TipoRevisao } from '../../lib/tipos';
import { Carregando, ErroAlerta, Modal, Situacao, Vazio } from '../../components/ui';
import { ListaEditavel } from '../../components/ListaEditavel';
import { useProjetoAtual } from './ProjetoLayout';

export default function Revisoes() {
  const { projeto, dono } = useProjetoAtual();
  const lista = useRevisoes(projeto.id);
  const [nova, setNova] = useState(false);
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 mb-0">Revisões de literatura</h2>
        {dono && (
          <button className="btn btn-primary" onClick={() => setNova(true)}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Nova revisão
          </button>
        )}
      </div>
      {lista.isLoading && <Carregando />}
      <ErroAlerta erro={lista.error} />
      {lista.data?.length === 0 && (
        <Vazio icone="bi-journal-text">
          Nenhuma revisão. Crie uma escolhendo o tipo (ex.: Sistemática › Integrativa) e a diretriz de relato.
        </Vazio>
      )}
      <div className="row g-3">
        {lista.data?.map((r) => (
          <div className="col-md-6" key={r.id}>
            <div className="card h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between gap-2 mb-2">
                  <span className="badge text-bg-light border">{r.tipoNome}</span>
                  <Situacao valor={r.status} />
                </div>
                <h3 className="h5">
                  <Link to={r.id} className="stretched-link text-reset text-decoration-none">
                    {r.titulo}
                  </Link>
                </h3>
                <div className="small text-secondary">
                  {r.diretrizSigla ? `${r.diretrizSigla} ${r.diretrizVersao ?? ''}` : 'Sem diretriz de relato'}
                  {r.etapaAtualNome && ` · etapa atual: ${r.etapaAtualNome}`}
                  {r.doisRevisores && ' · dois revisores'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal titulo="Nova revisão" aberto={nova} aoFechar={() => setNova(false)} tamanho="lg">
        {nova && <NovaRevisao aoCriar={() => setNova(false)} />}
      </Modal>
    </>
  );
}

type EtapaAjustada = {
  etapaModeloId: string | null;
  nome: string;
  categoria: CategoriaEtapa;
  exigeTriagem: boolean;
  permiteExclusao: boolean;
};

function NovaRevisao({ aoCriar }: { aoCriar: () => void }) {
  const { projeto } = useProjetoAtual();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const tipos = useTiposRevisao(projeto.id);
  const diretrizes = useDiretrizes();
  const checklists = useChecklists();
  const [titulo, setTitulo] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [diretrizId, setDiretrizId] = useState('');
  const [checklistId, setChecklistId] = useState('');
  const [doisRevisores, setDoisRevisores] = useState(false);
  const [etapas, setEtapas] = useState<EtapaAjustada[]>([]);
  const [novoTipo, setNovoTipo] = useState<{ nome: string; tipoPaiId: string } | null>(null);
  const tipo = useQuery({
    queryKey: ['tipo-revisao', tipoId],
    queryFn: () => get<TipoRevisao>(`/tipos-revisao/${tipoId}`),
    enabled: !!tipoId,
  });

  // UC06 passo 4: mostra as etapas do tipo para ajuste
  useEffect(() => {
    if (tipo.data?.etapas)
      setEtapas(
        tipo.data.etapas.map((e) => ({
          etapaModeloId: e.id,
          nome: e.nome,
          categoria: e.categoria,
          exigeTriagem: e.exigeTriagem,
          permiteExclusao: e.permiteExclusao,
        })),
      );
  }, [tipo.data]);

  // UC06 passo 3: a diretriz sugere o checklist genérico vinculado
  useEffect(() => {
    const d = diretrizes.data?.find((x) => x.id === diretrizId);
    if (d?.checklistModeloId) setChecklistId(d.checklistModeloId);
  }, [diretrizId, diretrizes.data]);

  const criarTipo = useMutation({
    mutationFn: () =>
      post<TipoRevisao>('/tipos-revisao', {
        nome: novoTipo!.nome.trim(),
        tipoPaiId: novoTipo!.tipoPaiId || null,
        projetoId: projeto.id,
      }),
    onSuccess: async (t) => {
      await qc.invalidateQueries({ queryKey: chaves.tiposRevisao(projeto.id) });
      setTipoId(t.id);
      setNovoTipo(null);
    },
  });
  const criar = useMutation({
    mutationFn: () =>
      post<Revisao>(`/projetos/${projeto.id}/revisoes`, {
        titulo: titulo.trim(),
        tipoRevisaoId: tipoId,
        diretrizRelatoId: diretrizId || null,
        checklistModeloId: checklistId || null,
        doisRevisores,
        etapas: etapas.filter((e) => e.nome.trim()),
      }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: chaves.revisoes(projeto.id) });
      aoCriar();
      navegar(r.id);
    },
  });
  const ativos = (tipos.data ?? []).filter((t) => t.ativo);
  const ordenados = [...ativos].sort((a, b) =>
    caminhoDoTipo(ativos, a.id).localeCompare(caminhoDoTipo(ativos, b.id), 'pt-BR'),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        criar.mutate();
      }}
    >
      <ErroAlerta erro={criar.error ?? tipos.error} />
      <div className="mb-3">
        <label htmlFor="rev-titulo" className="form-label">
          Título *
        </label>
        <input
          id="rev-titulo"
          className="form-control"
          maxLength={300}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>
      <div className="mb-3">
        <label htmlFor="rev-tipo" className="form-label">
          Tipo de revisão *
        </label>
        <div className="input-group">
          <select id="rev-tipo" className="form-select" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
            <option value="">Escolha…</option>
            {ordenados.map((t) => (
              <option key={t.id} value={t.id}>
                {caminhoDoTipo(ativos, t.id)}
                {t.projetoId ? ' (do projeto)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setNovoTipo({ nome: '', tipoPaiId: tipoId })}
          >
            Criar tipo
          </button>
        </div>
        {tipo.data?.sistematicaEfetiva && <span className="badge text-bg-success mt-2">Sistemática</span>}
      </div>
      {novoTipo && (
        <div className="card bg-body-tertiary border-0 mb-3">
          <div className="card-body">
            <div className="small fw-bold mb-2">Novo tipo neste projeto (UC05)</div>
            <ErroAlerta erro={criarTipo.error} />
            <div className="row g-2">
              <div className="col-md-6">
                <input
                  className="form-control form-control-sm"
                  placeholder="Nome"
                  aria-label="Nome do novo tipo"
                  value={novoTipo.nome}
                  onChange={(e) => setNovoTipo({ ...novoTipo, nome: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <select
                  className="form-select form-select-sm"
                  aria-label="Tipo pai"
                  value={novoTipo.tipoPaiId}
                  onChange={(e) => setNovoTipo({ ...novoTipo, tipoPaiId: e.target.value })}
                >
                  <option value="">Sem tipo pai (do zero)</option>
                  {ordenados.map((t) => (
                    <option key={t.id} value={t.id}>
                      Subtipo de {caminhoDoTipo(ativos, t.id)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2 d-flex gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!novoTipo.nome.trim() || criarTipo.isPending}
                onClick={() => criarTipo.mutate()}
              >
                Criar
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setNovoTipo(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label htmlFor="rev-diretriz" className="form-label">
            Diretriz de relato
          </label>
          <select
            id="rev-diretriz"
            className="form-select"
            value={diretrizId}
            onChange={(e) => setDiretrizId(e.target.value)}
          >
            <option value="">Nenhuma</option>
            {diretrizes.data
              ?.filter((d) => d.ativo)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.sigla} {d.versao ?? ''} — {d.nome}
                </option>
              ))}
          </select>
        </div>
        <div className="col-md-6">
          <label htmlFor="rev-checklist" className="form-label">
            Checklist genérico
          </label>
          <select
            id="rev-checklist"
            className="form-select"
            value={checklistId}
            onChange={(e) => setChecklistId(e.target.value)}
          >
            <option value="">Padrão do sistema</option>
            {checklists.data
              ?.filter((c) => c.ativo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="form-check form-switch mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="rev-dois"
          checked={doisRevisores}
          onChange={(e) => setDoisRevisores(e.target.checked)}
        />
        <label className="form-check-label" htmlFor="rev-dois">
          Triagem por dois revisores independentes (conflitos resolvidos pelo orientador)
        </label>
      </div>
      {tipoId && (
        <div className="mb-3">
          <div className="fw-medium mb-2">Etapas da revisão</div>
          {tipo.isLoading ? (
            <Carregando />
          ) : (
            <ListaEditavel
              itens={etapas}
              aoMudar={setEtapas}
              novo={(): EtapaAjustada => ({
                etapaModeloId: null,
                nome: '',
                categoria: 'LIVRE',
                exigeTriagem: false,
                permiteExclusao: false,
              })}
              rotuloItem={(i) => `Etapa ${i + 1}`}
              textoAdicionar="Adicionar etapa"
              max={40}
              render={(e, set, i) => (
                <div className="input-group input-group-sm">
                  <input
                    className="form-control"
                    aria-label={`Nome da etapa ${i + 1}`}
                    value={e.nome}
                    onChange={(ev) => set({ nome: ev.target.value })}
                  />
                  <span className="input-group-text">{rotulo(e.categoria)}</span>
                </div>
              )}
            />
          )}
        </div>
      )}
      <div className="text-end">
        <button
          className="btn btn-primary"
          disabled={titulo.trim().length < 3 || !tipoId || !etapas.length || criar.isPending}
        >
          Criar revisão
        </button>
      </div>
    </form>
  );
}
