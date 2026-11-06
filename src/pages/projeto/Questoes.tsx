import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { del, patch, post, put } from '../../lib/api';
import { chaves, useProtocolo } from '../../lib/consultas';
import type { QuestaoAnalise } from '../../lib/tipos';
import { BotaoConfirmar, Carregando, ErroAlerta, Vazio } from '../../components/ui';
import { useProjetoAtual } from './ProjetoLayout';

/** RF09/RN05: questões de análise QAn (código gerado em sequência pela API) */
export default function Questoes() {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const q = useProtocolo(projeto.id);
  const [novo, setNovo] = useState('');
  const [editando, setEditando] = useState<{ id: string; enunciado: string } | null>(null);
  const base = `/projetos/${projeto.id}/questoes`;
  const recarregar = () => qc.invalidateQueries({ queryKey: chaves.protocolo(projeto.id) });
  const criar = useMutation({
    mutationFn: () => post(base, { enunciado: novo.trim() }),
    onSuccess: () => (setNovo(''), recarregar()),
  });
  const salvar = useMutation({
    mutationFn: (d: Partial<QuestaoAnalise> & { id: string }) =>
      patch(`${base}/${d.id}`, { enunciado: d.enunciado, ativo: d.ativo }),
    onSuccess: () => (setEditando(null), recarregar()),
  });
  const ordenar = useMutation({ mutationFn: (ids: string[]) => put(`${base}/ordem`, { ids }), onSuccess: recarregar });
  const daOutras = useMutation({ mutationFn: () => post(`${base}/de-outras-questoes`, {}), onSuccess: recarregar });

  if (q.isLoading) return <Carregando />;
  const questoes = q.data?.questoes ?? [];
  const mover = (i: number, d: number) => {
    const ids = questoes.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    ordenar.mutate(ids);
  };

  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <h2 className="h5">Questões de análise</h2>
        <p className="small text-secondary">
          Aplicadas a cada documento nas análises. Renumerar não altera respostas já gravadas (RN05).
        </p>
        <ErroAlerta erro={q.error ?? criar.error ?? salvar.error ?? ordenar.error ?? daOutras.error} />
        {questoes.length === 0 && <Vazio icone="bi-question-circle">Nenhuma questão cadastrada.</Vazio>}
        <ul className="list-group">
          {questoes.map((x, i) => (
            <li key={x.id} className={`list-group-item d-flex gap-3 align-items-start ${x.ativo ? '' : 'opacity-50'}`}>
              <span className="k-mono fw-bold text-primary mt-1" style={{ minWidth: '3.5rem' }}>
                {x.codigo}
              </span>
              <div className="flex-grow-1">
                {editando?.id === x.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      salvar.mutate({ id: x.id, enunciado: editando.enunciado.trim() });
                    }}
                  >
                    <textarea
                      className="form-control mb-2"
                      rows={2}
                      aria-label={`Enunciado de ${x.codigo}`}
                      value={editando.enunciado}
                      onChange={(e) => setEditando({ ...editando, enunciado: e.target.value })}
                    />
                    <button
                      className="btn btn-primary btn-sm me-2"
                      disabled={!editando.enunciado.trim() || salvar.isPending}
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setEditando(null)}
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <>
                    {x.enunciado}
                    {!x.ativo && <span className="badge text-bg-secondary ms-2">Inativa</span>}
                  </>
                )}
              </div>
              {edita && editando?.id !== x.id && (
                <div className="btn-group btn-group-sm">
                  <button
                    className="btn btn-outline-secondary"
                    aria-label={`Subir ${x.codigo}`}
                    disabled={i === 0 || ordenar.isPending}
                    onClick={() => mover(i, -1)}
                  >
                    <i className="bi bi-arrow-up" aria-hidden="true" />
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    aria-label={`Descer ${x.codigo}`}
                    disabled={i === questoes.length - 1 || ordenar.isPending}
                    onClick={() => mover(i, 1)}
                  >
                    <i className="bi bi-arrow-down" aria-hidden="true" />
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    aria-label={`Editar ${x.codigo}`}
                    onClick={() => setEditando({ id: x.id, enunciado: x.enunciado })}
                  >
                    <i className="bi bi-pencil" aria-hidden="true" />
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    aria-label={x.ativo ? `Desativar ${x.codigo}` : `Ativar ${x.codigo}`}
                    title={x.ativo ? 'Desativar' : 'Ativar'}
                    onClick={() => salvar.mutate({ id: x.id, ativo: !x.ativo })}
                  >
                    <i className={`bi ${x.ativo ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                  </button>
                  <BotaoConfirmar
                    className="btn btn-outline-danger"
                    titulo={`Excluir ${x.codigo}`}
                    pergunta={`Excluir a questão ${x.codigo}? As respostas dela nas análises também serão removidas.`}
                    aoConfirmar={async () => {
                      await del(`${base}/${x.id}`);
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
      {edita && (
        <div className="col-lg-4">
          <div className="card mb-3">
            <div className="card-body">
              <h2 className="h6">Nova questão</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (novo.trim()) criar.mutate();
                }}
              >
                <label htmlFor="novaQuestao" className="visually-hidden">
                  Enunciado
                </label>
                <textarea
                  id="novaQuestao"
                  className="form-control mb-2"
                  rows={3}
                  placeholder="Enunciado da questão"
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                />
                <button className="btn btn-primary" disabled={!novo.trim() || criar.isPending}>
                  Adicionar
                </button>
              </form>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <h2 className="h6">Sugestão a partir de “Outras questões”</h2>
              <p className="small text-secondary">
                {q.data?.outrasQuestoes.length ?? 0} questão(ões) no passo 2 do protocolo.
              </p>
              <button
                className="btn btn-outline-primary btn-sm"
                disabled={!q.data?.outrasQuestoes.length || daOutras.isPending}
                onClick={() => daOutras.mutate()}
              >
                Converter todas em QA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
