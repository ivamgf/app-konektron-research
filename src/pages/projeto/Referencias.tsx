import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post } from '../../lib/api';
import { BotaoConfirmar, Carregando, ErroAlerta, Modal, Vazio } from '../../components/ui';
import { useProjetoAtual } from './ProjetoLayout';

/** Normas de referência que o projeto guarda (uma coluna por norma na API) */
export const NORMAS = [
  {
    chave: 'abnt',
    curto: 'ABNT NBR 6023',
    nome: 'ABNT NBR 6023',
    exemplo: 'SOBRENOME, Nome. Título: subtítulo. Periódico, v. 1, n. 2, p. 10-20, 2024.',
  },
  {
    chave: 'apa',
    curto: 'APA',
    nome: 'APA (7ª edição)',
    exemplo: 'Sobrenome, N. (2024). Título do artigo. Periódico, 1(2), 10–20. https://doi.org/…',
  },
  {
    chave: 'mla',
    curto: 'MLA',
    nome: 'MLA (9ª edição)',
    exemplo: 'Sobrenome, Nome. “Título do artigo.” Periódico, vol. 1, no. 2, 2024, pp. 10–20.',
  },
  {
    chave: 'chicago',
    curto: 'Chicago',
    nome: 'Chicago (17ª edição, autor-data)',
    exemplo: 'Sobrenome, Nome. 2024. “Título do artigo.” Periódico 1 (2): 10–20. https://doi.org/…',
  },
  {
    chave: 'vancouver',
    curto: 'Vancouver',
    nome: 'Vancouver (ICMJE)',
    exemplo: 'Sobrenome AB, Sobrenome C. Título do artigo. Periódico. 2024;1(2):10-20. doi:…',
    numerada: true,
  },
  {
    chave: 'ieee',
    curto: 'IEEE',
    nome: 'IEEE',
    exemplo: 'A. B. Sobrenome and C. Sobrenome, “Título do artigo,” Periódico, vol. 1, no. 2, pp. 10–20, 2024.',
    numerada: true,
  },
] as const;
export type ChaveNorma = (typeof NORMAS)[number]['chave'];
const CHAVES = NORMAS.map((n) => n.chave);
const normaDe = (c: ChaveNorma) => NORMAS.find((n) => n.chave === c)!;

export type Referencia = {
  id: string;
  documentoId: string | null;
  documentoTitulo?: string | null;
  observacao: string | null;
} & Partial<Record<ChaveNorma, string | null>>;
type Visao = ChaveNorma | 'todas';

export const chaveReferencias = (projetoId: string) => ['projeto', projetoId, 'referencias'] as const;

/** Primeiro texto disponível da referência, na ordem das normas */
const qualquerTexto = (r: Referencia) => CHAVES.map((c) => r[c]?.trim()).find(Boolean) ?? '';

/** Lista de uma norma em ordem alfabética, sem as referências que não têm texto nela */
export function listaDaNorma(refs: Referencia[], norma: ChaveNorma) {
  return refs
    .map((r) => r[norma]?.trim())
    .filter((t): t is string => !!t)
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

/** Vancouver e IEEE são numeradas ("1." e "[1]"); as demais saem como lista simples */
export function textosParaExportar(refs: Referencia[], norma: ChaveNorma) {
  const lista = listaDaNorma(refs, norma);
  if (norma === 'ieee') return lista.map((t, i) => `[${i + 1}] ${t}`);
  if (norma === 'vancouver') return lista.map((t, i) => `${i + 1}. ${t}`);
  return lista;
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function baixarDoc(titulo: string, itens: string[], nome: string) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escHtml(titulo)}</title>
<style>body{font-family:'Times New Roman',serif;font-size:12pt}h1{font-size:12pt;text-align:center;font-weight:bold}p{margin:0 0 12pt;line-height:1.0;text-align:left}</style></head>
<body><h1>REFERÊNCIAS</h1>${itens.map((t) => `<p>${escHtml(t)}</p>`).join('')}</body></html>`;
  const url = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/msword' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Referências do projeto em ABNT NBR 6023, APA, MLA, Chicago, Vancouver e IEEE: cadastro, importação, cópia e download */
export default function Referencias() {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: chaveReferencias(projeto.id),
    queryFn: () => get<Referencia[]>(`/projetos/${projeto.id}/referencias`),
  });
  const [visao, setVisao] = useState<Visao>('abnt');
  const [form, setForm] = useState<Partial<Referencia> | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const refs = useMemo(() => q.data ?? [], [q.data]);
  const atualizar = () => qc.invalidateQueries({ queryKey: chaveReferencias(projeto.id) });

  const importar = useMutation({
    mutationFn: (fonte: 'INCLUIDOS' | 'TODOS') =>
      post<{ importadas: number; jaExistiam: number; completadas?: number }>(
        `/projetos/${projeto.id}/referencias/importar`,
        { fonte },
      ),
    onSuccess: (r) => {
      const partes = [];
      if (r.importadas) partes.push(`${r.importadas} referência(s) trazida(s) dos documentos`);
      if (r.completadas) partes.push(`${r.completadas} completada(s) nas normas que faltavam`);
      if (r.jaExistiam && !r.completadas) partes.push(`${r.jaExistiam} já estavam na lista`);
      setAviso(
        r.importadas || r.completadas
          ? `${partes.join(' · ')}.`
          : 'Nenhuma referência nova: os documentos já estão na lista.',
      );
      atualizar();
    },
  });

  const copiar = async (n: ChaveNorma) => {
    await navigator.clipboard.writeText(textosParaExportar(refs, n).join('\n\n'));
    setAviso(`Lista em ${normaDe(n).nome} copiada.`);
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div className="me-auto">
          <h2 className="h5 mb-0">Referências</h2>
          <div className="small text-secondary">
            Referências da pesquisa em ABNT NBR 6023, APA, MLA, Chicago, Vancouver e IEEE. As listas em ABNT NBR 6023 e
            APA entram no PDF do protocolo e do projeto.
          </div>
        </div>
        <div className="btn-group btn-group-sm flex-wrap" role="group" aria-label="Norma">
          {[...NORMAS.map((n) => [n.chave, n.curto] as const), ['todas', 'Todas'] as const].map(([chave, texto]) => (
            <button
              key={chave}
              type="button"
              className={`btn ${visao === chave ? 'btn-primary' : 'btn-outline-primary'}`}
              aria-pressed={visao === chave}
              onClick={() => setVisao(chave)}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {edita && (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({})}>
              <i className="bi bi-plus-lg me-1" aria-hidden="true" />
              Nova referência
            </button>
            <div className="btn-group btn-group-sm" role="group" aria-label="Trazer referências dos documentos">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={importar.isPending}
                title="Documentos incluídos nas revisões do projeto (também completa as normas em branco)"
                onClick={() => importar.mutate('INCLUIDOS')}
              >
                <i className="bi bi-box-arrow-in-down me-1" aria-hidden="true" />
                Trazer dos incluídos
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={importar.isPending}
                title="Todos os documentos cadastrados no projeto (também completa as normas em branco)"
                onClick={() => importar.mutate('TODOS')}
              >
                De todos os documentos
              </button>
            </div>
          </>
        )}
        {visao !== 'todas' ? (
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={!refs.length}
              onClick={() => copiar(visao)}
            >
              <i className="bi bi-clipboard me-1" aria-hidden="true" />
              Copiar {normaDe(visao).curto}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={!refs.length}
              onClick={() =>
                baixarDoc(
                  `Referências — ${normaDe(visao).nome}`,
                  textosParaExportar(refs, visao),
                  `referencias-${visao}.doc`,
                )
              }
            >
              <i className="bi bi-file-earmark-word me-1" aria-hidden="true" />
              Word
            </button>
          </div>
        ) : (
          <span className="small text-secondary align-self-center">
            Escolha uma norma para copiar a lista ou baixar em Word.
          </span>
        )}
      </div>

      {aviso && (
        <div className="alert alert-success small py-2" role="status">
          {aviso}
        </div>
      )}
      <ErroAlerta erro={q.error ?? importar.error} />
      {q.isLoading && <Carregando />}
      {q.data && !refs.length && (
        <Vazio icone="bi-bookmarks">
          Nenhuma referência ainda. Cadastre uma nova ou traga as referências dos documentos do projeto.
        </Vazio>
      )}

      {refs.length > 0 && visao !== 'todas' && (
        <ol className="list-group list-group-numbered" aria-label={`Referências em ${normaDe(visao).nome}`}>
          {[...refs]
            .sort((a, b) =>
              (a[visao] || qualquerTexto(a)).localeCompare(b[visao] || qualquerTexto(b), 'pt-BR', {
                sensitivity: 'base',
              }),
            )
            .map((r) => (
              <li key={r.id} className="list-group-item d-flex gap-2 align-items-start">
                <div className="ms-1 me-auto k-leitura">
                  {r[visao] || (
                    <span className="text-secondary fst-italic">
                      Sem texto em {normaDe(visao).curto} — {qualquerTexto(r)}
                    </span>
                  )}
                  <Origem r={r} />
                </div>
                {edita && (
                  <AcoesReferencia r={r} aoEditar={() => setForm(r)} aoExcluir={atualizar} projetoId={projeto.id} />
                )}
              </li>
            ))}
        </ol>
      )}

      {refs.length > 0 && visao === 'todas' && (
        <ul className="list-group" aria-label="Referências em todas as normas">
          {refs.map((r) => (
            <li key={r.id} className="list-group-item">
              <div className="d-flex gap-2 align-items-start">
                <dl className="row small mb-0 me-auto flex-grow-1">
                  {NORMAS.map((n) => (
                    <Fragment key={n.chave}>
                      <dt className="col-sm-3 col-lg-2 fw-medium text-secondary">{n.curto}</dt>
                      <dd className="col-sm-9 col-lg-10 k-leitura mb-1">
                        {r[n.chave] || <span className="text-secondary">—</span>}
                      </dd>
                    </Fragment>
                  ))}
                </dl>
                {edita && (
                  <AcoesReferencia r={r} aoEditar={() => setForm(r)} aoExcluir={atualizar} projetoId={projeto.id} />
                )}
              </div>
              <Origem r={r} />
            </li>
          ))}
        </ul>
      )}

      <Modal
        titulo={form?.id ? 'Editar referência' : 'Nova referência'}
        aberto={!!form}
        aoFechar={() => setForm(null)}
        tamanho="lg"
      >
        {form && (
          <FormReferencia
            projetoId={projeto.id}
            inicial={form}
            aoSalvar={() => {
              setForm(null);
              atualizar();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function Origem({ r }: { r: Referencia }) {
  if (!r.documentoTitulo && !r.observacao) return null;
  return (
    <div className="small text-secondary mt-1">
      {r.documentoTitulo && (
        <span>
          <i className="bi bi-link-45deg" aria-hidden="true" /> do documento “{r.documentoTitulo}”
        </span>
      )}
      {r.observacao && <span className="ms-2">{r.observacao}</span>}
    </div>
  );
}

function AcoesReferencia({
  r,
  aoEditar,
  aoExcluir,
  projetoId,
}: {
  r: Referencia;
  aoEditar: () => void;
  aoExcluir: () => void;
  projetoId: string;
}) {
  const resumo = qualquerTexto(r).slice(0, 80);
  return (
    <span className="d-inline-flex gap-1">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        title="Editar referência"
        aria-label={`Editar referência ${resumo}`}
        onClick={aoEditar}
      >
        <i className="bi bi-pencil" aria-hidden="true" />
      </button>
      <BotaoConfirmar
        titulo={`Excluir referência ${resumo}`}
        pergunta="Excluir esta referência da lista do projeto? O documento de origem, se houver, continua no projeto."
        aoConfirmar={() => del(`/projetos/${projetoId}/referencias/${r.id}`).then(aoExcluir)}
      >
        <i className="bi bi-trash" aria-hidden="true" />
      </BotaoConfirmar>
    </span>
  );
}

function FormReferencia({
  projetoId,
  inicial,
  aoSalvar,
}: {
  projetoId: string;
  inicial: Partial<Referencia>;
  aoSalvar: () => void;
}) {
  const [textos, setTextos] = useState<Record<ChaveNorma, string>>(
    () => Object.fromEntries(CHAVES.map((c) => [c, inicial[c] ?? ''])) as Record<ChaveNorma, string>,
  );
  const [observacao, setObservacao] = useState(inicial.observacao ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        ...Object.fromEntries(CHAVES.map((c) => [c, textos[c].trim() || null])),
        observacao: observacao.trim() || null,
      };
      return inicial.id
        ? patch(`/projetos/${projetoId}/referencias/${inicial.id}`, corpo)
        : post(`/projetos/${projetoId}/referencias`, corpo);
    },
    onSuccess: aoSalvar,
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!CHAVES.some((c) => textos[c].trim())) return setErro('Informe a referência em pelo menos uma norma.');
        setErro(null);
        salvar.mutate();
      }}
    >
      <p className="small text-secondary">
        Preencha as normas que a pesquisa usa. As que ficarem em branco podem ser geradas depois em “Trazer dos
        incluídos”, quando a referência veio de um documento do projeto.
      </p>
      {NORMAS.map((n) => (
        <div className="mb-3" key={n.chave}>
          <label htmlFor={`ref-${n.chave}`} className="form-label fw-medium">
            {n.nome}
          </label>
          <textarea
            id={`ref-${n.chave}`}
            className="form-control"
            rows={2}
            placeholder={n.exemplo}
            value={textos[n.chave]}
            onChange={(e) => setTextos({ ...textos, [n.chave]: e.target.value })}
          />
        </div>
      ))}
      <div className="mb-3">
        <label htmlFor="ref-obs" className="form-label">
          Observação (opcional)
        </label>
        <input
          id="ref-obs"
          className="form-control"
          maxLength={500}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
      </div>
      {(erro || salvar.error) && <ErroAlerta erro={erro ?? salvar.error} />}
      <div className="d-flex justify-content-end gap-2">
        <button type="submit" className="btn btn-primary" disabled={salvar.isPending}>
          Salvar
        </button>
      </div>
    </form>
  );
}
