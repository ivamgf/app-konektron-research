import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { api, get, patch, put } from '../lib/api';
import type { Usuario } from '../lib/tipos';
import { BotaoConfirmar, Cabecalho, ErroAlerta } from '../components/ui';
import { REGRA_SENHA } from './auth/CartaoAuth';
import { senhaSchema } from './auth/Registrar';

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
