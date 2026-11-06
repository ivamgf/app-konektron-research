import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * Cliente HTTP da API (ERS 7.3: Axios + interceptador JWT).
 *
 * - O token de acesso (15 min) fica só em memória.
 * - O refresh token vai em cookie httpOnly (RNF04), enviado com `withCredentials`.
 *   Como o cookie só viaja entre domínios do mesmo site (app.dominio e api.dominio),
 *   o refresh token devolvido no corpo também é guardado em memória: assim a sessão
 *   continua na aba atual mesmo quando o cookie não é aceito (ex.: *.herokuapp.com).
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1').replace(/\/+$/, '');

export const api = axios.create({ baseURL: API_URL, withCredentials: true, timeout: 30_000 });

type Tokens = { accessToken: string; refreshToken?: string };
let tokens: Tokens | null = null;
let aoExpirar: (() => void) | null = null;

export const sessao = {
  definir(t: Tokens | null) {
    tokens = t;
  },
  token: () => tokens?.accessToken ?? null,
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

export function renovarSessao(): Promise<boolean> {
  if (renovando) return renovando;
  const atual = (async () => {
    try {
      const corpo = tokens?.refreshToken ? { refreshToken: tokens.refreshToken } : {};
      const { data } = await axios.post(`${API_URL}/auth/refresh`, corpo, { withCredentials: true, timeout: 15_000 });
      tokens = { accessToken: data.accessToken, refreshToken: data.refreshToken };
      return true;
    } catch {
      tokens = null;
      return false;
    }
  })();
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
