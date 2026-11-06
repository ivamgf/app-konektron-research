import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch } from '../../lib/api';
import { rotulo } from '../../lib/formato';
import type { ItemChecklistRevisao } from '../../lib/tipos';
import { BarraProgresso, Carregando, ErroAlerta, Vazio } from '../../components/ui';
import { useProjetoAtual } from '../projeto/ProjetoLayout';

type Resposta = {
  itens: ItemChecklistRevisao[];
  secoes: Record<string, { total: number; realizados: number }>;
  progresso: number;
};
const SITUACOES = ['PENDENTE', 'REALIZADO', 'NAO_REALIZADO', 'ND'] as const;

/** RF35/UC10: checklist genérico de relato agrupado por seção (sem texto de diretrizes de terceiros) */
export function Checklist({ revisaoId }: { revisaoId: string }) {
  const { edita } = useProjetoAtual();
  const qc = useQueryClient();
  const chave = ['revisao', revisaoId, 'checklist'];
  const q = useQuery({ queryKey: chave, queryFn: () => get<Resposta>(`/revisoes/${revisaoId}/checklist`) });
  const [locais, setLocais] = useState<Record<string, string>>({});
  const salvar = useMutation({
    mutationFn: ({ id, ...d }: { id: string; situacao?: string; localRelato?: string | null }) =>
      patch(`/revisoes/${revisaoId}/checklist/${id}`, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: chave }),
  });
  if (q.isLoading) return <Carregando />;
  if (!q.data?.itens.length) return <Vazio icone="bi-list-check">A revisão não tem checklist.</Vazio>;
  const secoes = [...new Set(q.data.itens.map((i) => i.secao))];

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-3">
        <span className="small fw-medium">Progresso geral: {q.data.progresso}%</span>
        <div className="flex-grow-1" style={{ maxWidth: 300 }}>
          <BarraProgresso valor={q.data.progresso} rotulo="Progresso do checklist" />
        </div>
      </div>
      <ErroAlerta erro={q.error ?? salvar.error} />
      {secoes.map((s) => {
        const info = q.data!.secoes[s];
        return (
          <section key={s} className="mb-4">
            <div className="d-flex align-items-center gap-3 mb-2">
              <h3 className="h6 mb-0">{s}</h3>
              <span className="small text-secondary">
                {info?.realizados ?? 0}/{info?.total ?? 0}
              </span>
              <div style={{ width: 120 }}>
                <BarraProgresso
                  valor={info?.total ? (info.realizados / info.total) * 100 : 0}
                  rotulo={`Progresso de ${s}`}
                />
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle small">
                <tbody>
                  {q
                    .data!.itens.filter((i) => i.secao === s)
                    .map((i) => (
                      <tr key={i.id}>
                        <td className="k-mono text-secondary" style={{ width: '4rem' }}>
                          {i.codigo}
                        </td>
                        <td>{i.descricao}</td>
                        <td style={{ width: 170 }}>
                          <select
                            className="form-select form-select-sm"
                            aria-label={`Situação de ${i.codigo}`}
                            disabled={!edita}
                            value={i.situacao}
                            onChange={(e) => salvar.mutate({ id: i.id, situacao: e.target.value })}
                          >
                            {SITUACOES.map((x) => (
                              <option key={x} value={x}>
                                {rotulo(x)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ width: 220 }}>
                          <input
                            className="form-control form-control-sm"
                            placeholder="Onde é relatado"
                            aria-label={`Local de relato de ${i.codigo}`}
                            disabled={!edita}
                            maxLength={300}
                            value={locais[i.id] ?? i.localRelato ?? ''}
                            onChange={(e) => setLocais({ ...locais, [i.id]: e.target.value })}
                            onBlur={() => {
                              const v = locais[i.id];
                              if (v !== undefined && v !== (i.localRelato ?? ''))
                                salvar.mutate({ id: i.id, localRelato: v.trim() || null });
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
