import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post } from '../../lib/api';
import { useChecklists } from '../../lib/consultas';
import type { ItemChecklistModelo } from '../../lib/tipos';
import { BotaoConfirmar, Cabecalho, Carregando, ErroAlerta, Modal } from '../../components/ui';

type CampoCat = {
  nome: string;
  rotulo: string;
  tipo?: 'texto' | 'url' | 'booleano' | 'checklist' | 'textoLongo';
  obrigatorio?: boolean;
};
type Catalogo = { id: string; titulo: string; url: string; campos: CampoCat[]; colunas: string[]; excluir?: boolean };

// UC14: bases de dados, diretrizes (só nome, sigla, versão e link — RNF16), checklists, idiomas e tipos de documento
const CATALOGOS: Catalogo[] = [
  {
    id: 'bases',
    titulo: 'Bases de dados',
    url: '/bases-dados',
    colunas: ['nome', 'sigla', 'url', 'ativo'],
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
      { nome: 'sigla', rotulo: 'Sigla' },
      { nome: 'url', rotulo: 'Site', tipo: 'url' },
      { nome: 'ativo', rotulo: 'Ativa', tipo: 'booleano' },
    ],
  },
  {
    id: 'diretrizes',
    titulo: 'Diretrizes de relato',
    url: '/diretrizes',
    colunas: ['sigla', 'nome', 'versao', 'ativo'],
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
      { nome: 'sigla', rotulo: 'Sigla', obrigatorio: true },
      { nome: 'versao', rotulo: 'Versão' },
      { nome: 'urlOficial', rotulo: 'Link oficial', tipo: 'url' },
      { nome: 'checklistModeloId', rotulo: 'Checklist genérico sugerido', tipo: 'checklist' },
      { nome: 'ativo', rotulo: 'Ativa', tipo: 'booleano' },
    ],
  },
  {
    id: 'idiomas',
    titulo: 'Idiomas',
    url: '/idiomas',
    colunas: ['codigo', 'nome'],
    campos: [
      { nome: 'codigo', rotulo: 'Código', obrigatorio: true },
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
    ],
  },
  {
    id: 'tipos-documento',
    titulo: 'Tipos de documento',
    url: '/tipos-documento',
    colunas: ['nome'],
    campos: [{ nome: 'nome', rotulo: 'Nome', obrigatorio: true }],
  },
  {
    id: 'checklists',
    titulo: 'Checklists genéricos',
    url: '/checklists',
    excluir: false,
    colunas: ['nome', 'padrao', 'ativo'],
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textoLongo' },
      { nome: 'padrao', rotulo: 'Padrão do sistema', tipo: 'booleano' },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano' },
    ],
  },
];

const ROTULO_COLUNA: Record<string, string> = {
  nome: 'Nome',
  sigla: 'Sigla',
  url: 'Site',
  ativo: 'Ativo',
  versao: 'Versão',
  codigo: 'Código',
  padrao: 'Padrão',
};

export default function Catalogos() {
  const [aba, setAba] = useState(CATALOGOS[0].id);
  const cat = CATALOGOS.find((c) => c.id === aba)!;
  return (
    <>
      <Cabecalho titulo="Catálogos" subtitulo="Dados de referência usados em todos os projetos" />
      <ul className="nav nav-tabs mb-3">
        {CATALOGOS.map((c) => (
          <li className="nav-item" key={c.id}>
            <button className={`nav-link ${aba === c.id ? 'active' : ''}`} onClick={() => setAba(c.id)}>
              {c.titulo}
            </button>
          </li>
        ))}
      </ul>
      <EditorCatalogo key={cat.id} cat={cat} />
    </>
  );
}

function EditorCatalogo({ cat }: { cat: Catalogo }) {
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: [cat.url.slice(1)], queryFn: () => get<Record<string, any>[]>(cat.url) });
  const checklists = useChecklists();
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [itensDe, setItensDe] = useState<string | null>(null);
  const salvar = useMutation({
    mutationFn: () => {
      const corpo = Object.fromEntries(
        cat.campos.map((c) => {
          const v = form![c.nome];
          if (c.tipo === 'booleano') return [c.nome, !!v];
          return [c.nome, typeof v === 'string' ? v.trim() || null : (v ?? null)];
        }),
      );
      return form!.id ? patch(`${cat.url}/${form!.id}`, corpo) : post(cat.url, corpo);
    },
    onSuccess: () => {
      setForm(null);
      qc.invalidateQueries({ queryKey: [cat.url.slice(1)] });
    },
  });
  const celula = (v: unknown) =>
    typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : v == null || v === '' ? '—' : String(v);

  return (
    <>
      <div className="text-end mb-2">
        <button
          className="btn btn-primary btn-sm"
          onClick={() =>
            setForm(
              Object.fromEntries(cat.campos.map((c) => [c.nome, c.tipo === 'booleano' ? c.nome === 'ativo' : ''])),
            )
          }
        >
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Novo
        </button>
      </div>
      {lista.isLoading && <Carregando />}
      <ErroAlerta erro={lista.error} />
      {lista.data && (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                {cat.colunas.map((c) => (
                  <th key={c}>{ROTULO_COLUNA[c] ?? c}</th>
                ))}
                <th className="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.data.map((r) => (
                <tr key={r.id}>
                  {cat.colunas.map((c) => (
                    <td
                      key={c}
                      className={c === 'url' ? 'small text-truncate' : ''}
                      style={c === 'url' ? { maxWidth: 240 } : undefined}
                    >
                      {celula(r[c])}
                    </td>
                  ))}
                  <td className="text-end text-nowrap">
                    {cat.id === 'checklists' && (
                      <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => setItensDe(r.id)}>
                        Itens
                      </button>
                    )}
                    <button
                      className="btn btn-outline-primary btn-sm me-1"
                      aria-label={`Editar ${r.nome ?? r.sigla}`}
                      onClick={() => setForm({ ...r })}
                    >
                      <i className="bi bi-pencil" aria-hidden="true" />
                    </button>
                    {cat.excluir !== false && (
                      <BotaoConfirmar
                        titulo={`Excluir ${r.nome ?? r.sigla}`}
                        pergunta={`Excluir "${r.nome ?? r.sigla}"? Itens em uso não podem ser excluídos; desative-os.`}
                        aoConfirmar={async () => {
                          await del(`${cat.url}/${r.id}`);
                          await qc.invalidateQueries({ queryKey: [cat.url.slice(1)] });
                        }}
                      >
                        <i className="bi bi-trash" aria-hidden="true" />
                      </BotaoConfirmar>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        titulo={form?.id ? `Editar — ${cat.titulo}` : `Novo — ${cat.titulo}`}
        aberto={!!form}
        aoFechar={() => setForm(null)}
      >
        {form && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              salvar.mutate();
            }}
          >
            <ErroAlerta erro={salvar.error} />
            {cat.campos.map((c) => {
              const id = `cat-${c.nome}`;
              if (c.tipo === 'booleano')
                return (
                  <div className="form-check mb-2" key={c.nome}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={id}
                      checked={!!form[c.nome]}
                      onChange={(e) => setForm({ ...form, [c.nome]: e.target.checked })}
                    />
                    <label className="form-check-label" htmlFor={id}>
                      {c.rotulo}
                    </label>
                  </div>
                );
              return (
                <div className="mb-3" key={c.nome}>
                  <label htmlFor={id} className="form-label">
                    {c.rotulo}
                    {c.obrigatorio && ' *'}
                  </label>
                  {c.tipo === 'checklist' ? (
                    <select
                      id={id}
                      className="form-select"
                      value={form[c.nome] ?? ''}
                      onChange={(e) => setForm({ ...form, [c.nome]: e.target.value || null })}
                    >
                      <option value="">Nenhum</option>
                      {checklists.data?.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nome}
                        </option>
                      ))}
                    </select>
                  ) : c.tipo === 'textoLongo' ? (
                    <textarea
                      id={id}
                      className="form-control"
                      rows={3}
                      value={form[c.nome] ?? ''}
                      onChange={(e) => setForm({ ...form, [c.nome]: e.target.value })}
                    />
                  ) : (
                    <input
                      id={id}
                      type={c.tipo === 'url' ? 'url' : 'text'}
                      className="form-control"
                      value={form[c.nome] ?? ''}
                      onChange={(e) => setForm({ ...form, [c.nome]: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
            <div className="text-end">
              <button
                className="btn btn-primary"
                disabled={
                  cat.campos.some((c) => c.obrigatorio && !String(form[c.nome] ?? '').trim()) || salvar.isPending
                }
              >
                Salvar
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal titulo="Itens do checklist" aberto={!!itensDe} aoFechar={() => setItensDe(null)} tamanho="lg">
        {itensDe && <ItensChecklist checklistId={itensDe} />}
      </Modal>
    </>
  );
}

/** RF20: itens do checklist genérico (texto próprio do sistema, nunca de diretrizes de terceiros — RNF16) */
function ItensChecklist({ checklistId }: { checklistId: string }) {
  const qc = useQueryClient();
  const base = `/checklists/${checklistId}/itens`;
  const chave = ['checklist', checklistId, 'itens'];
  const q = useQuery({ queryKey: chave, queryFn: () => get<ItemChecklistModelo[]>(base) });
  const [f, setF] = useState<{ id?: string; codigo: string; secao: string; descricao: string } | null>(null);
  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { codigo: f!.codigo.trim(), secao: f!.secao.trim(), descricao: f!.descricao.trim() };
      return f!.id ? patch(`${base}/${f!.id}`, corpo) : post(base, corpo);
    },
    onSuccess: () => {
      setF(null);
      qc.invalidateQueries({ queryKey: chave });
    },
  });
  if (q.isLoading) return <Carregando />;
  return (
    <>
      <ErroAlerta erro={q.error} />
      <table className="table table-sm small align-middle">
        <tbody>
          {q.data?.map((i) => (
            <tr key={i.id}>
              <td className="k-mono">{i.codigo}</td>
              <td>{i.secao}</td>
              <td>{i.descricao}</td>
              <td className="text-end text-nowrap">
                <button
                  className="btn btn-link btn-sm"
                  aria-label={`Editar ${i.codigo}`}
                  onClick={() => setF({ ...i })}
                >
                  <i className="bi bi-pencil" aria-hidden="true" />
                </button>
                <BotaoConfirmar
                  className="btn btn-link btn-sm text-danger"
                  titulo={`Excluir ${i.codigo}`}
                  pergunta={`Excluir o item ${i.codigo}?`}
                  aoConfirmar={async () => {
                    await del(`${base}/${i.id}`);
                    await qc.invalidateQueries({ queryKey: chave });
                  }}
                >
                  <i className="bi bi-trash" aria-hidden="true" />
                </BotaoConfirmar>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {f ? (
        <form
          className="border rounded p-2"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <ErroAlerta erro={salvar.error} />
          <div className="row g-2">
            <div className="col-3">
              <input
                className="form-control form-control-sm k-mono"
                placeholder="CG25"
                aria-label="Código"
                maxLength={10}
                value={f.codigo}
                onChange={(e) => setF({ ...f, codigo: e.target.value })}
              />
            </div>
            <div className="col-9">
              <input
                className="form-control form-control-sm"
                placeholder="Seção"
                aria-label="Seção"
                maxLength={40}
                value={f.secao}
                onChange={(e) => setF({ ...f, secao: e.target.value })}
              />
            </div>
            <div className="col-12">
              <textarea
                className="form-control form-control-sm"
                rows={2}
                placeholder="Descrição do item"
                aria-label="Descrição"
                value={f.descricao}
                onChange={(e) => setF({ ...f, descricao: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-2 d-flex gap-2">
            <button
              className="btn btn-primary btn-sm"
              disabled={!f.codigo.trim() || !f.secao.trim() || !f.descricao.trim() || salvar.isPending}
            >
              Salvar
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setF(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={() => setF({ codigo: '', secao: '', descricao: '' })}
        >
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Novo item
        </button>
      )}
    </>
  );
}
