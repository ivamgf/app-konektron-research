import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post } from '../../lib/api';
import { BotaoConfirmar, Carregando, ErroAlerta, Modal, Vazio } from '../../components/ui';
import { useProjetoAtual } from './ProjetoLayout';

export type Referencia = {
  id: string;
  documentoId: string | null;
  documentoTitulo?: string | null;
  abnt: string | null;
  apa: string | null;
  observacao: string | null;
};
type Norma = 'abnt' | 'apa' | 'ambas';

const NOMES = { abnt: 'ABNT (NBR 6023)', apa: 'APA (7ª edição)' } as const;
export const chaveReferencias = (projetoId: string) => ['projeto', projetoId, 'referencias'] as const;

/** Lista de uma norma em ordem alfabética, sem as referências que não têm texto nela */
export function listaDaNorma(refs: Referencia[], norma: 'abnt' | 'apa') {
  return refs
    .map((r) => r[norma]?.trim())
    .filter((t): t is string => !!t)
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
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

/** Referências do projeto em ABNT e APA: cadastro manual, importação dos documentos, cópia e download */
export default function Referencias() {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: chaveReferencias(projeto.id),
    queryFn: () => get<Referencia[]>(`/projetos/${projeto.id}/referencias`),
  });
  const [norma, setNorma] = useState<Norma>('abnt');
  const [form, setForm] = useState<Partial<Referencia> | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const refs = useMemo(() => q.data ?? [], [q.data]);
  const atualizar = () => qc.invalidateQueries({ queryKey: chaveReferencias(projeto.id) });

  const importar = useMutation({
    mutationFn: (fonte: 'INCLUIDOS' | 'TODOS') =>
      post<{ importadas: number; jaExistiam: number }>(`/projetos/${projeto.id}/referencias/importar`, { fonte }),
    onSuccess: (r) => {
      setAviso(
        r.importadas
          ? `${r.importadas} referência(s) trazida(s) dos documentos${r.jaExistiam ? ` · ${r.jaExistiam} já estavam na lista` : ''}.`
          : 'Nenhuma referência nova: os documentos já estão na lista.',
      );
      atualizar();
    },
  });
  const copiar = async (n: 'abnt' | 'apa') => {
    await navigator.clipboard.writeText(listaDaNorma(refs, n).join('\n\n'));
    setAviso(`Lista em ${NOMES[n]} copiada.`);
  };

  const normas: ('abnt' | 'apa')[] = norma === 'ambas' ? ['abnt', 'apa'] : [norma];

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div className="me-auto">
          <h2 className="h5 mb-0">Referências</h2>
          <div className="small text-secondary">
            Referências da pesquisa em ABNT (NBR 6023) e APA (7ª edição). Entram no PDF do protocolo e do projeto.
          </div>
        </div>
        <div className="btn-group btn-group-sm" role="group" aria-label="Norma">
          {(['abnt', 'apa', 'ambas'] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`btn ${norma === n ? 'btn-primary' : 'btn-outline-primary'}`}
              aria-pressed={norma === n}
              onClick={() => setNorma(n)}
            >
              {n === 'abnt' ? 'ABNT' : n === 'apa' ? 'APA' : 'ABNT e APA'}
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
                title="Documentos incluídos nas revisões do projeto"
                onClick={() => importar.mutate('INCLUIDOS')}
              >
                <i className="bi bi-box-arrow-in-down me-1" aria-hidden="true" />
                Trazer dos incluídos
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={importar.isPending}
                title="Todos os documentos cadastrados no projeto"
                onClick={() => importar.mutate('TODOS')}
              >
                De todos os documentos
              </button>
            </div>
          </>
        )}
        {normas.map((n) => (
          <div key={n} className="btn-group btn-group-sm">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={!refs.length}
              onClick={() => copiar(n)}
            >
              <i className="bi bi-clipboard me-1" aria-hidden="true" />
              Copiar {n.toUpperCase()}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={!refs.length}
              onClick={() => baixarDoc(`Referências — ${NOMES[n]}`, listaDaNorma(refs, n), `referencias-${n}.doc`)}
            >
              <i className="bi bi-file-earmark-word me-1" aria-hidden="true" />
              Word
            </button>
          </div>
        ))}
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

      {refs.length > 0 && norma !== 'ambas' && (
        <ol className="list-group list-group-numbered" aria-label={`Referências em ${NOMES[norma]}`}>
          {[...refs]
            .sort((a, b) =>
              (a[norma] ?? a.abnt ?? a.apa ?? '').localeCompare(b[norma] ?? b.abnt ?? b.apa ?? '', 'pt-BR', {
                sensitivity: 'base',
              }),
            )
            .map((r) => (
              <li key={r.id} className="list-group-item d-flex gap-2 align-items-start">
                <div className="ms-1 me-auto k-leitura">
                  {r[norma] || (
                    <span className="text-secondary fst-italic">
                      Sem texto em {norma.toUpperCase()} — {r.abnt || r.apa}
                    </span>
                  )}
                  {(r.documentoTitulo || r.observacao) && (
                    <div className="small text-secondary mt-1">
                      {r.documentoTitulo && (
                        <span>
                          <i className="bi bi-link-45deg" aria-hidden="true" /> do documento “{r.documentoTitulo}”
                        </span>
                      )}
                      {r.observacao && <span className="ms-2">{r.observacao}</span>}
                    </div>
                  )}
                </div>
                {edita && (
                  <AcoesReferencia r={r} aoEditar={() => setForm(r)} aoExcluir={atualizar} projetoId={projeto.id} />
                )}
              </li>
            ))}
        </ol>
      )}

      {refs.length > 0 && norma === 'ambas' && (
        <div className="table-responsive">
          <table className="table table-sm align-top small">
            <thead>
              <tr>
                <th style={{ width: '48%' }}>ABNT (NBR 6023)</th>
                <th style={{ width: '48%' }}>APA (7ª edição)</th>
                {edita && <th className="text-end">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {refs.map((r) => (
                <tr key={r.id}>
                  <td>{r.abnt || <span className="text-secondary">—</span>}</td>
                  <td>{r.apa || <span className="text-secondary">—</span>}</td>
                  {edita && (
                    <td className="text-end text-nowrap">
                      <AcoesReferencia r={r} aoEditar={() => setForm(r)} aoExcluir={atualizar} projetoId={projeto.id} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const resumo = (r.abnt || r.apa || '').slice(0, 80);
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
  const [abnt, setAbnt] = useState(inicial.abnt ?? '');
  const [apa, setApa] = useState(inicial.apa ?? '');
  const [observacao, setObservacao] = useState(inicial.observacao ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { abnt: abnt.trim() || null, apa: apa.trim() || null, observacao: observacao.trim() || null };
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
        if (!abnt.trim() && !apa.trim()) return setErro('Informe a referência em ABNT, em APA ou nas duas.');
        setErro(null);
        salvar.mutate();
      }}
    >
      <div className="mb-3">
        <label htmlFor="ref-abnt" className="form-label fw-medium">
          ABNT (NBR 6023)
        </label>
        <textarea
          id="ref-abnt"
          className="form-control"
          rows={3}
          placeholder="SOBRENOME, Nome. Título: subtítulo. Periódico, v. 1, n. 2, p. 10-20, 2024."
          value={abnt}
          onChange={(e) => setAbnt(e.target.value)}
        />
      </div>
      <div className="mb-3">
        <label htmlFor="ref-apa" className="form-label fw-medium">
          APA (7ª edição)
        </label>
        <textarea
          id="ref-apa"
          className="form-control"
          rows={3}
          placeholder="Sobrenome, N. (2024). Título do artigo. Periódico, 1(2), 10–20. https://doi.org/…"
          value={apa}
          onChange={(e) => setApa(e.target.value)}
        />
      </div>
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
