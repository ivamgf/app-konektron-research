import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { get } from '../../lib/api';
import { dataHora } from '../../lib/formato';
import { Carregando, ErroAlerta, Vazio } from '../../components/ui';
import { useProjetoAtual } from './ProjetoLayout';

type Registro = {
  id: number;
  entidade: string;
  entidadeId: string;
  acao: string;
  usuarioNome: string | null;
  ip: string | null;
  dadosDepois: unknown;
  criadoEm: string;
};

const ENTIDADES = [
  '',
  'projeto',
  'protocolo',
  'revisao',
  'revisao_etapa',
  'triagem_decisao',
  'triagem_resultado',
  'documento',
  'analise',
];

/** RF44: quem, quando e o quê */
export default function Auditoria() {
  const { projeto } = useProjetoAtual();
  const [entidade, setEntidade] = useState('');
  const q = useInfiniteQuery({
    queryKey: ['projeto', projeto.id, 'auditoria', entidade],
    queryFn: ({ pageParam }) =>
      get<Registro[]>(`/projetos/${projeto.id}/auditoria`, {
        limite: 100,
        entidade: entidade || undefined,
        antesDe: pageParam,
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (ultima) => (ultima.length === 100 ? ultima[ultima.length - 1].id : undefined),
  });
  const registros = q.data?.pages.flat() ?? [];
  return (
    <>
      <div className="d-flex gap-2 align-items-center mb-3">
        <h2 className="h5 mb-0 me-auto">Trilha de auditoria</h2>
        <select
          className="form-select w-auto"
          aria-label="Filtrar por entidade"
          value={entidade}
          onChange={(e) => setEntidade(e.target.value)}
        >
          {ENTIDADES.map((e) => (
            <option key={e} value={e}>
              {e ? e.replace(/_/g, ' ') : 'Todas as entidades'}
            </option>
          ))}
        </select>
      </div>
      {q.isLoading && <Carregando />}
      <ErroAlerta erro={q.error} />
      {!q.isLoading && registros.length === 0 && <Vazio icone="bi-clock-history">Nenhum registro.</Vazio>}
      {registros.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm small align-middle">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td className="text-nowrap">{dataHora(r.criadoEm)}</td>
                  <td>{r.usuarioNome ?? '—'}</td>
                  <td>
                    <span className="badge text-bg-light border">{r.acao}</span>
                  </td>
                  <td>{r.entidade.replace(/_/g, ' ')}</td>
                  <td
                    className="text-truncate k-mono"
                    style={{ maxWidth: 360 }}
                    title={r.dadosDepois ? JSON.stringify(r.dadosDepois) : ''}
                  >
                    {r.dadosDepois ? JSON.stringify(r.dadosDepois) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.hasNextPage && (
        <button className="btn btn-outline-secondary" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
          Carregar mais
        </button>
      )}
    </>
  );
}
