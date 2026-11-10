import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, del, get, patch, post } from '../../lib/api';
import { useBases, useIdiomas, useTemas, useTiposDocumento } from '../../lib/consultas';
import { rotulo } from '../../lib/formato';
import type { Documento, DocumentoResumo, Pagina } from '../../lib/tipos';
import { BotaoConfirmar, Carregando, ErroAlerta, Modal, Paginacao, Situacao, Vazio } from '../../components/ui';
import { BotaoCompletarDados } from '../../components/CompletarDados';
import { useProjetoAtual } from './ProjetoLayout';

export default function Documentos() {
  const { projeto, edita } = useProjetoAtual();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [termo, setTermo] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('-criadoEm');
  const [form, setForm] = useState<Partial<Documento> | null>(null);
  const aberto = params.get('doc');
  const lista = useQuery({
    queryKey: ['projeto', projeto.id, 'documentos', page, q, sort],
    queryFn: () =>
      get<Pagina<DocumentoResumo>>(`/projetos/${projeto.id}/documentos`, {
        page,
        pageSize: 25,
        sort,
        q: q || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <form
          className="input-group"
          style={{ maxWidth: 420 }}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(termo.trim());
          }}
        >
          <input
            className="form-control"
            placeholder="Buscar em título, resumo e palavras-chave"
            aria-label="Buscar documentos"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
          <button className="btn btn-outline-primary" aria-label="Buscar">
            <i className="bi bi-search" aria-hidden="true" />
          </button>
        </form>
        <select
          className="form-select w-auto"
          aria-label="Ordenar por"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="-criadoEm">Mais recentes</option>
          <option value="titulo">Título (A–Z)</option>
          <option value="-ano">Ano (mais novos)</option>
          <option value="-citacoes">Mais citados</option>
        </select>
        {edita && (
          <BotaoCompletarDados
            url={`/projetos/${projeto.id}/documentos/completar`}
            className="btn btn-outline-primary"
          />
        )}
        {edita && (
          <button className="btn btn-primary ms-auto" onClick={() => setForm({})}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Novo documento
          </button>
        )}
      </div>

      {lista.isLoading && <Carregando />}
      <ErroAlerta erro={lista.error} />
      {lista.data?.itens.length === 0 && (
        <Vazio icone="bi-file-earmark-text">
          {q ? `Nada encontrado para “${q}”.` : 'Nenhum documento no projeto.'}
        </Vazio>
      )}
      {!!lista.data?.itens.length && (
        <>
          <p className="small text-secondary mb-2">
            <i className="bi bi-exclamation-circle text-danger me-1" aria-hidden="true" />
            Títulos em <span className="k-incompleto fw-medium">vermelho</span>: cadastro incompleto (sem resumo ou sem
            palavras-chave).
          </p>
          <div className="table-responsive">
            <table className="table table-hover align-middle small">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Resumo e palavras-chave</th>
                  <th>Autores</th>
                  <th>Ano</th>
                  <th>Periódico</th>
                  <th className="text-center">PDF</th>
                </tr>
              </thead>
              <tbody>
                {lista.data.itens.map((d) => (
                  <LinhaDocumento key={d.id} d={d} aoAbrir={() => setParams({ doc: d.id })} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {lista.data && (
        <Paginacao page={lista.data.page} pageSize={lista.data.pageSize} total={lista.data.total} aoMudar={setPage} />
      )}

      {aberto && (
        <DetalheDocumento
          id={aberto}
          edita={edita}
          aoFechar={() => setParams({})}
          aoEditar={(d) => {
            setParams({});
            setForm(d);
          }}
        />
      )}
      <Modal
        titulo={form?.id ? 'Editar documento' : 'Novo documento'}
        aberto={!!form}
        aoFechar={() => setForm(null)}
        tamanho="lg"
      >
        {form && (
          <FormDocumento
            inicial={form}
            projetoId={projeto.id}
            aoSalvar={(d) => (setForm(null), setParams({ doc: d.id }))}
          />
        )}
      </Modal>
    </>
  );
}

/** Cadastro incompleto: sem resumo ou sem palavras-chave */
export const cadastroIncompleto = (d: Pick<DocumentoResumo, 'resumo' | 'palavrasChave'>) =>
  !d.resumo?.trim() || !d.palavrasChave?.trim();

/** Linha da lista: botões "Ver resumo" e "Ver palavras-chave" abrem o texto logo abaixo */
function LinhaDocumento({ d, aoAbrir }: { d: DocumentoResumo; aoAbrir: () => void }) {
  const [ver, setVer] = useState<'resumo' | 'palavrasChave' | null>(null);
  const incompleto = cadastroIncompleto(d);
  const temResumo = !!d.resumo?.trim();
  const temPalavras = !!d.palavrasChave?.trim();
  const alternar = (e: React.MouseEvent, qual: 'resumo' | 'palavrasChave') => {
    e.stopPropagation();
    setVer(ver === qual ? null : qual);
  };
  const idTexto = `doc-${d.id}-${ver ?? 'texto'}`;
  return (
    <>
      <tr className="cursor-pointer" onClick={aoAbrir}>
        <td>
          <button
            type="button"
            className={`btn btn-link p-0 text-start ${incompleto ? 'k-incompleto' : ''}`}
            onClick={(e) => (e.stopPropagation(), aoAbrir())}
          >
            {incompleto && <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />}
            {d.titulo}
            {incompleto && <span className="visually-hidden"> (cadastro incompleto)</span>}
          </button>
          {d.doi && <div className="k-mono text-secondary">{d.doi}</div>}
        </td>
        <td style={{ minWidth: 200 }}>
          <div className="d-flex flex-wrap gap-1">
            {temResumo ? (
              <button
                type="button"
                className={`btn btn-sm py-0 ${ver === 'resumo' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                aria-expanded={ver === 'resumo'}
                aria-controls={ver === 'resumo' ? idTexto : undefined}
                onClick={(e) => alternar(e, 'resumo')}
              >
                Ver resumo
              </button>
            ) : (
              <span className="badge text-bg-danger">Sem resumo</span>
            )}
            {temPalavras ? (
              <button
                type="button"
                className={`btn btn-sm py-0 ${ver === 'palavrasChave' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                aria-expanded={ver === 'palavrasChave'}
                aria-controls={ver === 'palavrasChave' ? idTexto : undefined}
                onClick={(e) => alternar(e, 'palavrasChave')}
              >
                Ver palavras-chave
              </button>
            ) : (
              <span className="badge text-bg-danger">Sem palavras-chave</span>
            )}
          </div>
        </td>
        <td className="text-truncate" style={{ maxWidth: 220 }}>
          {d.autores ?? '—'}
        </td>
        <td>{d.ano ?? '—'}</td>
        <td className="text-truncate" style={{ maxWidth: 180 }}>
          {d.periodico ?? '—'}
        </td>
        <td className="text-center">
          {d.arquivoId ? <i className="bi bi-file-earmark-pdf text-danger" role="img" aria-label="Com PDF" /> : '—'}
        </td>
      </tr>
      {ver && (
        <tr className="table-light">
          <td colSpan={6} id={idTexto}>
            <div className="k-label text-secondary">{ver === 'resumo' ? 'Resumo' : 'Palavras-chave'}</div>
            <p className="small k-leitura mb-0">{ver === 'resumo' ? d.resumo : d.palavrasChave}</p>
          </td>
        </tr>
      )}
    </>
  );
}

export async function abrirPdf(documentoId: string) {
  const r = await get<{ url: string } | null>(`/documentos/${documentoId}/arquivo`);
  if (r?.url) window.open(r.url, '_blank', 'noopener');
}

function DetalheDocumento({
  id,
  edita,
  aoFechar,
  aoEditar,
}: {
  id: string;
  edita: boolean;
  aoFechar: () => void;
  aoEditar: (d: Documento) => void;
}) {
  const qc = useQueryClient();
  const d = useQuery({ queryKey: ['documento', id], queryFn: () => get<Documento>(`/documentos/${id}`) });
  const [erro, setErro] = useState<unknown>(null);
  const atualizar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['documento', id] }),
      qc.invalidateQueries({ queryKey: ['projeto'] }),
    ]);
  const referencias = useMutation({
    mutationFn: () => post(`/documentos/${id}/referencias`),
    onSuccess: atualizar,
    onError: setErro,
  });
  const completar = useMutation({
    mutationFn: () => post<{ preenchidos: string[]; fontes: string[] }>(`/documentos/${id}/completar`),
    onSuccess: atualizar,
    onError: setErro,
  });
  const anexar = useMutation({
    mutationFn: (arquivo: File) => {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      return api.post(`/documentos/${id}/arquivo`, fd);
    },
    onSuccess: atualizar,
    onError: setErro,
  });
  const doc = d.data;
  return (
    <Modal titulo="Documento" aberto aoFechar={aoFechar} tamanho="lg">
      {d.isLoading && <Carregando />}
      <ErroAlerta erro={d.error ?? erro} />
      {doc && (
        <>
          <h3 className="h5">{doc.titulo}</h3>
          <div className="small text-secondary mb-3">
            {[doc.autores, doc.periodico, doc.ano].filter(Boolean).join(' · ')}
            {doc.doi && (
              <>
                {' · '}
                <a href={`https://doi.org/${doc.doi}`} target="_blank" rel="noreferrer" className="k-mono">
                  {doc.doi}
                  <span className="visually-hidden"> (abre em nova aba)</span>
                </a>
              </>
            )}
          </div>
          {doc.resumo ? (
            <p className="small k-leitura">{doc.resumo}</p>
          ) : (
            <p className="small k-incompleto fw-medium">
              <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
              Sem resumo (cadastro incompleto).
            </p>
          )}
          {doc.palavrasChave ? (
            <p className="small">
              <strong>Palavras-chave:</strong> {doc.palavrasChave}
            </p>
          ) : (
            <p className="small k-incompleto fw-medium">
              <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
              Sem palavras-chave (cadastro incompleto).
            </p>
          )}
          {!!doc.temas?.length && (
            <div className="mb-3">
              {doc.temas.map((t) => (
                <span key={t.id} className="badge text-bg-light border me-1">
                  {t.nome}
                </span>
              ))}
            </div>
          )}
          <div className="card bg-body-tertiary border-0 mb-3">
            <div className="card-body small">
              <div className="k-label text-secondary">ABNT NBR 6023</div>
              <p>{doc.refNbr ?? '—'}</p>
              <div className="k-label text-secondary">APA 7ª ed.</div>
              <p className="mb-0">{doc.refApa ?? '—'}</p>
            </div>
          </div>
          {!!doc.revisoes?.length && (
            <div className="small mb-3">
              <strong>Nas revisões:</strong>{' '}
              {doc.revisoes.map((r) => (
                <span key={r.id} className="me-2">
                  {r.revisaoTitulo} <Situacao valor={r.situacao} />{' '}
                  <span className="text-secondary">({rotulo(r.origem)})</span>
                </span>
              ))}
            </div>
          )}
          <div className="d-flex flex-wrap gap-2">
            {doc.arquivoId && (
              <button className="btn btn-outline-danger btn-sm" onClick={() => abrirPdf(doc.id).catch(setErro)}>
                <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
                Abrir PDF
              </button>
            )}
            {edita && (
              <>
                <label className="btn btn-outline-secondary btn-sm mb-0">
                  <i className="bi bi-paperclip me-1" aria-hidden="true" />
                  {anexar.isPending ? 'Enviando…' : doc.arquivoId ? 'Trocar PDF' : 'Anexar PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="d-none"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 50 * 1024 * 1024) setErro('O PDF passa de 50 MB (RN18).');
                      else anexar.mutate(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={referencias.isPending}
                  onClick={() => referencias.mutate()}
                >
                  <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
                  Gerar referências de novo
                </button>
                {(!doc.resumo || !doc.palavrasChave || !doc.doi) && (
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={completar.isPending}
                    onClick={() => completar.mutate()}
                    title="Busca na web só os campos em branco (resumo, palavras-chave, DOI, ano, autores, periódico)"
                  >
                    {completar.isPending ? (
                      <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                    ) : (
                      <i className="bi bi-cloud-download me-1" aria-hidden="true" />
                    )}
                    Completar da web
                  </button>
                )}
                {completar.data && (
                  <span className="small text-secondary align-self-center" role="status">
                    {completar.data.preenchidos.length
                      ? `Preenchido: ${completar.data.preenchidos.length} campo(s) (${completar.data.fontes.join(', ')})`
                      : 'Nada encontrado nas fontes abertas'}
                  </span>
                )}
                <button className="btn btn-outline-primary btn-sm" onClick={() => aoEditar(doc)}>
                  <i className="bi bi-pencil me-1" aria-hidden="true" />
                  Editar
                </button>
                <BotaoConfirmar
                  pergunta="Excluir este documento? Documentos com decisões de triagem não podem ser excluídos."
                  aoConfirmar={async () => {
                    await del(`/documentos/${doc.id}`);
                    await qc.invalidateQueries({ queryKey: ['projeto'] });
                    aoFechar();
                  }}
                >
                  <i className="bi bi-trash me-1" aria-hidden="true" />
                  Excluir
                </BotaoConfirmar>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

const vazioParaNull = (v: string) => (v.trim() === '' ? null : v.trim());
const numero = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/** RF26: cadastro manual com todos os metadados; referências em branco são geradas pela API (RF27) */
export function FormDocumento({
  inicial,
  projetoId,
  aoSalvar,
}: {
  inicial: Partial<Documento>;
  projetoId: string;
  aoSalvar: (d: Documento) => void;
}) {
  const qc = useQueryClient();
  const bases = useBases();
  const idiomas = useIdiomas();
  const tipos = useTiposDocumento();
  const temas = useTemas(projetoId);
  const [v, setV] = useState(() => ({
    titulo: inicial.titulo ?? '',
    autores: inicial.autores ?? '',
    resumo: inicial.resumo ?? '',
    palavrasChave: inicial.palavrasChave ?? '',
    ano: inicial.ano?.toString() ?? '',
    periodico: inicial.periodico ?? '',
    fatorImpacto: inicial.fatorImpacto?.toString() ?? '',
    idiomaId: inicial.idiomaId?.toString() ?? '',
    tipoDocumentoId: inicial.tipoDocumentoId?.toString() ?? '',
    baseDadosId: inicial.baseDadosId ?? '',
    link: inicial.link ?? '',
    doi: inicial.doi ?? '',
    citacoes: inicial.citacoes?.toString() ?? '',
    refNbr: inicial.refNbr ?? '',
    refApa: inicial.refApa ?? '',
    temaIds: inicial.temas?.map((t) => t.id) ?? [],
  }));
  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        titulo: v.titulo.trim(),
        autores: vazioParaNull(v.autores),
        resumo: vazioParaNull(v.resumo),
        palavrasChave: vazioParaNull(v.palavrasChave),
        ano: numero(v.ano),
        periodico: vazioParaNull(v.periodico),
        fatorImpacto: numero(v.fatorImpacto),
        idiomaId: numero(v.idiomaId),
        tipoDocumentoId: numero(v.tipoDocumentoId),
        baseDadosId: v.baseDadosId || null,
        link: vazioParaNull(v.link),
        doi: vazioParaNull(v.doi),
        citacoes: numero(v.citacoes),
        // referência não mexida não vai: assim a API a gera de novo se os metadados mudarem
        refNbr: v.refNbr !== (inicial.refNbr ?? '') ? vazioParaNull(v.refNbr) : undefined,
        refApa: v.refApa !== (inicial.refApa ?? '') ? vazioParaNull(v.refApa) : undefined,
        temaIds: v.temaIds,
      };
      return inicial.id
        ? patch<Documento>(`/documentos/${inicial.id}`, corpo)
        : post<Documento>(`/projetos/${projetoId}/documentos`, corpo);
    },
    onSuccess: async (d) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['projeto', projetoId] }),
        qc.invalidateQueries({ queryKey: ['documento', d.id] }),
      ]);
      aoSalvar(d);
    },
  });
  const set =
    (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setV({ ...v, [k]: e.target.value });
  const campo = (
    k: keyof typeof v,
    texto: string,
    col = 'col-md-6',
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className={col}>
      <label htmlFor={`doc-${k}`} className="form-label">
        {texto}
      </label>
      <input id={`doc-${k}`} className="form-control" value={v[k] as string} onChange={set(k)} {...extra} />
    </div>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <ErroAlerta erro={salvar.error} />
      <div className="row g-3">
        <div className="col-12">
          <label htmlFor="doc-titulo" className="form-label">
            Título *
          </label>
          <textarea id="doc-titulo" className="form-control" rows={2} value={v.titulo} onChange={set('titulo')} />
        </div>
        {campo('autores', 'Autores', 'col-12', { placeholder: 'SOBRENOME, Nome; SOBRENOME, Nome' })}
        <div className="col-12">
          <label htmlFor="doc-resumo" className="form-label">
            Resumo
          </label>
          <textarea id="doc-resumo" className="form-control" rows={4} value={v.resumo} onChange={set('resumo')} />
        </div>
        {campo('palavrasChave', 'Palavras-chave', 'col-12', { placeholder: 'separadas por ponto e vírgula' })}
        {campo('ano', 'Ano', 'col-md-3', { type: 'number', min: 1500, max: 2100 })}
        {campo('periodico', 'Periódico', 'col-md-6')}
        {campo('fatorImpacto', 'Fator de impacto', 'col-md-3', { inputMode: 'decimal' })}
        <div className="col-md-4">
          <label htmlFor="doc-idioma" className="form-label">
            Idioma
          </label>
          <select id="doc-idioma" className="form-select" value={v.idiomaId} onChange={set('idiomaId')}>
            <option value="">—</option>
            {idiomas.data?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label htmlFor="doc-tipo" className="form-label">
            Tipo de documento
          </label>
          <select id="doc-tipo" className="form-select" value={v.tipoDocumentoId} onChange={set('tipoDocumentoId')}>
            <option value="">—</option>
            {tipos.data?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label htmlFor="doc-base" className="form-label">
            Base de dados
          </label>
          <select id="doc-base" className="form-select" value={v.baseDadosId} onChange={set('baseDadosId')}>
            <option value="">—</option>
            {bases.data?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>
        {campo('doi', 'DOI', 'col-md-6', { className: 'form-control k-mono', placeholder: '10.xxxx/...' })}
        {campo('citacoes', 'Citações', 'col-md-6', { type: 'number', min: 0 })}
        {campo('link', 'Link', 'col-12', { type: 'url', placeholder: 'https://' })}
        {!!temas.data?.length && (
          <fieldset className="col-12">
            <legend className="form-label fs-6">Temas</legend>
            {temas.data.map((t) => (
              <div className="form-check form-check-inline" key={t.id}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`tema-${t.id}`}
                  checked={v.temaIds.includes(t.id)}
                  onChange={(e) =>
                    setV({
                      ...v,
                      temaIds: e.target.checked ? [...v.temaIds, t.id] : v.temaIds.filter((x) => x !== t.id),
                    })
                  }
                />
                <label className="form-check-label" htmlFor={`tema-${t.id}`}>
                  {t.nome}
                </label>
              </div>
            ))}
          </fieldset>
        )}
        <div className="col-12">
          <details>
            <summary className="small">Ajustar referências manualmente (em branco = geradas automaticamente)</summary>
            <label htmlFor="doc-nbr" className="form-label mt-2">
              ABNT NBR 6023
            </label>
            <textarea id="doc-nbr" className="form-control mb-2" rows={2} value={v.refNbr} onChange={set('refNbr')} />
            <label htmlFor="doc-apa" className="form-label">
              APA
            </label>
            <textarea id="doc-apa" className="form-control" rows={2} value={v.refApa} onChange={set('refApa')} />
          </details>
        </div>
      </div>
      <div className="text-end mt-4">
        <button className="btn btn-primary" disabled={!v.titulo.trim() || salvar.isPending}>
          Salvar
        </button>
      </div>
    </form>
  );
}
