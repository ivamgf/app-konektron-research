import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import { caminhoDoTipo, chaves, useProtocolo, useRevisoes, useTiposRevisao } from '../../lib/consultas';
import { rotulo } from '../../lib/formato';
import type { Analise, DocumentoResumo, Pagina } from '../../lib/tipos';
import { BarraProgresso, Carregando, ErroAlerta, Modal, Situacao, Vazio } from '../../components/ui';
import { useProjetoAtual } from './ProjetoLayout';

export default function Analises() {
  const { projeto, dono } = useProjetoAtual();
  const lista = useQuery({
    queryKey: chaves.analises(projeto.id),
    queryFn: () => get<Analise[]>(`/projetos/${projeto.id}/analises`),
  });
  const [nova, setNova] = useState(false);
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 mb-0">Análises de documentos</h2>
        {dono && (
          <button className="btn btn-primary" onClick={() => setNova(true)}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Nova análise
          </button>
        )}
      </div>
      {lista.isLoading && <Carregando />}
      <ErroAlerta erro={lista.error} />
      {lista.data?.length === 0 && <Vazio icone="bi-clipboard-data">Nenhuma análise criada.</Vazio>}
      <div className="row g-3">
        {lista.data?.map((a) => {
          const total = Number(a.documentos ?? 0);
          const feitos = Number(a.concluidos ?? 0);
          return (
            <div className="col-md-6" key={a.id}>
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between gap-2 mb-2">
                    <span className="badge text-bg-light border">{a.tipoNome}</span>
                    <Situacao valor={a.status} />
                  </div>
                  <h3 className="h5">
                    <Link to={a.id} className="stretched-link text-reset text-decoration-none">
                      {a.nome}
                    </Link>
                  </h3>
                  <div className="small text-secondary mb-2">
                    {rotulo(a.fonte)}
                    {a.revisaoTitulo && ` · ${a.revisaoTitulo}`}
                  </div>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>Documentos concluídos</span>
                    <span>
                      {feitos}/{total}
                    </span>
                  </div>
                  <BarraProgresso valor={total ? (feitos / total) * 100 : 0} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Modal titulo="Nova análise" aberto={nova} aoFechar={() => setNova(false)} tamanho="lg">
        {nova && <NovaAnalise aoCriar={() => setNova(false)} />}
      </Modal>
    </>
  );
}

const FONTES = ['INCLUIDOS_REVISAO', 'INTEGRADOS', 'REFERENCIAL_TEORICO', 'SELECAO_MANUAL'] as const;

function NovaAnalise({ aoCriar }: { aoCriar: () => void }) {
  const { projeto } = useProjetoAtual();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const tipos = useTiposRevisao(projeto.id);
  const revisoes = useRevisoes(projeto.id);
  const protocolo = useProtocolo(projeto.id);
  const questoes = (protocolo.data?.questoes ?? []).filter((q) => q.ativo);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [revisaoId, setRevisaoId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [novoTipo, setNovoTipo] = useState<{ nome: string; tipoPaiId: string } | null>(null);
  const [fonte, setFonte] = useState<(typeof FONTES)[number]>('INCLUIDOS_REVISAO');
  const [qIds, setQIds] = useState<string[] | null>(null); // null = todas
  const [docIds, setDocIds] = useState<string[]>([]);
  const docs = useQuery({
    queryKey: ['projeto', projeto.id, 'documentos', 'todos'],
    queryFn: () =>
      get<Pagina<DocumentoResumo>>(`/projetos/${projeto.id}/documentos`, { pageSize: 200, sort: 'titulo' }),
    enabled: fonte === 'SELECAO_MANUAL',
  });
  const criar = useMutation({
    mutationFn: () =>
      post<Analise>(`/projetos/${projeto.id}/analises`, {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        revisaoId: revisaoId || null,
        ...(novoTipo
          ? { novoTipo: { nome: novoTipo.nome.trim(), tipoPaiId: novoTipo.tipoPaiId || null } }
          : { tipoRevisaoId: tipoId }),
        fonte,
        ...(qIds ? { questaoIds: qIds } : {}),
        ...(fonte === 'SELECAO_MANUAL' ? { documentoIds: docIds } : {}),
      }),
    onSuccess: async (a) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: chaves.analises(projeto.id) }),
        qc.invalidateQueries({ queryKey: chaves.tiposRevisao(projeto.id) }),
      ]);
      aoCriar();
      navegar(a.id);
    },
  });
  const revisao = revisoes.data?.find((r) => r.id === revisaoId);
  const ativos = (tipos.data ?? []).filter((t) => t.ativo);
  const marcadas = qIds ?? questoes.map((q) => q.id);
  const tipoOk = novoTipo ? !!novoTipo.nome.trim() : !!tipoId;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        criar.mutate();
      }}
    >
      <ErroAlerta erro={criar.error} />
      <div className="mb-3">
        <label htmlFor="an-nome" className="form-label">
          Nome *
        </label>
        <input
          id="an-nome"
          className="form-control"
          maxLength={200}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <div className="mb-3">
        <label htmlFor="an-desc" className="form-label">
          Descrição
        </label>
        <textarea
          id="an-desc"
          className="form-control"
          rows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label htmlFor="an-rev" className="form-label">
            Revisão de origem (opcional)
          </label>
          <select
            id="an-rev"
            className="form-select"
            value={revisaoId}
            onChange={(e) => {
              setRevisaoId(e.target.value);
              const r = revisoes.data?.find((x) => x.id === e.target.value);
              if (r && !tipoId && !novoTipo) setTipoId(r.tipoRevisaoId);
            }}
          >
            <option value="">Nenhuma (todas as revisões)</option>
            {revisoes.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.titulo}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label htmlFor="an-tipo" className="form-label">
            Tipo de revisão *
          </label>
          {novoTipo ? (
            <div className="input-group">
              <input
                className="form-control"
                placeholder="Nome do novo tipo"
                aria-label="Nome do novo tipo"
                value={novoTipo.nome}
                onChange={(e) => setNovoTipo({ ...novoTipo, nome: e.target.value })}
              />
              <button type="button" className="btn btn-outline-secondary" onClick={() => setNovoTipo(null)}>
                Usar existente
              </button>
            </div>
          ) : (
            <div className="input-group">
              <select id="an-tipo" className="form-select" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                <option value="">Escolha…</option>
                {ativos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {caminhoDoTipo(ativos, t.id)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setNovoTipo({ nome: '', tipoPaiId: tipoId })}
              >
                Gerar novo tipo
              </button>
            </div>
          )}
          {revisao && <div className="form-text">Tipo da revisão: {revisao.tipoNome}</div>}
          {novoTipo && (
            <select
              className="form-select form-select-sm mt-2"
              aria-label="Tipo pai do novo tipo"
              value={novoTipo.tipoPaiId}
              onChange={(e) => setNovoTipo({ ...novoTipo, tipoPaiId: e.target.value })}
            >
              <option value="">Sem tipo pai</option>
              {ativos.map((t) => (
                <option key={t.id} value={t.id}>
                  Subtipo de {caminhoDoTipo(ativos, t.id)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <fieldset className="mb-3">
        <legend className="form-label fs-6">Fonte dos documentos</legend>
        {FONTES.map((f) => (
          <div className="form-check form-check-inline" key={f}>
            <input
              className="form-check-input"
              type="radio"
              name="fonte"
              id={`fonte-${f}`}
              checked={fonte === f}
              onChange={() => setFonte(f)}
            />
            <label className="form-check-label" htmlFor={`fonte-${f}`}>
              {rotulo(f)}
            </label>
          </div>
        ))}
      </fieldset>
      {fonte === 'SELECAO_MANUAL' && (
        <div className="border rounded p-2 mb-3" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {docs.isLoading && <Carregando />}
          {docs.data?.itens.length === 0 && <div className="small text-secondary">Nenhum documento no projeto.</div>}
          {docs.data?.itens.map((d) => (
            <div className="form-check small" key={d.id}>
              <input
                className="form-check-input"
                type="checkbox"
                id={`doc-${d.id}`}
                checked={docIds.includes(d.id)}
                onChange={(e) => setDocIds(e.target.checked ? [...docIds, d.id] : docIds.filter((x) => x !== d.id))}
              />
              <label className="form-check-label" htmlFor={`doc-${d.id}`}>
                {d.titulo} {d.ano ? `(${d.ano})` : ''}
              </label>
            </div>
          ))}
        </div>
      )}
      <fieldset className="mb-3">
        <legend className="form-label fs-6">
          Questões de análise ({marcadas.length} de {questoes.length})
        </legend>
        {questoes.length === 0 && (
          <div className="small text-warning-emphasis">
            O protocolo não tem questões QA. <Link to="../questoes">Cadastre as questões</Link> antes.
          </div>
        )}
        {questoes.map((q) => (
          <div className="form-check small" key={q.id}>
            <input
              className="form-check-input"
              type="checkbox"
              id={`qa-${q.id}`}
              checked={marcadas.includes(q.id)}
              onChange={(e) => setQIds(e.target.checked ? [...marcadas, q.id] : marcadas.filter((x) => x !== q.id))}
            />
            <label className="form-check-label" htmlFor={`qa-${q.id}`}>
              <span className="k-mono fw-bold me-1">{q.codigo}</span>
              {q.enunciado}
            </label>
          </div>
        ))}
      </fieldset>
      <div className="text-end">
        <button className="btn btn-primary" disabled={!nome.trim() || !tipoOk || !marcadas.length || criar.isPending}>
          Criar análise
        </button>
      </div>
    </form>
  );
}
