import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, mensagemDeErro, patch, put } from '../../lib/api';
import { chaves, useProtocolo } from '../../lib/consultas';
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

type Resposta = {
  etapa: EtapaRevisao;
  /** a segunda decisão é exigida de fato (com um só membro que decide, não é) */
  doisRevisores?: boolean;
  contagens: ContagensEtapa;
  documentos: DocumentoTriagem[];
};
type RespostaLote = { decididos: number; ignorados: number; conflitos: number };
const FILTROS = [
  ['todos', 'Todos'],
  ['pendentes', 'Pendentes'],
  ['minhas-pendentes', 'Minhas pendentes'],
  ['aguardando', 'Aguardando 2º revisor'],
  ['selecionados', 'Selecionados'],
  ['excluidos', 'Excluídos'],
  ['conflitos', 'Conflitos'],
] as const;
const MOTIVOS: MotivoExclusao[] = ['CRITERIO', 'DUPLICADO', 'SEM_ACESSO', 'OUTRO'];
const SEM_EXCLUSAO: Exclusao = { motivo: '', criterioId: '', observacao: '' };

/** RN10: motivo da exclusão (e critério ou texto), usado para um documento ou para os marcados */
function FormExclusao({
  valor,
  aoMudar,
  motivos,
  criterios,
  prefixo,
}: {
  valor: Exclusao;
  aoMudar: (v: Exclusao) => void;
  motivos: MotivoExclusao[];
  criterios: { id: string; nome: string }[];
  prefixo: string;
}) {
  return (
    <>
      <fieldset>
        <legend className="fs-6 fw-medium">Motivo da exclusão (RN10)</legend>
        {motivos.map((m) => (
          <div className="form-check form-check-inline" key={m}>
            <input
              className="form-check-input"
              type="radio"
              name={`${prefixo}-motivo`}
              id={`${prefixo}-motivo-${m}`}
              checked={valor.motivo === m}
              onChange={() => aoMudar({ ...valor, motivo: m })}
            />
            <label className="form-check-label" htmlFor={`${prefixo}-motivo-${m}`}>
              {rotulo(m)}
            </label>
          </div>
        ))}
      </fieldset>
      {valor.motivo === 'CRITERIO' && (
        <select
          className="form-select form-select-sm mt-2"
          aria-label="Critério de exclusão"
          value={valor.criterioId}
          onChange={(e) => aoMudar({ ...valor, criterioId: e.target.value })}
        >
          <option value="">Escolha o critério…</option>
          {criterios.map((cr) => (
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
        placeholder={valor.motivo === 'OUTRO' ? 'Descreva o motivo (obrigatório)' : 'Observação (opcional)'}
        value={valor.observacao}
        onChange={(e) => aoMudar({ ...valor, observacao: e.target.value })}
      />
    </>
  );
}

/** UC08: lista de documentos + painel de leitura, botões grandes Selecionar/Excluir, atalhos S e E e decisão em lote */
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
  // decisão em lote: documentos marcados na lista
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [excluindoLote, setExcluindoLote] = useState<Exclusao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const docs = useMemo(() => q.data?.documentos ?? [], [q.data]);
  const atual = docs.find((d) => d.revisaoDocumentoId === atualId) ?? null;
  const dois = q.data?.doisRevisores ?? revisao.doisRevisores;
  const so_exclusao = !etapa.exigeTriagem && etapa.permiteExclusao; // ex.: remoção de duplicados
  // decisões podem ser corrigidas também depois de a etapa ser concluída
  const podeDecidir = edita && (etapa.status === 'EM_ANDAMENTO' || etapa.status === 'CONCLUIDA');
  const criteriosExclusao = (protocolo.data?.criterios ?? []).filter((c) => c.tipo === 'EXCLUSAO');
  const motivos = so_exclusao ? (['DUPLICADO', 'OUTRO'] as MotivoExclusao[]) : MOTIVOS;
  const podeDesempatar = dois && (papel === 'ORIENTADOR' || papel === 'RESPONSAVEL' || papel === 'ADMIN');
  const visiveisMarcados = docs.filter((d) => marcados.has(d.revisaoDocumentoId));

  // abre no primeiro pendente (ou no primeiro da lista)
  useEffect(() => {
    if (!docs.length) return setAtualId(null);
    if (atualId && docs.some((d) => d.revisaoDocumentoId === atualId)) return;
    setAtualId((docs.find((d) => pendenteParaMim(d, dois)) ?? docs[0]).revisaoDocumentoId);
  }, [docs, atualId, dois]);

  // ao trocar de filtro, a marcação recomeça
  useEffect(() => {
    setMarcados(new Set());
    setExcluindoLote(null);
  }, [filtro]);

  const atualizarListas = () => {
    qc.invalidateQueries({ queryKey: ['etapa', etapa.id] });
    qc.invalidateQueries({ queryKey: chaveEtapas(revisao.id) });
  };

  const decidir = useMutation({
    mutationFn: (corpo: ReturnType<typeof corpoDecisao>) =>
      put<{ contagens: ContagensEtapa }>(`/etapas/${etapa.id}/documentos/${atualId}/decisao`, corpo),
    onSuccess: () => {
      setErro(null);
      setAviso(null);
      setExcluindo(null);
      const proximo = proximoPendente(docs, atualId, dois);
      atualizarListas();
      if (proximo) setAtualId(proximo);
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  });

  const decidirLote = useMutation({
    mutationFn: (corpo: ReturnType<typeof corpoDecisao>) =>
      put<RespostaLote>(`/etapas/${etapa.id}/decisoes`, {
        ...corpo,
        ids: visiveisMarcados.map((d) => d.revisaoDocumentoId),
      }),
    onSuccess: (r, corpo) => {
      setErro(null);
      setExcluindoLote(null);
      setMarcados(new Set());
      setAviso(
        `${r.decididos} documento(s) ${corpo.decisao === 'EXCLUIDO' ? 'excluído(s)' : 'selecionado(s)'}` +
          (r.ignorados ? ` · ${r.ignorados} ignorado(s) por não estarem elegíveis nesta etapa` : '') +
          (r.conflitos ? ` · ${r.conflitos} conflito(s) com o outro revisor` : ''),
      );
      atualizarListas();
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  });

  // RN12: a revisão com dois revisores pode passar a um revisor só (as decisões gravadas viram finais)
  const umRevisor = useMutation({
    mutationFn: () => patch(`/revisoes/${revisao.id}`, { doisRevisores: false }),
    onSuccess: () => {
      setErro(null);
      setAviso('A revisão passou a ter um revisor: as decisões já registradas valem como finais.');
      qc.invalidateQueries({ queryKey: chaves.revisao(revisao.id) });
      atualizarListas();
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
  const confirmarExclusaoLote = () => {
    const falta = validarExclusao(excluindoLote!);
    if (falta) return setErro(falta);
    decidirLote.mutate(corpoDecisao('EXCLUIDO', excluindoLote!));
  };
  const marcar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const todosMarcados = docs.length > 0 && visiveisMarcados.length === docs.length;

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
            {c.aguardandoRevisor ? ` · ${c.aguardandoRevisor} aguardando o 2º revisor` : ''}
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
            {FILTROS.filter(([v]) => dois || (v !== 'minhas-pendentes' && v !== 'aguardando')).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {!!c?.aguardandoRevisor && dois && (
        <div className="alert alert-warning small d-flex flex-wrap align-items-center gap-2" role="alert">
          <div className="me-auto">
            <strong>{c.aguardandoRevisor} documento(s)</strong> têm a decisão de um revisor e aguardam a do segundo — a
            revisão está configurada com <strong>dois revisores</strong> (RN12), por isso aparecem sem decisão final e a
            etapa não pode ser concluída.
          </div>
          <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => setFiltro('aguardando')}>
            Ver os que aguardam
          </button>
          {papel === 'RESPONSAVEL' && (
            <button
              type="button"
              className="btn btn-warning btn-sm"
              disabled={umRevisor.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Passar a revisão para um revisor só? As decisões já registradas passam a valer como finais.',
                  )
                )
                  umRevisor.mutate();
              }}
            >
              Usar um revisor só
            </button>
          )}
        </div>
      )}
      {aviso && (
        <div className="alert alert-success small py-2" role="status">
          {aviso}
        </div>
      )}

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
                {podeDecidir && (
                  <div className="border rounded p-2 mb-2 small">
                    <div className="form-check mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="marcar-todos"
                        checked={todosMarcados}
                        onChange={() =>
                          setMarcados(todosMarcados ? new Set() : new Set(docs.map((d) => d.revisaoDocumentoId)))
                        }
                      />
                      <label className="form-check-label" htmlFor="marcar-todos">
                        Marcar todos deste filtro ({docs.length})
                      </label>
                    </div>
                    {visiveisMarcados.length > 0 && (
                      <div className="mt-2" aria-label="Decisão em lote">
                        <div className="fw-medium mb-1">{visiveisMarcados.length} marcado(s)</div>
                        {excluindoLote ? (
                          <div>
                            <FormExclusao
                              valor={excluindoLote}
                              aoMudar={setExcluindoLote}
                              motivos={motivos}
                              criterios={criteriosExclusao}
                              prefixo="lote"
                            />
                            <div className="d-flex gap-2 mt-2">
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={decidirLote.isPending}
                                onClick={confirmarExclusaoLote}
                              >
                                Excluir {visiveisMarcados.length} pelo mesmo motivo
                              </button>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => (setExcluindoLote(null), setErro(null))}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="d-flex flex-wrap gap-2">
                            {!so_exclusao && (
                              <button
                                className="btn btn-success btn-sm"
                                disabled={decidirLote.isPending}
                                onClick={() => decidirLote.mutate(corpoDecisao('SELECIONADO'))}
                              >
                                Selecionar marcados
                              </button>
                            )}
                            {so_exclusao && (
                              <button
                                className="btn btn-outline-success btn-sm"
                                disabled={decidirLote.isPending}
                                onClick={() => decidirLote.mutate(corpoDecisao('SELECIONADO'))}
                              >
                                Desfazer exclusão dos marcados
                              </button>
                            )}
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={decidirLote.isPending}
                              onClick={() =>
                                setExcluindoLote({ ...SEM_EXCLUSAO, motivo: so_exclusao ? 'DUPLICADO' : '' })
                              }
                            >
                              Excluir marcados…
                            </button>
                            <button className="btn btn-link btn-sm" onClick={() => setMarcados(new Set())}>
                              Desmarcar
                            </button>
                          </div>
                        )}
                        {erro && excluindoLote && <div className="alert alert-danger py-1 small mt-2 mb-0">{erro}</div>}
                      </div>
                    )}
                  </div>
                )}
                <div className="list-group k-lista" role="listbox" aria-label="Documentos da etapa">
                  {docs.map((d) => (
                    <div
                      key={d.revisaoDocumentoId}
                      className={`list-group-item d-flex gap-2 align-items-start p-0 ${d.revisaoDocumentoId === atualId ? 'active' : ''}`}
                    >
                      {podeDecidir && (
                        <input
                          className="form-check-input ms-2 mt-3 flex-shrink-0"
                          type="checkbox"
                          aria-label={`Marcar ${d.titulo}`}
                          checked={marcados.has(d.revisaoDocumentoId)}
                          onChange={() => marcar(d.revisaoDocumentoId)}
                        />
                      )}
                      <button
                        type="button"
                        role="option"
                        aria-selected={d.revisaoDocumentoId === atualId}
                        className="btn text-start flex-grow-1 border-0 rounded-0 py-2 px-2"
                        style={{ color: 'inherit', minWidth: 0 }}
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
                          ) : dois && d.minhaDecisao ? (
                            <span className="badge text-bg-warning">Aguardando 2º revisor</span>
                          ) : (
                            <Situacao valor="PENDENTE" texto="Sem decisão" />
                          )}
                          {dois && d.minhaDecisao && (
                            <span className="small text-secondary">você: {rotulo(d.minhaDecisao)}</span>
                          )}
                          <span className="small text-secondary ms-auto">{d.ano ?? ''}</span>
                        </div>
                      </button>
                    </div>
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
                        {erro && !excluindoLote && <div className="alert alert-danger py-2 small">{erro}</div>}
                        {excluindo ? (
                          <div>
                            <FormExclusao
                              valor={excluindo}
                              aoMudar={setExcluindo}
                              motivos={motivos}
                              criterios={criteriosExclusao}
                              prefixo="um"
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
