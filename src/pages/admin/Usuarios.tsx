import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { get, patch } from '../../lib/api';
import { data } from '../../lib/formato';
import type { Pagina, UsuarioAdmin } from '../../lib/tipos';
import { nomePlano, PLANOS, type Plano } from '../../lib/planos';
import { Cabecalho, Carregando, ErroAlerta, Paginacao } from '../../components/ui';

/** RF03: ativar, bloquear e redefinir o perfil e o plano dos usuários */
export default function Usuarios() {
  const { usuario: eu } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [termo, setTermo] = useState('');
  const [q, setQ] = useState('');
  const lista = useQuery({
    queryKey: ['admin', 'usuarios', page, q],
    queryFn: () => get<Pagina<UsuarioAdmin>>('/admin/usuarios', { page, pageSize: 25, q: q || undefined }),
    placeholderData: keepPreviousData,
  });
  const alterar = useMutation({
    mutationFn: ({
      id,
      ...d
    }: {
      id: string;
      ativo?: boolean;
      perfilGlobal?: string;
      plano?: Plano;
      planoVitalicio?: boolean;
      descontoEstudante?: boolean;
    }) => patch(`/admin/usuarios/${id}`, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] }),
  });
  return (
    <>
      <Cabecalho titulo="Usuários" subtitulo={lista.data ? `${lista.data.total} usuário(s)` : undefined} />
      <form
        className="input-group mb-3"
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
          placeholder="Nome ou e-mail"
          aria-label="Buscar usuários"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <button className="btn btn-outline-primary" aria-label="Buscar">
          <i className="bi bi-search" aria-hidden="true" />
        </button>
      </form>
      {lista.isLoading && <Carregando />}
      <ErroAlerta erro={lista.error ?? alterar.error} />
      {lista.data && (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail confirmado</th>
                <th>Cadastro</th>
                <th>Perfil</th>
                <th>Plano</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {lista.data.itens.map((u) => {
                const proprio = u.id === eu?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="fw-medium">{u.nome}</div>
                      <div className="small text-secondary">
                        {u.email}
                        {u.instituicao && ` · ${u.instituicao}`}
                      </div>
                    </td>
                    <td className="small">
                      {u.emailVerificadoEm ? (
                        data(u.emailVerificadoEm)
                      ) : (
                        <span className="text-warning-emphasis">Não</span>
                      )}
                    </td>
                    <td className="small">{data(u.criadoEm)}</td>
                    <td>
                      <select
                        className="form-select form-select-sm w-auto"
                        aria-label={`Perfil de ${u.nome}`}
                        disabled={proprio || alterar.isPending}
                        value={u.perfilGlobal}
                        onChange={(e) => alterar.mutate({ id: u.id, perfilGlobal: e.target.value })}
                      >
                        <option value="USUARIO">Usuário</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                    </td>
                    <td style={{ minWidth: 190 }}>
                      {u.perfilGlobal === 'ADMIN' ? (
                        <span className="badge text-bg-primary">Master (administrador)</span>
                      ) : (
                        <>
                          <select
                            className="form-select form-select-sm w-auto"
                            aria-label={`Plano de ${u.nome}`}
                            disabled={alterar.isPending}
                            value={u.plano}
                            onChange={(e) => alterar.mutate({ id: u.id, plano: e.target.value as Plano })}
                          >
                            {PLANOS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nome}
                              </option>
                            ))}
                          </select>
                          {/* opção interna: o plano escolhido não expira nem é cobrado (não aparece para o usuário) */}
                          <div className="form-check small mt-1 mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`vitalicio-${u.id}`}
                              disabled={alterar.isPending}
                              checked={u.planoVitalicio}
                              onChange={(e) => alterar.mutate({ id: u.id, planoVitalicio: e.target.checked })}
                            />
                            <label className="form-check-label" htmlFor={`vitalicio-${u.id}`}>
                              Vitalício (interno)
                            </label>
                          </div>
                          {/* opção interna: 20% de desconto no Standard (comprovante de matrícula) */}
                          <div className="form-check small mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`estudante-${u.id}`}
                              disabled={alterar.isPending}
                              checked={u.descontoEstudante}
                              onChange={(e) => alterar.mutate({ id: u.id, descontoEstudante: e.target.checked })}
                            />
                            <label className="form-check-label" htmlFor={`estudante-${u.id}`}>
                              Estudante (20% no Standard)
                            </label>
                          </div>
                          <div className="small text-secondary">
                            {u.projetosCriados} projeto(s)
                            {u.planoBloqueadoEm && <span className="text-danger"> · bloqueado pelo plano</span>}
                            {!u.planoBloqueadoEm &&
                              u.planoExpiraEm &&
                              ` · ${nomePlano(u.plano)} expira em ${data(u.planoExpiraEm)}`}
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id={`ativo-${u.id}`}
                          disabled={proprio || alterar.isPending}
                          checked={u.ativo}
                          onChange={(e) => alterar.mutate({ id: u.id, ativo: e.target.checked })}
                        />
                        <label className="form-check-label small" htmlFor={`ativo-${u.id}`}>
                          {u.ativo ? 'Ativo' : 'Bloqueado'}
                        </label>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Paginacao page={lista.data.page} pageSize={lista.data.pageSize} total={lista.data.total} aoMudar={setPage} />
        </div>
      )}
    </>
  );
}
