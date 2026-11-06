import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/api';
import { dataHora } from '../lib/formato';
import type { Notificacao } from '../lib/tipos';
import { Cabecalho, Carregando, ErroAlerta, Vazio } from '../components/ui';

/** Link de destino a partir dos dados da notificação */
export function destino(n: Notificacao): string | null {
  const d = n.dados ?? {};
  if (n.tipo === 'CONVITE') return '/projetos';
  if (d.projetoId && n.tipo.startsWith('PROTOCOLO')) return `/projetos/${d.projetoId}/protocolo`;
  if (d.projetoId) return `/projetos/${d.projetoId}`;
  return null;
}

export default function Notificacoes() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notificacoes'], queryFn: () => get<Notificacao[]>('/notificacoes') });
  const marcar = useMutation({
    mutationFn: (ids?: string[]) => post('/notificacoes/lidas', ids ? { ids } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes'] }),
  });
  const naoLidas = q.data?.filter((n) => !n.lidaEm).length ?? 0;
  return (
    <>
      <Cabecalho titulo="Notificações" subtitulo={`${naoLidas} não lida(s)`}>
        <button
          className="btn btn-outline-primary"
          disabled={!naoLidas || marcar.isPending}
          onClick={() => marcar.mutate(undefined)}
        >
          Marcar todas como lidas
        </button>
      </Cabecalho>
      {q.isLoading && <Carregando />}
      <ErroAlerta erro={q.error ?? marcar.error} />
      {q.data?.length === 0 && <Vazio icone="bi-bell">Nenhuma notificação.</Vazio>}
      <div className="list-group">
        {q.data?.map((n) => {
          const link = destino(n);
          return (
            <div
              key={n.id}
              className={`list-group-item d-flex gap-3 align-items-start ${n.lidaEm ? '' : 'border-start border-4 border-primary'}`}
            >
              <div className="flex-grow-1">
                <div className={n.lidaEm ? '' : 'fw-bold'}>
                  {link ? (
                    <Link to={link} onClick={() => !n.lidaEm && marcar.mutate([n.id])}>
                      {n.titulo}
                    </Link>
                  ) : (
                    n.titulo
                  )}
                </div>
                <div className="small text-secondary">{dataHora(n.criadoEm)}</div>
              </div>
              {!n.lidaEm && (
                <button className="btn btn-sm btn-outline-secondary" onClick={() => marcar.mutate([n.id])}>
                  Marcar como lida
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
