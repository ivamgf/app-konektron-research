import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, mensagemDeErro, put } from '../../lib/api';
import { useProtocolo } from '../../lib/consultas';
import { dataHora, rotulo } from '../../lib/formato';
import type { ContagensEtapa, DocumentoTriagem, EtapaRevisao, MotivoExclusao, Revisao } from '../../lib/tipos';
import { Carregando, ErroAlerta, Situacao, Vazio } from '../../components/ui';
import { useProjetoAtual } from '../projeto/ProjetoLayout';
import { abrirPdf } from '../projeto/Documentos';
import { chaveEtapas } from './Revisao';
import {
  corpoDecisao,
  pendenteParaMim,
  proximoPendente,
  teclaDeAtalho,
  validarExclusao,
  type Exclusao,
} from './triagemLogica';

type Resposta = { etapa: EtapaRevisao; contagens: ContagensEtapa; documentos: DocumentoTriagem[] };
const FILTROS = [
  ['todos', 'Todos'],
  ['pendentes', 'Pendentes'],
  ['minhas-pendentes', 'Minhas pendentes'],
  ['selecionados', 'Selecionados'],
  ['excluidos', 'Excluídos'],
  ['conflitos', 'Conflitos'],
] as const;
const MOTIVOS: MotivoExclusao[] = ['CRITERIO', 'DUPLICADO', 'SEM_ACESSO', 'OUTRO'];
const SEM_EXCLUSAO: Exclusao = { motivo: '', criterioId: '', observacao: '' };

/** UC08: lista de documentos + painel de leitura, botões grandes Selecionar/Excluir e atalhos S e E */
export function Triagem({ revisao, etapa }: { revisao: Revisao; etapa: EtapaRevisao }) {
  const { projeto, edita, papel } = useProjetoAtual();
  const qc = useQueryClient();
  const protocolo = useProtocolo(projeto.id);
  const [filtro, setFiltro] = useState<string>(revisao.doisRevisores ? 'minhas-pendentes' : 'pendentes');
  const [visao, setVisao] = useState<'triagem' | 'conflitos'>('triagem');
  const chave = ['etapa', etapa.id, 'documentos', filtro];
  const q = useQuery({ queryKey: chave, queryFn: () => get<Resposta>(`/etapas/${etapa.id}/documentos`, { filtro }) });
  const [atualId, setAtualId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<Exclusao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const docs = useMemo(() => q.data?.documentos ?? [], [q.data]);
  const atual = docs.find((d) => d.revisaoDocumentoId === atualId) ?? null;
  const so_exclusao = !etapa.exigeTriagem && etapa.permiteExclusao; // ex.: remoção de duplicados
  // decisões podem ser corrigidas também depois de a etapa ser concluída
  const podeDecidir = edita && (etapa.status === 'EM_ANDAMENTO' || etapa.status === 'CONCLUIDA');
  const criteriosExclusao = (protocolo.data?.criterios ?? []).filter((c) => c.tipo === 'EXCLUSAO');
  const podeDesempatar =
    revisao.doisRevisores && (papel === 'ORIENTADOR' || papel === 'RESPONSAVEL' || papel === 'ADMIN');

  // abre no primeiro pendente (ou no primeiro da lista)
  useEffect(() => {
    if (!docs.length) return setAtualId(null);
    if (atualId && docs.some((d) => d.revisaoDocumentoId === atualId)) return;
    setAtualId((docs.find((d) => pendenteParaMim(d, revisao.doisRevisores)) ?? docs[0]).revisaoDocumentoId);
  }, [docs, atualId, revisao.doisRevisores]);

  const decidir = useMutation({
    mutationFn: (corpo: ReturnType<typeof corpoDecisao>) =>
      put<{ contagens: ContagensEtapa }>(`/etapas/${etapa.id}/documentos/${atualId}/decisao`, corpo),
    onSuccess: () => {
      setErro(null);
      setExcluindo(null);
      const proximo = proximoPendente(docs, atualId, revisao.doisRevisores);
      qc.invalidateQueries({ queryKey: ['etapa', etapa.id] });
      qc.invalidateQueries({ queryKey: chaveEtapas(revisao.id) });
      if (proximo) setAtualId(proximo);
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  });

  const selecionar = useCallback(() => {
    if (podeDecidir && atual && !decidir.isPending) decidir.mutate(corpoDecisao('SELECIONADO'));
  }, [podeDecidir, atual, decidir]);
  const confirmarExclusao = () => {
    const falta = validarExclusao(excluindo!);
    if (falta) return setErro(falta);
    decidir.mutate(corpoDecisao('EXCLUIDO', excluindo!));
  };

  useEffect(() => {
    if (visao !== 'triagem') return;
    const tecla = (ev: KeyboardEvent) => {
      const t = teclaDeAtalho(ev);
      if (!t) return;
      const i = docs.findIndex((d) => d.revisaoDocumentoId === atualId);
      if (t === 'proximo' && i < docs.length - 1) setAtualId(docs[i + 1].revisaoDocumentoId);
      else if (t === 'anterior' && i > 0) setAtualId(docs[i - 1].revisaoDocumentoId);
      else if (t === 's' && !so_exclusao) selecionar();
      else if (t === 'e' && podeDecidir && atual)
        setExcluindo({ ...SEM_EXCLUSAO, motivo: so_exclusao ? 'DUPLICADO' : '' });
      else return;
      ev.preventDefault();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [docs, atualId, selecionar, podeDecidir, atual, so_exclusao, visao]);

  const c = q.data?.contagens;
  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        {c && (
          <div className="me-auto small" role="status" aria-live="polite">
            <strong>{c.total - c.semDecisao}</strong> de {c.total} decididos
            <div className="progress mt-1" style={{ height: 6, width: 220 }} aria-hidden="true">
              <div
                className="progress-bar bg-success"
                style={{ width: `${c.total ? (c.selecionados / c.total) * 100 : 0}%` }}
              />
              <div
                className="progress-bar bg-danger"
                style={{ width: `${c.total ? (c.excluidos / c.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
        {podeDesempatar && (
          <div className="btn-group btn-group-sm">
            <button
              className={`btn ${visao === 'triagem' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setVisao('triagem')}
            >
              Triagem
            </button>
            <button
              className={`btn ${visao === 'conflitos' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setVisao('conflitos')}
            >
              Conflitos {c?.conflitos ? <span className="badge text-bg-danger ms-1">{c.conflitos}</span> : null}
            </button>
          </div>
        )}
        {visao === 'triagem' && (
          <select
            className="form-select form-select-sm w-auto"
            aria-label="Filtro de documentos"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          >
            {FILTROS.filter(([v]) => revisao.doisRevisores || v !== 'minhas-pendentes').map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {visao === 'conflitos' ? (
        <Conflitos etapaId={etapa.id} revisaoId={revisao.id} criterios={criteriosExclusao} />
      ) : (
        <>
          {q.isLoading && <Carregando />}
          <ErroAlerta erro={q.error} />
          {q.data && docs.length === 0 && <Vazio icone="bi-check2-all">Nenhum documento neste filtro.</Vazio>}
          {docs.length > 0 && (
            <div className="row g-3">
              <div className="col-md-5 col-xl-4">
                <div className="list-group k-lista" role="listbox" aria-label="Documentos da etapa">
                  {docs.map((d) => (
                    <button
                      key={d.revisaoDocumentoId}
                      type="button"
                      role="option"
                      aria-selected={d.revisaoDocumentoId === atualId}
                      className={`list-group-item list-group-item-action ${d.revisaoDocumentoId === atualId ? 'active' : ''}`}
                      onClick={() => {
                        setAtualId(d.revisaoDocumentoId);
                        setExcluindo(null);
                        setErro(null);
                      }}
                    >
                      <div className="small fw-medium text-truncate">{d.titulo}</div>
                      <div className="d-flex gap-1 align-items-center mt-1">
                        {d.conflito ? (
                          <span className="badge text-bg-danger">Conflito</span>
                        ) : d.decisaoFinal ? (
                          <Situacao
                            valor={d.decisaoFinal}
                            texto={d.decisaoFinal === 'EXCLUIDO' && d.motivo ? rotulo(d.motivo) : undefined}
                          />
                        ) : (
                          <Situacao valor="PENDENTE" texto="Sem decisão" />
                        )}
                        {revisao.doisRevisores && d.minhaDecisao && (
                          <span className="small text-secondary">você: {rotulo(d.minhaDecisao)}</span>
                        )}
                        <span className="small text-secondary ms-auto">{d.ano ?? ''}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-md-7 col-xl-8">
                {atual && (
                  <div className="card">
                    <div className="card-body">
                      <h4 className="h5">{atual.titulo}</h4>
                      <div className="small text-secondary mb-2">
                        {[atual.autores, atual.periodico, atual.ano, atual.baseNome, rotulo(atual.origem)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className="d-flex flex-wrap gap-2 mb-3">
                        {atual.doi && (
                          <a
                            className="btn btn-outline-secondary btn-sm k-mono"
                            href={`https://doi.org/${atual.doi}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {atual.doi}
                          </a>
                        )}
                        {atual.link && (
                          <a
                            className="btn btn-outline-secondary btn-sm"
                            href={atual.link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
                            Link
                          </a>
                        )}
                        {atual.arquivoId && (
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => abrirPdf(atual.documentoId).catch((e) => setErro(mensagemDeErro(e)))}
                          >
                            <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
                            PDF
                          </button>
                        )}
                      </div>
                      <h5 className="k-label text-secondary">Resumo</h5>
                      <p className="k-leitura">{atual.resumo || <span className="text-secondary">Sem resumo.</span>}</p>
                      {atual.palavrasChave && (
                        <p className="small">
                          <strong>Palavras-chave:</strong> {atual.palavrasChave}
                        </p>
                      )}
                    </div>

                    {podeDecidir && (
                      <div className="card-footer">
                        {erro && <div className="alert alert-danger py-2 small">{erro}</div>}
                        {excluindo ? (
                          <div>
                            <fieldset>
                              <legend className="fs-6 fw-medium">Motivo da exclusão (RN10)</legend>
                              {(so_exclusao ? (['DUPLICADO', 'OUTRO'] as MotivoExclusao[]) : MOTIVOS).map((m) => (
                                <div className="form-check form-check-inline" key={m}>
                                  <input
                                    className="form-check-input"
                                    type="radio"
                                    name="motivo"
                                    id={`motivo-${m}`}
                                    checked={excluindo.motivo === m}
                                    onChange={() => setExcluindo({ ...excluindo, motivo: m })}
                                  />
                                  <label className="form-check-label" htmlFor={`motivo-${m}`}>
                                    {rotulo(m)}
                                  </label>
                                </div>
                              ))}
                            </fieldset>
                            {excluindo.motivo === 'CRITERIO' && (
                              <select
                                className="form-select form-select-sm mt-2"
                                aria-label="Critério de exclusão"
                                value={excluindo.criterioId}
                                onChange={(e) => setExcluindo({ ...excluindo, criterioId: e.target.value })}
                              >
                                <option value="">Escolha o critério…</option>
                                {criteriosExclusao.map((cr) => (
                                  <option key={cr.id} value={cr.id}>
                                    {cr.nome}
                                  </option>
                                ))}
                              </select>
                            )}
                            <textarea
                              className="form-control form-control-sm mt-2"
                              rows={2}
                              aria-label="Observação"
                              placeholder={
                                excluindo.motivo === 'OUTRO'
                                  ? 'Descreva o motivo (obrigatório)'
                                  : 'Observação (opcional)'
                              }
                              value={excluindo.observacao}
                              onChange={(e) => setExcluindo({ ...excluindo, observacao: e.target.value })}
                            />
                            <div className="d-flex gap-2 mt-2">
                              <button
                                className="btn btn-danger"
                                disabled={decidir.isPending}
                                onClick={confirmarExclusao}
                              >
                                Confirmar exclusão
                              </button>
                              <button
                                className="btn btn-outline-secondary"
                                onClick={() => (setExcluindo(null), setErro(null))}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="d-flex flex-wrap gap-2 align-items-center">
                            {so_exclusao ? (
                              atual.decisaoFinal === 'EXCLUIDO' && (
                                <button
                                  className="btn btn-outline-success btn-lg"
                                  disabled={decidir.isPending}
                                  onClick={selecionar}
                                >
                                  Desfazer exclusão
                                </button>
                              )
                            ) : (
                              <button
                                className="btn btn-success btn-lg px-4"
                                disabled={decidir.isPending}
                                onClick={selecionar}
                              >
                                <i className="bi bi-check-circle-fill me-2" aria-hidden="true" />
                                Selecionar <kbd className="ms-1">S</kbd>
                              </button>
                            )}
                            <button
                              className="btn btn-danger btn-lg px-4"
                              disabled={decidir.isPending}
                              onClick={() => setExcluindo({ ...SEM_EXCLUSAO, motivo: so_exclusao ? 'DUPLICADO' : '' })}
                            >
                              <i className="bi bi-x-circle-fill me-2" aria-hidden="true" />
                              Excluir <kbd className="ms-1">E</kbd>
                            </button>
                            <span className="small text-secondary ms-auto">↑/↓ navegam pela lista</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

type Conflito = {
  revisaoDocumentoId: string;
  titulo: string;
  autores: string | null;
  ano: number | null;
  resumo: string | null;
  decisoes: {
    decisao: string;
    motivo: string | null;
    observacao: string | null;
    decididoEm: string;
    revisorNome: string;
  }[];
};

/** RF30/UC09: o orientador vê as duas decisões e desempata */
function Conflitos({
  etapaId,
  revisaoId,
  criterios,
}: {
  etapaId: string;
  revisaoId: string;
  criterios: { id: string; nome: string }[];
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['etapa', etapaId, 'conflitos'],
    queryFn: () => get<Conflito[]>(`/etapas/${etapaId}/conflitos`),
  });
  const [form, setForm] = useState<Record<string, Exclusao>>({});
  const [erro, setErro] = useState<string | null>(null);
  const resolver = useMutation({
    mutationFn: ({ rdId, corpo }: { rdId: string; corpo: ReturnType<typeof corpoDecisao> }) =>
      put(`/etapas/${etapaId}/conflitos/${rdId}`, corpo),
    onSuccess: () => {
      setErro(null);
      qc.invalidateQueries({ queryKey: ['etapa', etapaId] });
      qc.invalidateQueries({ queryKey: chaveEtapas(revisaoId) });
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  });
  if (q.isLoading) return <Carregando />;
  if (!q.data?.length) return <Vazio icone="bi-check2-all">Nenhum conflito aberto.</Vazio>;
  return (
    <div className="d-grid gap-3">
      {erro && <ErroAlerta erro={erro} />}
      {q.data.map((c) => {
        const f = form[c.revisaoDocumentoId] ?? SEM_EXCLUSAO;
        const setF = (v: Exclusao) => setForm({ ...form, [c.revisaoDocumentoId]: v });
        return (
          <div className="card" key={c.revisaoDocumentoId}>
            <div className="card-body">
              <h4 className="h6">{c.titulo}</h4>
              <div className="small text-secondary mb-2">{[c.autores, c.ano].filter(Boolean).join(' · ')}</div>
              {c.resumo && <p className="small k-leitura">{c.resumo}</p>}
              <div className="row g-2 mb-3">
                {c.decisoes.map((d, i) => (
                  <div className="col-md-6" key={i}>
                    <div className="border rounded p-2 small">
                      <strong>{d.revisorNome}</strong> · {dataHora(d.decididoEm)}
                      <div>
                        <Situacao valor={d.decisao} /> {d.motivo && rotulo(d.motivo)}
                      </div>
                      {d.observacao && <div className="text-secondary">{d.observacao}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-start">
                <button
                  className="btn btn-success"
                  disabled={resolver.isPending}
                  onClick={() => resolver.mutate({ rdId: c.revisaoDocumentoId, corpo: corpoDecisao('SELECIONADO') })}
                >
                  Selecionar
                </button>
                <select
                  className="form-select w-auto"
                  aria-label="Motivo da exclusão"
                  value={f.motivo}
                  onChange={(e) => setF({ ...f, motivo: e.target.value as MotivoExclusao })}
                >
                  <option value="">Excluir por…</option>
                  {MOTIVOS.map((m) => (
                    <option key={m} value={m}>
                      {rotulo(m)}
                    </option>
                  ))}
                </select>
                {f.motivo === 'CRITERIO' && (
                  <select
                    className="form-select w-auto"
                    aria-label="Critério"
                    value={f.criterioId}
                    onChange={(e) => setF({ ...f, criterioId: e.target.value })}
                  >
                    <option value="">Critério…</option>
                    {criterios.map((cr) => (
                      <option key={cr.id} value={cr.id}>
                        {cr.nome}
                      </option>
                    ))}
                  </select>
                )}
                {f.motivo === 'OUTRO' && (
                  <input
                    className="form-control w-auto"
                    placeholder="Motivo"
                    aria-label="Descreva o motivo"
                    value={f.observacao}
                    onChange={(e) => setF({ ...f, observacao: e.target.value })}
                  />
                )}
                <button
                  className="btn btn-danger"
                  disabled={resolver.isPending || !f.motivo}
                  onClick={() => {
                    const falta = validarExclusao(f);
                    if (falta) return setErro(falta);
                    resolver.mutate({ rdId: c.revisaoDocumentoId, corpo: corpoDecisao('EXCLUIDO', f) });
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
