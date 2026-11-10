import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * Cliente HTTP da API (ERS 7.3: Axios + interceptador JWT).
 *
 * - O token de acesso (15 min) fica só em memória.
 * - O refresh token vai em cookie httpOnly (RNF04), enviado com `withCredentials`.
 *   Como o cookie só viaja entre domínios do mesmo site (app.dominio e api.dominio),
 *   o refresh token devolvido no corpo também é guardado no localStorage: assim a sessão
 *   sobrevive ao recarregamento (F5) mesmo quando o cookie não é aceito (ex.: *.herokuapp.com).
 * - O refresh é rotativo e a API derruba todas as sessões se um token já usado voltar;
 *   por isso as abas renovam uma de cada vez (Web Locks), sempre com o token mais recente guardado.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1').replace(/\/+$/, '');

export const api = axios.create({ baseURL: API_URL, withCredentials: true, timeout: 30_000 });

type Tokens = { accessToken: string; refreshToken?: string };
let tokens: Tokens | null = null;
let aoExpirar: (() => void) | null = null;

const CHAVE_REFRESH = 'kr_rt';
const refreshGuardado = (): string | undefined => {
  try {
    return localStorage.getItem(CHAVE_REFRESH) ?? undefined;
  } catch {
    return undefined;
  }
};
const definirTokens = (t: Tokens | null) => {
  tokens = t;
  try {
    if (t?.refreshToken) localStorage.setItem(CHAVE_REFRESH, t.refreshToken);
    else localStorage.removeItem(CHAVE_REFRESH);
  } catch {
    // sem storage (aba privada ou bloqueado): a sessão vale só para esta aba
  }
};

export const sessao = {
  definir(t: Tokens | null) {
    definirTokens(t);
  },
  token: () => tokens?.accessToken ?? null,
  refreshToken: () => refreshGuardado() ?? tokens?.refreshToken,
  /** chamado quando o refresh falha: o AuthProvider limpa o usuário e vai para o login */
  aoExpirar(fn: (() => void) | null) {
    aoExpirar = fn;
  },
};

api.interceptors.request.use((config) => {
  if (tokens?.accessToken) config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  return config;
});

// Um único refresh em andamento por vez: várias requisições com 401 esperam o mesmo
let renovando: Promise<boolean> | null = null;

/** Executa com exclusão entre abas quando o navegador oferece Web Locks */
const comTrava = <T,>(fn: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? (locks.request('kr-refresh', fn) as Promise<T>) : fn();
};

export function renovarSessao(): Promise<boolean> {
  if (renovando) return renovando;
  const atual = comTrava(async () => {
    // outra aba pode ter renovado enquanto esta esperava: usa sempre o token mais recente guardado
    const refresh = refreshGuardado() ?? tokens?.refreshToken;
    try {
      const corpo = refresh ? { refreshToken: refresh } : {};
      const { data } = await axios.post(`${API_URL}/auth/refresh`, corpo, { withCredentials: true, timeout: 30_000 });
      definirTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch (e) {
      // só a recusa da API (401) encerra a sessão; falha de rede ou API acordando mantém o token guardado
      if (axios.isAxiosError(e) && e.response?.status === 401) definirTokens(null);
      else tokens = null;
      return false;
    }
  });
  renovando = atual;
  // libera assim que termina: quem já esperava recebe o mesmo resultado; um 401 posterior renova de novo
  atual.finally(() => {
    if (renovando === atual) renovando = null;
  });
  return atual;
}

api.interceptors.response.use(undefined, async (error: AxiosError<any>) => {
  const original = error.config as (AxiosRequestConfig & { _repetida?: boolean }) | undefined;
  const codigo = error.response?.data?.erro?.codigo;
  const ehAuth = original?.url?.startsWith('/auth/');
  if (error.response?.status === 401 && original && !original._repetida && !ehAuth && codigo !== 'SESSAO_EXPIRADA') {
    original._repetida = true;
    if (await renovarSessao()) return api(original);
    aoExpirar?.();
  }
  return Promise.reject(error);
});

// ---------------------------------------------------------------- erros no formato da API (ERS 10.3)

export type ErroApi = {
  status?: number;
  codigo?: string;
  mensagem: string;
  campos?: Record<string, string[]> | unknown;
};

export function lerErro(e: unknown): ErroApi {
  if (axios.isAxiosError(e)) {
    const erro = e.response?.data?.erro;
    if (erro) return { status: e.response?.status, codigo: erro.codigo, mensagem: erro.mensagem, campos: erro.campos };
    if (e.code === 'ECONNABORTED') return { mensagem: 'A API demorou demais para responder. Tente de novo.' };
    if (!e.response) return { mensagem: 'Não foi possível falar com a API. Verifique sua conexão.' };
    return { status: e.response.status, mensagem: `Erro ${e.response.status} na API` };
  }
  return { mensagem: e instanceof Error ? e.message : 'Erro inesperado' };
}

/** Mensagem para exibir, incluindo os campos inválidos (422) quando houver */
export function mensagemDeErro(e: unknown): string {
  const erro = lerErro(e);
  const campos = erro.campos;
  if (campos && typeof campos === 'object' && !Array.isArray(campos)) {
    const lista = Object.entries(campos as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join('; ');
    if (lista) return `${erro.mensagem} (${lista})`;
  }
  if (Array.isArray(campos) && campos.length && typeof campos[0] === 'object') {
    return `${erro.mensagem}: ${campos.map((c: any) => c.mensagem ?? JSON.stringify(c)).join('; ')}`;
  }
  return erro.mensagem;
}

// atalhos tipados
export const get = <T>(url: string, params?: Record<string, unknown>) =>
  api.get<T>(url, { params }).then((r) => r.data);
export const post = <T>(url: string, body?: unknown) => api.post<T>(url, body).then((r) => r.data);
export const put = <T>(url: string, body?: unknown) => api.put<T>(url, body).then((r) => r.data);
export const patch = <T>(url: string, body?: unknown) => api.patch<T>(url, body).then((r) => r.data);
export const del = (url: string) => api.delete(url).then(() => undefined);
