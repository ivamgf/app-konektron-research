import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, lerErro, mensagemDeErro, patch, post, put } from '../../lib/api';
import { chaves, useProtocolo } from '../../lib/consultas';
import { dataHora, rotulo } from '../../lib/formato';
import type {
  Analise as TAnalise,
  AnaliseDocumentoDetalhe,
  DocumentoDaAnalise,
  ItemDiscussao,
  ItemMatriz,
  Progresso,
} from '../../lib/tipos';
import {
  Abas,
  BotaoConfirmar,
  Carregando,
  ErroAlerta,
  IndicadorSalvo,
  Modal,
  PainelAba,
  Situacao,
  Vazio,
} from '../../components/ui';
import { BotaoTarefa } from '../../components/BotaoTarefa';
import { useProjetoAtual } from '../projeto/ProjetoLayout';
import { abrirPdf } from '../projeto/Documentos';
import { BotaoIA } from '../../components/IA';
import { SugerirRespostas, contextoDoDocumento } from './AnaliseIA';
import * as fila from './filaOffline';

const ABAS = [
  ['questoes', 'Questões'],
  ['matriz', 'Matriz de síntese'],
  ['discussao', 'Discussão'],
  ['consideracoes', 'Considerações e observações'],
] as const;

export default function Analise() {
  const { analiseId = '' } = useParams();
  const { projeto, edita, dono } = useProjetoAtual();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const lista = useQuery({
    queryKey: chaves.analises(projeto.id),
    queryFn: () => get<TAnalise[]>(`/projetos/${projeto.id}/analises`),
  });
  const analise = useQuery({
    queryKey: ['analise', analiseId],
    queryFn: () => get<TAnalise>(`/analises/${analiseId}`),
  });
  const docs = useQuery({
    queryKey: ['analise', analiseId, 'documentos'],
    queryFn: () => get<DocumentoDaAnalise[]>(`/analises/${analiseId}/documentos`),
  });
  const [comparar, setComparar] = useState(false);
  const [editarQuestoes, setEditarQuestoes] = useState(false);
  const docId = params.get('doc') ?? docs.data?.[0]?.documentoId ?? null;
  const aba = params.get('aba') ?? 'questoes';
  const irPara = (p: Record<string, string>) => setParams({ ...Object.fromEntries(params), ...p });

  const atualizarProgresso = useCallback(
    (documentoId: string, progresso: Progresso) =>
      qc.setQueryData<DocumentoDaAnalise[]>(['analise', analiseId, 'documentos'], (atual) =>
        atual?.map((d) => (d.documentoId === documentoId ? { ...d, progresso } : d)),
      ),
    [qc, analiseId],
  );

  if (analise.isLoading || docs.isLoading) return <Carregando />;
  if (analise.error || !analise.data) return <ErroAlerta erro={analise.error ?? 'Análise não encontrada'} />;
  const a = analise.data;
  const total = docs.data?.length ?? 0;
  const concluidos = docs.data?.filter((d) => d.progresso === 'CONCLUIDO').length ?? 0;

  return (
    <>
      {/* UC12 passo 1: seletor da análise no topo */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <label htmlFor="seletor-analise" className="visually-hidden">
          Análise
        </label>
        <select
          id="seletor-analise"
          className="form-select fw-bold"
          style={{ maxWidth: 420 }}
          value={analiseId}
          onChange={(e) => navegar(`../analises/${e.target.value}`)}
        >
          {(lista.data ?? [a]).map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <span className="badge text-bg-light border">{a.tipoNome}</span>
        <span className="small text-secondary">
          {concluidos}/{total} documentos concluídos · {a.questoes?.length ?? 0} questões
        </span>
        <div className="ms-auto d-flex flex-wrap gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setComparar(true)}>
            <i className="bi bi-layout-three-columns me-1" aria-hidden="true" />
            Comparar por questão
          </button>
          {edita && (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditarQuestoes(true)}>
              <i className="bi bi-ui-checks me-1" aria-hidden="true" />
              Questões da análise
            </button>
          )}
          <BotaoTarefa
            url={`/analises/${a.id}/exportar`}
            corpo={{ formato: 'xlsx' }}
            className="btn btn-outline-primary btn-sm"
            textoPronto="Baixar XLSX"
          >
            XLSX
          </BotaoTarefa>
          <BotaoTarefa
            url={`/analises/${a.id}/exportar`}
            corpo={{ formato: 'pdf' }}
            className="btn btn-outline-primary btn-sm"
            textoPronto="Abrir PDF"
          >
            PDF
          </BotaoTarefa>
          <BotaoTarefa
            url={`/analises/${a.id}/exportar`}
            corpo={{ formato: 'docx' }}
            className="btn btn-outline-primary btn-sm"
            textoPronto="Baixar DOCX"
          >
            DOCX
          </BotaoTarefa>
          {dono && (
            <BotaoConfirmar
              titulo="Excluir análise"
              pergunta={`Excluir a análise "${a.nome}" com todas as respostas, matriz e discussão?`}
              aoConfirmar={async () => {
                await del(`/analises/${a.id}`);
                await qc.invalidateQueries({ queryKey: chaves.analises(projeto.id) });
                navegar('../analises');
              }}
            >
              <i className="bi bi-trash" aria-hidden="true" />
            </BotaoConfirmar>
          )}
        </div>
      </div>

      {total === 0 ? (
        <Vazio icone="bi-file-earmark">
          A análise não tem documentos. Verifique a fonte escolhida (ex.: a revisão ainda não tem incluídos).
        </Vazio>
      ) : (
        <div className="row g-3">
          {/* lista de documentos à esquerda com progresso (UC12 passo 2) */}
          <div className="col-md-4 col-xl-3">
            <div className="list-group k-lista" aria-label="Documentos da análise">
              {docs.data?.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`list-group-item list-group-item-action ${d.documentoId === docId ? 'active' : ''}`}
                  aria-current={d.documentoId === docId ? 'true' : undefined}
                  onClick={() => irPara({ doc: d.documentoId })}
                >
                  <div className="small fw-medium text-truncate">{d.titulo}</div>
                  <div className="d-flex align-items-center gap-1 mt-1">
                    <Situacao valor={d.progresso} />
                    <span className="small text-secondary ms-auto">{d.ano ?? ''}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="col-md-8 col-xl-9">
            {docId && (
              <DocumentoEmAnalise
                key={docId}
                analise={a}
                documentoId={docId}
                aba={aba}
                setAba={(x) => irPara({ aba: x })}
                edita={edita}
                aoProgresso={(p) => atualizarProgresso(docId, p)}
              />
            )}
          </div>
        </div>
      )}

      <Modal
        titulo="Comparar respostas por questão (RF40)"
        aberto={comparar}
        aoFechar={() => setComparar(false)}
        tamanho="xl"
      >
        {comparar && <Comparativo analise={a} />}
      </Modal>
      <Modal
        titulo="Questões aplicadas nesta análise"
        aberto={editarQuestoes}
        aoFechar={() => setEditarQuestoes(false)}
      >
        {editarQuestoes && <EditarQuestoes analise={a} aoSalvar={() => setEditarQuestoes(false)} />}
      </Modal>
    </>
  );
}

type Estado = 'ocioso' | 'salvando' | 'salvo' | 'erro';

function DocumentoEmAnalise({
  analise,
  documentoId,
  aba,
  setAba,
  edita,
  aoProgresso,
}: {
  analise: TAnalise;
  documentoId: string;
  aba: string;
  setAba: (a: string) => void;
  edita: boolean;
  aoProgresso: (p: Progresso) => void;
}) {
  const url = `/analises/${analise.id}/documentos/${documentoId}`;
  const chaveFila = `${analise.id}:${documentoId}`;
  const q = useQuery({
    queryKey: ['analise', analise.id, 'doc', documentoId],
    queryFn: () => get<AnaliseDocumentoDetalhe>(url),
  });
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<{ resumoAssunto: string; consideracoes: string; observacoes: string }>({
    resumoAssunto: '',
    consideracoes: '',
    observacoes: '',
  });
  const [alteradas, setAlteradas] = useState<{ q: Set<string>; extras: Set<string> }>({
    q: new Set(),
    extras: new Set(),
  });
  const [estado, setEstado] = useState<Estado>('ocioso');
  const [offline, setOffline] = useState(() => !!fila.ler(chaveFila));
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [erroPdf, setErroPdf] = useState<unknown>(null);
  const carregado = useRef(false);
  const idAbas = useId();

  // preenche com o que veio da API e, por cima, o que ficou pendente offline
  useEffect(() => {
    if (!q.data || carregado.current) return;
    carregado.current = true;
    const r = Object.fromEntries(q.data.respostas.map((x) => [x.questaoAnaliseId, x.texto ?? '']));
    const pend = fila.ler(chaveFila);
    for (const x of pend?.corpo.respostas ?? []) r[x.questaoAnaliseId] = x.texto ?? '';
    setRespostas(r);
    setExtras({
      resumoAssunto: pend?.corpo.resumoAssunto ?? q.data.resumoAssunto ?? '',
      consideracoes: pend?.corpo.consideracoes ?? q.data.consideracoes ?? '',
      observacoes: pend?.corpo.observacoes ?? q.data.observacoes ?? '',
    });
  }, [q.data, chaveFila]);

  const enviar = useCallback(
    async (corpo: fila.Pendente['corpo']) => {
      setEstado('salvando');
      try {
        const r = await put<{ progresso: Progresso; salvoEm: string }>(`${url}/respostas`, corpo);
        fila.remover(chaveFila);
        setOffline(false);
        setEstado('salvo');
        setSalvoEm(r.salvoEm);
        aoProgresso(r.progresso);
      } catch (e) {
        if (!lerErro(e).status) {
          // sem conexão: guarda no navegador e tenta de novo quando voltar (UC12 4a)
          fila.guardar(chaveFila, { url: `${url}/respostas`, corpo, em: new Date().toISOString() });
          setOffline(true);
          setEstado('ocioso');
        } else setEstado('erro');
      }
    },
    [url, chaveFila, aoProgresso],
  );

  // salvamento automático 1 s depois da última digitação (RF39)
  useEffect(() => {
    if (!alteradas.q.size && !alteradas.extras.size) return;
    const t = setTimeout(() => {
      const corpo: fila.Pendente['corpo'] = {};
      if (alteradas.q.size)
        corpo.respostas = [...alteradas.q].map((id) => ({
          questaoAnaliseId: id,
          texto: respostas[id]?.trim() ? respostas[id] : null,
        }));
      if (alteradas.extras.has('resumoAssunto')) corpo.resumoAssunto = extras.resumoAssunto || null;
      if (alteradas.extras.has('consideracoes')) corpo.consideracoes = extras.consideracoes || null;
      if (alteradas.extras.has('observacoes')) corpo.observacoes = extras.observacoes || null;
      setAlteradas({ q: new Set(), extras: new Set() });
      enviar(corpo);
    }, 1000);
    return () => clearTimeout(t);
  }, [alteradas, respostas, extras, enviar]);

  // ao voltar a conexão, envia o que ficou pendente
  useEffect(() => {
    const voltar = () => {
      const p = fila.ler(chaveFila);
      if (p) enviar(p.corpo);
    };
    window.addEventListener('online', voltar);
    if (navigator.onLine) voltar();
    return () => window.removeEventListener('online', voltar);
  }, [chaveFila, enviar]);

  if (q.isLoading) return <Carregando />;
  if (q.error || !q.data) return <ErroAlerta erro={q.error ?? 'Documento não encontrado'} />;
  const d = q.data;
  const doc = d.documento;

  return (
    <div className="card">
      <div className="card-body pb-0">
        <div className="d-flex gap-2 align-items-start">
          <div className="me-auto">
            <h3 className="h5 mb-1">{doc.titulo}</h3>
            <div className="small text-secondary">
              {[doc.autores, doc.periodico, doc.ano].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="text-end text-nowrap">
            <IndicadorSalvo estado={estado} />
            {salvoEm && estado === 'salvo' && <div className="small text-secondary">{dataHora(salvoEm)}</div>}
            {offline && (
              <div className="small text-warning-emphasis" role="status">
                <i className="bi bi-wifi-off me-1" aria-hidden="true" />
                Sem conexão: guardado no navegador
              </div>
            )}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2 my-2">
          {doc.arquivoId && (
            <button className="btn btn-outline-danger btn-sm" onClick={() => abrirPdf(doc.id).catch(setErroPdf)}>
              <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
              Abrir PDF
            </button>
          )}
          {doc.doi && (
            <a
              className="btn btn-outline-secondary btn-sm k-mono"
              href={`https://doi.org/${doc.doi}`}
              target="_blank"
              rel="noreferrer"
            >
              {doc.doi}
              <span className="visually-hidden"> (abre em nova aba)</span>
            </a>
          )}
        </div>
        <ErroAlerta erro={erroPdf} />
        {doc.resumo && (
          <details className="small mb-2">
            <summary>Resumo</summary>
            <p className="k-leitura mt-2">{doc.resumo}</p>
          </details>
        )}
        {estado === 'erro' && <ErroAlerta erro="Não foi possível salvar. A próxima alteração tenta de novo." />}
        <Abas
          idBase={idAbas}
          abas={ABAS.map(([id, texto]) => ({
            id: id as string,
            texto: (
              <>
                {texto}
                {id === 'matriz' && d.matriz.length > 0 && (
                  <span className="badge text-bg-light border ms-1">{d.matriz.length}</span>
                )}
                {id === 'discussao' && d.discussao.length > 0 && (
                  <span className="badge text-bg-light border ms-1">{d.discussao.length}</span>
                )}
              </>
            ),
          }))}
          atual={aba}
          aoMudar={setAba}
          rotulo="Seções da análise do documento"
          className="nav nav-tabs mt-2"
        />
      </div>
      <PainelAba idBase={idAbas} atual={aba} className="card-body">
        {aba === 'questoes' && (
          <fieldset disabled={!edita}>
            <div className="mb-4 pb-3 border-bottom">
              <div className="d-flex align-items-end justify-content-between gap-2 mb-2">
                <label htmlFor={`assunto-${d.id}`} className="form-label fw-medium mb-0">
                  Resumo do assunto
                </label>
                <BotaoIA
                  campo="Resumo do assunto do documento"
                  orientacao="Resumo do assunto tratado no documento (problema, método, principais achados e conclusões), em 1 a 3 parágrafos, para servir de base às respostas das questões de análise. Use apenas o que consta nos dados do documento; não invente resultados."
                  contexto={() => contextoDoDocumento(doc, analise.questoes ?? [])}
                  valor={extras.resumoAssunto}
                  aoAplicar={(texto) => {
                    setExtras((x) => ({ ...x, resumoAssunto: texto }));
                    setAlteradas((a) => ({ ...a, extras: new Set(a.extras).add('resumoAssunto') }));
                  }}
                  projetoId={analise.projetoId}
                  desabilitado={!edita}
                />
              </div>
              <textarea
                id={`assunto-${d.id}`}
                className="form-control"
                rows={5}
                value={extras.resumoAssunto}
                aria-describedby={`assunto-ajuda-${d.id}`}
                onChange={(e) => {
                  setExtras({ ...extras, resumoAssunto: e.target.value });
                  setAlteradas((a) => ({ ...a, extras: new Set(a.extras).add('resumoAssunto') }));
                }}
              />
              <div id={`assunto-ajuda-${d.id}`} className="form-text">
                Escreva (ou gere com IA) o resumo do assunto antes de responder: a análise do documento reúne este
                resumo e as respostas às questões de pesquisa.
              </div>
            </div>
            {(analise.questoes ?? []).length === 0 && (
              <p className="text-secondary small">A análise não tem questões.</p>
            )}
            {edita && (analise.questoes ?? []).length > 0 && (
              <SugerirRespostas
                questoes={analise.questoes ?? []}
                respostas={respostas}
                contexto={() => contextoDoDocumento(doc, analise.questoes ?? [], extras.resumoAssunto)}
                projetoId={analise.projetoId}
                aoAplicar={(novas) => {
                  setRespostas((atual) => ({ ...atual, ...novas }));
                  setAlteradas((a) => ({ ...a, q: new Set([...a.q, ...Object.keys(novas)]) }));
                }}
              />
            )}
            {(analise.questoes ?? []).map((qa) => (
              <div className="mb-3" key={qa.id}>
                <div className="d-flex align-items-end justify-content-between gap-2 mb-2">
                  <label htmlFor={`qa-${qa.id}`} className="form-label mb-0">
                    <span className="k-mono fw-bold text-primary me-2">{qa.codigo}</span>
                    {qa.enunciado}
                  </label>
                  <BotaoIA
                    campo={`Resposta à questão ${qa.codigo}`}
                    orientacao={`Responda à questão de análise "${qa.enunciado}" com base apenas nos dados do documento e no resumo do assunto. Se o documento não traz a informação, diga isso claramente.`}
                    contexto={() => contextoDoDocumento(doc, [], extras.resumoAssunto)}
                    valor={respostas[qa.id] ?? ''}
                    aoAplicar={(texto) => {
                      setRespostas((atual) => ({ ...atual, [qa.id]: texto }));
                      setAlteradas((a) => ({ ...a, q: new Set(a.q).add(qa.id) }));
                    }}
                    projetoId={analise.projetoId}
                    desabilitado={!edita}
                  />
                </div>
                <textarea
                  id={`qa-${qa.id}`}
                  className="form-control"
                  rows={3}
                  value={respostas[qa.id] ?? ''}
                  onChange={(e) => {
                    setRespostas({ ...respostas, [qa.id]: e.target.value });
                    setAlteradas((a) => ({ ...a, q: new Set(a.q).add(qa.id) }));
                  }}
                />
              </div>
            ))}
          </fieldset>
        )}
        {aba === 'matriz' && (
          <ItensEditaveis<ItemMatriz>
            base={`/analise-documentos/${d.id}/matriz`}
            itens={d.matriz}
            chave={['analise', analise.id, 'doc', documentoId]}
            edita={edita}
            novo={{ citacao: '', textoOriginal: '', textoParafraseado: '', pagina: '' }}
            campos={[
              { nome: 'citacao', rotulo: 'Citação', linhas: 2 },
              { nome: 'pagina', rotulo: 'Página', linhas: 0 },
              { nome: 'textoOriginal', rotulo: 'Texto original', linhas: 3 },
              { nome: 'textoParafraseado', rotulo: 'Texto parafraseado', linhas: 3 },
            ]}
            textoAdicionar="Adicionar linha"
          />
        )}
        {aba === 'discussao' && (
          <ItensEditaveis<ItemDiscussao>
            base={`/analise-documentos/${d.id}/discussao`}
            itens={d.discussao}
            chave={['analise', analise.id, 'doc', documentoId]}
            edita={edita}
            novo={{ pontoPrincipal: '', discussao: '' }}
            campos={[
              { nome: 'pontoPrincipal', rotulo: 'Ponto principal', linhas: 2 },
              { nome: 'discussao', rotulo: 'Discussão', linhas: 4 },
            ]}
            textoAdicionar="Adicionar ponto"
          />
        )}
        {aba === 'consideracoes' && (
          <fieldset disabled={!edita}>
            {(['consideracoes', 'observacoes'] as const).map((k) => (
              <div className="mb-3" key={k}>
                <label htmlFor={`ex-${k}`} className="form-label">
                  {k === 'consideracoes' ? 'Considerações' : 'Observações'}
                </label>
                <textarea
                  id={`ex-${k}`}
                  className="form-control"
                  rows={5}
                  value={extras[k]}
                  onChange={(e) => {
                    setExtras({ ...extras, [k]: e.target.value });
                    setAlteradas((a) => ({ ...a, extras: new Set(a.extras).add(k) }));
                  }}
                />
              </div>
            ))}
          </fieldset>
        )}
      </PainelAba>
    </div>
  );
}

type Campo<T> = { nome: keyof T & string; rotulo: string; linhas: number };

/** Linhas da matriz de síntese e da discussão: cada linha salva ao sair do campo */
function ItensEditaveis<T extends { id: string; ordem: number }>({
  base,
  itens,
  chave,
  edita,
  novo,
  campos,
  textoAdicionar,
}: {
  base: string;
  itens: T[];
  chave: unknown[];
  edita: boolean;
  novo: Partial<Record<keyof T, string>>;
  campos: Campo<T>[];
  textoAdicionar: string;
}) {
  const qc = useQueryClient();
  const [rascunhos, setRascunhos] = useState<Record<string, Record<string, string>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = () => qc.invalidateQueries({ queryKey: chave });
  const criar = useMutation({
    mutationFn: () => post(base, Object.fromEntries(Object.entries(novo).map(([k, v]) => [k, v || null]))),
    onSuccess: recarregar,
    onError: (e) => setErro(mensagemDeErro(e)),
  });
  const salvar = useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Record<string, string | null> }) => patch(`${base}/${id}`, dados),
    onSuccess: (_r, v) => {
      setRascunhos(({ [v.id]: _x, ...resto }) => resto);
      recarregar();
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  });
  const ordenar = useMutation({ mutationFn: (ids: string[]) => put(`${base}/ordem`, { ids }), onSuccess: recarregar });

  return (
    <div>
      {erro && <ErroAlerta erro={erro} />}
      {itens.length === 0 && <p className="small text-secondary">Nenhuma linha.</p>}
      {itens.map((it, i) => {
        const r = rascunhos[it.id] ?? {};
        return (
          <div key={it.id} className="border rounded p-2 mb-2">
            <div className="d-flex align-items-center mb-1">
              <span className="badge text-bg-light border me-auto">{i + 1}</span>
              {edita && (
                <div className="btn-group btn-group-sm">
                  <button
                    className="btn btn-outline-secondary"
                    aria-label={`Subir linha ${i + 1}`}
                    disabled={i === 0}
                    onClick={() => {
                      const ids = itens.map((x) => x.id);
                      [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                      ordenar.mutate(ids);
                    }}
                  >
                    <i className="bi bi-arrow-up" aria-hidden="true" />
                  </button>
                  <BotaoConfirmar
                    className="btn btn-outline-danger"
                    titulo={`Excluir linha ${i + 1}`}
                    pergunta="Excluir esta linha?"
                    aoConfirmar={async () => {
                      await del(`${base}/${it.id}`);
                      await recarregar();
                    }}
                  >
                    <i className="bi bi-trash" aria-hidden="true" />
                  </BotaoConfirmar>
                </div>
              )}
            </div>
            <div className="row g-2">
              {campos.map((c) => {
                const valor = r[c.nome] ?? (it[c.nome] as string | null) ?? '';
                const props = {
                  id: `${it.id}-${c.nome}`,
                  className: 'form-control form-control-sm',
                  value: valor,
                  disabled: !edita,
                  onChange: (e: { target: { value: string } }) =>
                    setRascunhos({ ...rascunhos, [it.id]: { ...r, [c.nome]: e.target.value } }),
                  onBlur: () => {
                    const v = rascunhos[it.id]?.[c.nome];
                    if (v !== undefined && v !== ((it[c.nome] as string | null) ?? ''))
                      salvar.mutate({ id: it.id, dados: { [c.nome]: v.trim() || null } });
                  },
                };
                return (
                  <div className={c.linhas ? 'col-12' : 'col-sm-3'} key={c.nome}>
                    <label htmlFor={props.id} className="form-label small mb-0">
                      {c.rotulo}
                    </label>
                    {c.linhas ? <textarea rows={c.linhas} {...props} /> : <input {...props} maxLength={20} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {edita && (
        <button className="btn btn-outline-primary btn-sm" disabled={criar.isPending} onClick={() => criar.mutate()}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          {textoAdicionar}
        </button>
      )}
    </div>
  );
}

/** RF40: respostas de uma QA em todos os documentos */
function Comparativo({ analise }: { analise: TAnalise }) {
  const [qId, setQId] = useState(analise.questoes?.[0]?.id ?? '');
  const q = useQuery({
    queryKey: ['analise', analise.id, 'comparativo', qId],
    queryFn: () =>
      get<{ documentoId: string; titulo: string; autores: string | null; ano: number | null; texto: string | null }[]>(
        `/analises/${analise.id}/questoes/${qId}/comparativo`,
      ),
    enabled: !!qId,
  });
  const questao = analise.questoes?.find((x) => x.id === qId);
  return (
    <>
      <select className="form-select mb-2" aria-label="Questão" value={qId} onChange={(e) => setQId(e.target.value)}>
        {analise.questoes?.map((x) => (
          <option key={x.id} value={x.id}>
            {x.codigo} — {x.enunciado.slice(0, 120)}
          </option>
        ))}
      </select>
      {questao && <p className="small text-secondary">{questao.enunciado}</p>}
      {q.isLoading && <Carregando />}
      <ErroAlerta erro={q.error} />
      {q.data && (
        <table className="table table-sm small align-top">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Documento</th>
              <th>Resposta</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((r) => (
              <tr key={r.documentoId}>
                <td>
                  {r.titulo}
                  <div className="text-secondary">{[r.autores, r.ano].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="k-leitura">
                  {r.texto || <span className="text-secondary">{rotulo('NAO_INICIADO')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/** RF37: conjunto de questões da análise (todas do protocolo ou um subconjunto) */
function EditarQuestoes({ analise, aoSalvar }: { analise: TAnalise; aoSalvar: () => void }) {
  const { projeto } = useProjetoAtual();
  const qc = useQueryClient();
  const protocolo = useProtocolo(projeto.id);
  const [ids, setIds] = useState<string[]>(() => analise.questoes?.map((q) => q.id) ?? []);
  const salvar = useMutation({
    mutationFn: () => put(`/analises/${analise.id}/questoes`, { questaoIds: ids }),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['analise', analise.id] })]);
      aoSalvar();
    },
  });
  const todas = protocolo.data?.questoes ?? [];
  return (
    <>
      <ErroAlerta erro={salvar.error} />
      {todas.map((q) => (
        <div className="form-check" key={q.id}>
          <input
            className="form-check-input"
            type="checkbox"
            id={`eq-${q.id}`}
            checked={ids.includes(q.id)}
            onChange={(e) =>
              setIds(
                e.target.checked
                  ? [...todas.filter((x) => ids.includes(x.id) || x.id === q.id).map((x) => x.id)]
                  : ids.filter((x) => x !== q.id),
              )
            }
          />
          <label className="form-check-label" htmlFor={`eq-${q.id}`}>
            <span className="k-mono fw-bold me-1">{q.codigo}</span>
            {q.enunciado}
          </label>
        </div>
      ))}
      <div className="text-end mt-3">
        <button className="btn btn-primary" disabled={!ids.length || salvar.isPending} onClick={() => salvar.mutate()}>
          Salvar
        </button>
      </div>
    </>
  );
}
