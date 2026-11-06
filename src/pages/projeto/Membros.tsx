import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post } from '../../lib/api';
import { data, rotulo } from '../../lib/formato';
import type { Papel } from '../../lib/tipos';
import { BotaoConfirmar, Carregando, ErroAlerta } from '../../components/ui';
import { useProjetoAtual } from './ProjetoLayout';

type Membro = {
  id: string;
  nome: string;
  email: string;
  instituicao: string | null;
  papel: Papel;
  aceitoEm: string | null;
};
type Convite = { id: string; email: string; papel: Papel; expiraEm: string; criadoEm: string };
const PAPEIS = ['COLABORADOR', 'ORIENTADOR', 'LEITOR'] as const;

export default function Membros() {
  const { projeto, dono } = useProjetoAtual();
  const qc = useQueryClient();
  const chave = ['projeto', projeto.id, 'membros'];
  const q = useQuery({
    queryKey: chave,
    queryFn: () => get<{ membros: Membro[]; convites: Convite[] }>(`/projetos/${projeto.id}/membros`),
  });
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<(typeof PAPEIS)[number]>('COLABORADOR');
  const recarregar = () => qc.invalidateQueries({ queryKey: chave });
  const convidar = useMutation({
    mutationFn: () => post(`/projetos/${projeto.id}/membros`, { email: email.trim(), papel }),
    onSuccess: () => (setEmail(''), recarregar()),
  });
  const mudarPapel = useMutation({
    mutationFn: ({ id, papel }: { id: string; papel: string }) =>
      patch(`/projetos/${projeto.id}/membros/${id}`, { papel }),
    onSuccess: recarregar,
  });

  if (q.isLoading) return <Carregando />;
  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <h2 className="h5">Membros</h2>
        <ErroAlerta erro={q.error ?? mudarPapel.error} />
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Papel</th>
                <th>Desde</th>
                {dono && <th className="text-end">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {q.data?.membros.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="fw-medium">{m.nome}</div>
                    <div className="small text-secondary">{m.email}</div>
                  </td>
                  <td>
                    {dono && m.papel !== 'RESPONSAVEL' ? (
                      <select
                        className="form-select form-select-sm w-auto"
                        aria-label={`Papel de ${m.nome}`}
                        value={m.papel}
                        onChange={(e) => mudarPapel.mutate({ id: m.id, papel: e.target.value })}
                      >
                        {PAPEIS.map((p) => (
                          <option key={p} value={p}>
                            {rotulo(p)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      rotulo(m.papel)
                    )}
                  </td>
                  <td className="small">
                    {m.aceitoEm ? data(m.aceitoEm) : <span className="text-warning-emphasis">Convite pendente</span>}
                  </td>
                  {dono && (
                    <td className="text-end">
                      {m.papel !== 'RESPONSAVEL' && (
                        <BotaoConfirmar
                          titulo={`Remover ${m.nome}`}
                          pergunta={`Remover ${m.nome} do projeto?`}
                          aoConfirmar={async () => {
                            await del(`/projetos/${projeto.id}/membros/${m.id}`);
                            await recarregar();
                          }}
                        >
                          <i className="bi bi-person-dash" aria-hidden="true" />
                        </BotaoConfirmar>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!!q.data?.convites.length && (
          <>
            <h2 className="h6 mt-4">Convites pendentes</h2>
            <ul className="list-group">
              {q.data.convites.map((c) => (
                <li key={c.id} className="list-group-item d-flex align-items-center gap-2">
                  <span className="flex-grow-1">
                    {c.email} · {rotulo(c.papel)}{' '}
                    <span className="small text-secondary">· expira em {data(c.expiraEm)}</span>
                  </span>
                  {dono && (
                    <BotaoConfirmar
                      titulo={`Cancelar convite de ${c.email}`}
                      pergunta={`Cancelar o convite enviado para ${c.email}?`}
                      aoConfirmar={async () => {
                        await del(`/projetos/${projeto.id}/convites/${c.id}`);
                        await recarregar();
                      }}
                    >
                      <i className="bi bi-x-lg" aria-hidden="true" />
                    </BotaoConfirmar>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {dono && (
        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <h2 className="h6">Convidar por e-mail</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  convidar.mutate();
                }}
              >
                <ErroAlerta erro={convidar.error} />
                {convidar.isSuccess && <div className="alert alert-success small py-2">Convite enviado.</div>}
                <label htmlFor="conv-email" className="form-label">
                  E-mail
                </label>
                <input
                  id="conv-email"
                  type="email"
                  className="form-control mb-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <label htmlFor="conv-papel" className="form-label">
                  Papel
                </label>
                <select
                  id="conv-papel"
                  className="form-select mb-3"
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as typeof papel)}
                >
                  {PAPEIS.map((p) => (
                    <option key={p} value={p}>
                      {rotulo(p)}
                    </option>
                  ))}
                </select>
                <button className="btn btn-primary w-100" disabled={!email.includes('@') || convidar.isPending}>
                  Enviar convite
                </button>
              </form>
              <ul className="small text-secondary mt-3 mb-0 ps-3">
                <li>Colaborador: protocolo, documentos, triagem e análise.</li>
                <li>Orientador: leitura, comentários, aprovação do protocolo e desempate.</li>
                <li>Leitor: só leitura e impressão.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
