import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, get, renovarSessao, sessao } from '../lib/api';
import type { Usuario } from '../lib/tipos';

type Auth = {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  atualizarUsuario: (u: Usuario) => void;
};

const AuthContext = createContext<Auth | null>(null);

/** Tema do usuário (RF04): claro, escuro ou o do sistema */
export function aplicarTema(tema: string | undefined) {
  const escuro =
    tema === 'escuro' || (tema === 'sistema' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-bs-theme', escuro ? 'dark' : 'light');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const queryClient = useQueryClient();

  const limpar = useCallback(() => {
    sessao.definir(null);
    setUsuario(null);
    queryClient.clear();
    aplicarTema('claro');
  }, [queryClient]);

  // Ao abrir o app, tenta retomar a sessão pelo cookie do refresh token
  useEffect(() => {
    let vivo = true;
    sessao.aoExpirar(limpar);
    (async () => {
      if (await renovarSessao()) {
        try {
          const u = await get<Usuario>('/me');
          if (vivo) {
            setUsuario(u);
            aplicarTema(u.preferencias?.tema);
          }
        } catch {
          sessao.definir(null);
        }
      }
      if (vivo) setCarregando(false);
    })();
    return () => {
      vivo = false;
      sessao.aoExpirar(null);
    };
  }, [limpar]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { data } = await api.post('/auth/login', { email, senha, dispositivo: 'web' });
    sessao.definir({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUsuario(data.usuario);
    aplicarTema(data.usuario?.preferencias?.tema);
  }, []);

  const sair = useCallback(async () => {
    try {
      const refreshToken = sessao.refreshToken();
      await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
    } catch {
      // a sessão local é encerrada mesmo se a API não responder
    }
    limpar();
  }, [limpar]);

  const atualizarUsuario = useCallback((u: Usuario) => {
    setUsuario(u);
    aplicarTema(u.preferencias?.tema);
  }, []);

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, sair, atualizarUsuario }),
    [usuario, carregando, entrar, sair, atualizarUsuario],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
