import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post, put } from '../../lib/api';
import { chaves, useProtocolo } from '../../lib/consultas';
import type { Criterio } from '../../lib/tipos';
import { BotaoConfirmar, Carregando, ErroAlerta, Modal } from '../../components/ui';
import { useProjetoAtual } from './ProjetoLayout';

type Tipo = Criterio['tipo'];

/** RF10: critérios de inclusão e exclusão, com modelos pré-preenchidos */
export default function Criterios() {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const q = useProtocolo(projeto.id);
  const modelos = useQuery({
    queryKey: ['criterios-modelos', projeto.id],
    queryFn: () => get<string[]>(`/projetos/${projeto.id}/criterios/modelos`),
    staleTime: Infinity,
  });
  const [form, setForm] = useState<{ id?: string; tipo: Tipo; nome: string; descricao: string } | null>(null);
  const base = `/projetos/${projeto.id}/criterios`;
  const recarregar = () => qc.invalidateQueries({ queryKey: chaves.protocolo(projeto.id) });
  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { tipo: form!.tipo, nome: form!.nome.trim(), descricao: form!.descricao.trim() || null };
      return form!.id ? patch(`${base}/${form!.id}`, corpo) : post(base, corpo);
    },
    onSuccess: () => (setForm(null), recarregar()),
  });
  const ordenar = useMutation({ mutationFn: (ids: string[]) => put(`${base}/ordem`, { ids }), onSuccess: recarregar });

  if (q.isLoading) return <Carregando />;
  const todos = q.data?.criterios ?? [];
  const porTipo = (t: Tipo) => todos.filter((c) => c.tipo === t);

  const mover = (t: Tipo, i: number, d: number) => {
    const lista = porTipo(t).map((c) => c.id);
    [lista[i], lista[i + d]] = [lista[i + d], lista[i]];
    const outros = porTipo(t === 'INCLUSAO' ? 'EXCLUSAO' : 'INCLUSAO').map((c) => c.id);
    ordenar.mutate(t === 'INCLUSAO' ? [...lista, ...outros] : [...outros, ...lista]);
  };

  const secao = (t: Tipo, titulo: string) => {
    const lista = porTipo(t);
    return (
      <div className="col-lg-6">
        <div className="card h-100">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h2 className="h6 mb-0">{titulo}</h2>
            {edita && (
              <button className="btn btn-primary btn-sm" onClick={() => setForm({ tipo: t, nome: '', descricao: '' })}>
                <i className="bi bi-plus-lg me-1" aria-hidden="true" />
                Novo
              </button>
            )}
          </div>
          <ul className="list-group list-group-flush">
            {lista.length === 0 && <li className="list-group-item small text-secondary">Nenhum critério.</li>}
            {lista.map((c, i) => (
              <li key={c.id} className="list-group-item d-flex gap-2">
                <div className="flex-grow-1">
                  <div className="fw-medium">{c.nome}</div>
                  {c.descricao && <div className="small text-secondary">{c.descricao}</div>}
                </div>
                {edita && (
                  <div className="btn-group btn-group-sm align-self-start">
                    <button
                      className="btn btn-outline-secondary"
                      aria-label={`Subir ${c.nome}`}
                      disabled={i === 0}
                      onClick={() => mover(t, i, -1)}
                    >
                      <i className="bi bi-arrow-up" aria-hidden="true" />
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      aria-label={`Descer ${c.nome}`}
                      disabled={i === lista.length - 1}
                      onClick={() => mover(t, i, 1)}
                    >
                      <i className="bi bi-arrow-down" aria-hidden="true" />
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      aria-label={`Editar ${c.nome}`}
                      onClick={() => setForm({ id: c.id, tipo: c.tipo, nome: c.nome, descricao: c.descricao ?? '' })}
                    >
                      <i className="bi bi-pencil" aria-hidden="true" />
                    </button>
                    <BotaoConfirmar
                      className="btn btn-outline-danger"
                      titulo={`Excluir ${c.nome}`}
                      pergunta={`Excluir o critério "${c.nome}"?`}
                      aoConfirmar={async () => {
                        await del(`${base}/${c.id}`);
                        await recarregar();
                      }}
                    >
                      <i className="bi bi-trash" aria-hidden="true" />
                    </BotaoConfirmar>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <>
      <ErroAlerta erro={q.error ?? ordenar.error} />
      <div className="row g-4">
        {secao('INCLUSAO', 'Critérios de inclusão')}
        {secao('EXCLUSAO', 'Critérios de exclusão')}
      </div>

      <Modal
        titulo={
          form?.id ? 'Editar critério' : `Novo critério de ${form?.tipo === 'INCLUSAO' ? 'inclusão' : 'exclusão'}`
        }
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
            {!form.id && (
              <div className="mb-3">
                <div className="form-label small">Modelos</div>
                <div className="d-flex flex-wrap gap-1">
                  {modelos.data?.map((m) => (
                    <button
                      type="button"
                      key={m}
                      className={`btn btn-sm ${form.nome === m ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setForm({ ...form, nome: m })}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-3">
              <label htmlFor="tipoCriterio" className="form-label">
                Tipo
              </label>
              <select
                id="tipoCriterio"
                className="form-select"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })}
              >
                <option value="INCLUSAO">Inclusão</option>
                <option value="EXCLUSAO">Exclusão</option>
              </select>
            </div>
            <div className="mb-3">
              <label htmlFor="nomeCriterio" className="form-label">
                Nome
              </label>
              <input
                id="nomeCriterio"
                className="form-control"
                maxLength={100}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="descCriterio" className="form-label">
                Descrição
              </label>
              <textarea
                id="descCriterio"
                className="form-control"
                rows={3}
                placeholder="Ex.: publicações de 2015 a 2026"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
            <div className="text-end">
              <button className="btn btn-primary" disabled={!form.nome.trim() || salvar.isPending}>
                Salvar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
