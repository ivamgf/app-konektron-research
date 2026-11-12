import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { api, get, patch, post, put } from '../lib/api';
import { dataHora } from '../lib/formato';
import type { Usuario } from '../lib/tipos';
import { BotaoConfirmar, Cabecalho, ErroAlerta } from '../components/ui';
import { REGRA_SENHA, senhaSchema } from './auth/CartaoAuth';
import { ConfigIAForm } from '../components/ConfigIA';

/** RF04 (perfil e preferências) e RNF07 (LGPD: exportar e excluir os dados) */
export default function Perfil() {
  const { usuario, atualizarUsuario, sair } = useAuth();
  const [v, setV] = useState({
    nome: usuario?.nome ?? '',
    instituicao: usuario?.instituicao ?? '',
    orcid: usuario?.orcid ?? '',
    tema: usuario?.preferencias?.tema ?? 'claro',
    idiomaReferencias: usuario?.preferencias?.idiomaReferencias ?? 'NBR',
  });
  const [senha, setSenha] = useState({ senhaAtual: '', novaSenha: '' });
  const [novoEmail, setNovoEmail] = useState({ email: '', senhaAtual: '' });
  const trocarEmail = useMutation({
    mutationFn: () => put<Usuario>('/me/email', { email: novoEmail.email.trim(), senhaAtual: novoEmail.senhaAtual }),
    onSuccess: (u) => {
      atualizarUsuario(u);
      setNovoEmail({ email: '', senhaAtual: '' });
    },
  });
  const reenviar = useMutation({
    mutationFn: () => post('/auth/reenviar-confirmacao', { email: usuario?.email }),
  });
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const salvar = useMutation({
    mutationFn: () =>
      patch<Usuario>('/me', {
        nome: v.nome.trim(),
        instituicao: v.instituicao.trim() || null,
        orcid: v.orcid.trim() || null,
        preferencias: { tema: v.tema, idiomaReferencias: v.idiomaReferencias },
      }),
    onSuccess: atualizarUsuario,
  });
  const trocarSenha = useMutation({
    mutationFn: () => put('/me/senha', senha),
    onSuccess: () => setSenha({ senhaAtual: '', novaSenha: '' }),
  });
  const exportar = useMutation({
    mutationFn: () => get<unknown>('/me/dados'),
    onSuccess: (dados) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meus-dados-konektron.json';
      a.click();
      URL.revokeObjectURL(url);
    },
  });
  if (!usuario) return null;

  return (
    <>
      <Cabecalho titulo="Perfil" subtitulo={usuario.email} />
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card">
            <div className="card-body">
              <h2 className="h5">Dados e preferências</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  salvar.mutate();
                }}
              >
                <ErroAlerta erro={salvar.error} />
                {salvar.isSuccess && <div className="alert alert-success py-2 small">Perfil salvo.</div>}
                <div className="mb-3">
                  <label htmlFor="p-email" className="form-label">
                    E-mail
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="bi bi-envelope" aria-hidden="true" />
                    </span>
                    <input
                      id="p-email"
                      type="email"
                      className="form-control notranslate"
                      translate="no"
                      value={usuario.email}
                      readOnly
                      aria-describedby="p-email-ajuda"
                    />
                  </div>
                  <div id="p-email-ajuda" className="form-text">
                    Usado para entrar e para os avisos do sistema. Para alterar, use “E-mail de acesso”.
                  </div>
                </div>
                <div className="mb-3">
                  <label htmlFor="p-nome" className="form-label">
                    Nome
                  </label>
                  <input
                    id="p-nome"
                    className="form-control"
                    value={v.nome}
                    onChange={(e) => setV({ ...v, nome: e.target.value })}
                  />
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-md-7">
                    <label htmlFor="p-inst" className="form-label">
                      Instituição
                    </label>
                    <input
                      id="p-inst"
                      className="form-control"
                      value={v.instituicao}
                      onChange={(e) => setV({ ...v, instituicao: e.target.value })}
                    />
                  </div>
                  <div className="col-md-5">
                    <label htmlFor="p-orcid" className="form-label">
                      ORCID
                    </label>
                    <input
                      id="p-orcid"
                      className="form-control k-mono"
                      placeholder="0000-0000-0000-000X"
                      value={v.orcid}
                      onChange={(e) => setV({ ...v, orcid: e.target.value })}
                    />
                  </div>
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label htmlFor="p-tema" className="form-label">
                      Tema
                    </label>
                    <select
                      id="p-tema"
                      className="form-select"
                      value={v.tema}
                      onChange={(e) => setV({ ...v, tema: e.target.value as typeof v.tema })}
                    >
                      <option value="claro">Claro</option>
                      <option value="escuro">Escuro</option>
                      <option value="sistema">Igual ao sistema</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="p-ref" className="form-label">
                      Referências
                    </label>
                    <select
                      id="p-ref"
                      className="form-select"
                      value={v.idiomaReferencias}
                      onChange={(e) => setV({ ...v, idiomaReferencias: e.target.value as typeof v.idiomaReferencias })}
                    >
                      <option value="NBR">ABNT NBR 6023</option>
                      <option value="APA">APA 7ª ed.</option>
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" disabled={v.nome.trim().length < 2 || salvar.isPending}>
                  Salvar
                </button>
              </form>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card mb-4">
            <div className="card-body">
              <h2 className="h5">E-mail de acesso</h2>
              <dl className="row small mb-3">
                <dt className="col-sm-4">E-mail atual</dt>
                <dd className="col-sm-8 text-break notranslate" translate="no">
                  {usuario.email}
                </dd>
                <dt className="col-sm-4">Situação</dt>
                <dd className="col-sm-8 mb-0">
                  {usuario.emailVerificadoEm ? (
                    <span className="text-success">
                      <i className="bi bi-patch-check-fill me-1" aria-hidden="true" />
                      Confirmado em {dataHora(usuario.emailVerificadoEm)}
                    </span>
                  ) : (
                    <>
                      <span className="text-warning-emphasis">
                        <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
                        Aguardando confirmação
                      </span>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 ms-2 align-baseline"
                        disabled={reenviar.isPending || reenviar.isSuccess}
                        onClick={() => reenviar.mutate()}
                      >
                        {reenviar.isSuccess ? 'Link reenviado' : 'Reenviar link'}
                      </button>
                    </>
                  )}
                </dd>
              </dl>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  trocarEmail.mutate();
                }}
              >
                <ErroAlerta erro={trocarEmail.error ?? reenviar.error} />
                {trocarEmail.isSuccess && (
                  <div className="alert alert-success py-2 small">
                    E-mail alterado. Enviamos um link de confirmação para o novo endereço.
                  </div>
                )}
                <label htmlFor="e-novo" className="form-label">
                  Novo e-mail
                </label>
                <input
                  id="e-novo"
                  type="email"
                  autoComplete="email"
                  className="form-control mb-2"
                  value={novoEmail.email}
                  onChange={(e) => setNovoEmail({ ...novoEmail, email: e.target.value })}
                />
                <label htmlFor="e-senha" className="form-label">
                  Senha atual
                </label>
                <input
                  id="e-senha"
                  type="password"
                  autoComplete="current-password"
                  className="form-control mb-3"
                  value={novoEmail.senhaAtual}
                  onChange={(e) => setNovoEmail({ ...novoEmail, senhaAtual: e.target.value })}
                />
                <button
                  className="btn btn-outline-primary"
                  disabled={
                    !/^\S+@\S+\.\S+$/.test(novoEmail.email.trim()) ||
                    novoEmail.email.trim().toLowerCase() === usuario.email ||
                    !novoEmail.senhaAtual ||
                    trocarEmail.isPending
                  }
                >
                  Alterar e-mail
                </button>
              </form>
            </div>
          </div>
          <ConfigIAForm />
          <div className="card mb-4">
            <div className="card-body">
              <h2 className="h5">Trocar senha</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const r = senhaSchema.safeParse(senha.novaSenha);
                  if (!r.success) return setErroSenha(r.error.issues[0].message);
                  setErroSenha(null);
                  trocarSenha.mutate();
                }}
              >
                <ErroAlerta erro={erroSenha ?? trocarSenha.error} />
                {trocarSenha.isSuccess && <div className="alert alert-success py-2 small">Senha alterada.</div>}
                <label htmlFor="s-atual" className="form-label">
                  Senha atual
                </label>
                <input
                  id="s-atual"
                  type="password"
                  autoComplete="current-password"
                  className="form-control mb-2"
                  value={senha.senhaAtual}
                  onChange={(e) => setSenha({ ...senha, senhaAtual: e.target.value })}
                />
                <label htmlFor="s-nova" className="form-label">
                  Nova senha
                </label>
                <input
                  id="s-nova"
                  type="password"
                  autoComplete="new-password"
                  className="form-control"
                  value={senha.novaSenha}
                  onChange={(e) => setSenha({ ...senha, novaSenha: e.target.value })}
                />
                <div className="form-text mb-3">{REGRA_SENHA}</div>
                <button
                  className="btn btn-outline-primary"
                  disabled={!senha.senhaAtual || !senha.novaSenha || trocarSenha.isPending}
                >
                  Trocar senha
                </button>
              </form>
            </div>
          </div>
          <div className="card border-danger-subtle">
            <div className="card-body d-grid gap-2">
              <h2 className="h5">Meus dados (LGPD)</h2>
              <ErroAlerta erro={exportar.error} />
              <button
                className="btn btn-outline-secondary"
                disabled={exportar.isPending}
                onClick={() => exportar.mutate()}
              >
                <i className="bi bi-download me-1" aria-hidden="true" />
                Exportar meus dados
              </button>
              <BotaoConfirmar
                className="btn btn-outline-danger"
                pergunta="Excluir sua conta e seus dados pessoais? Esta ação não pode ser desfeita."
                aoConfirmar={async () => {
                  await api.delete('/me');
                  await sair();
                }}
              >
                <i className="bi bi-person-x me-1" aria-hidden="true" />
                Excluir minha conta
              </BotaoConfirmar>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
