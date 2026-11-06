import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { api, get, mensagemDeErro, sessao } from '../lib/api';

function erro401(config: InternalAxiosRequestConfig) {
  return new AxiosError('401', 'ERR', config, null, {
    status: 401,
    statusText: '',
    headers: {},
    config,
    data: { erro: { codigo: 'TOKEN_INVALIDO', mensagem: 'Token inválido' } },
  });
}

describe('cliente da API', () => {
  const vistos: (string | undefined)[] = [];
  beforeEach(() => {
    vistos.length = 0;
    // adaptador falso: aceita só o token "novo"
    api.defaults.adapter = async (config) => {
      const auth = AxiosHeaders.from(config.headers).get('Authorization') as string | undefined;
      vistos.push(auth);
      if (auth !== 'Bearer novo') throw erro401(config);
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    sessao.definir(null);
    sessao.aoExpirar(null);
  });

  it('renova o token uma vez e repete a requisição', async () => {
    sessao.definir({ accessToken: 'velho', refreshToken: 'rt-1' });
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: { accessToken: 'novo', refreshToken: 'rt-2' } });
    await expect(get('/me')).resolves.toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.calls[0][1]).toEqual({ refreshToken: 'rt-1' }); // corpo, além do cookie httpOnly
    expect(vistos).toEqual(['Bearer velho', 'Bearer novo']);
    expect(sessao.token()).toBe('novo');
  });

  it('várias requisições com 401 compartilham um único refresh', async () => {
    sessao.definir({ accessToken: 'velho' });
    const refresh = vi
      .spyOn(axios, 'post')
      .mockImplementation(() => new Promise((ok) => setTimeout(() => ok({ data: { accessToken: 'novo' } }), 10)));
    await Promise.all([get('/a'), get('/b'), get('/c')]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('se o refresh falha, encerra a sessão', async () => {
    sessao.definir({ accessToken: 'velho' });
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('401'));
    const expirou = vi.fn();
    sessao.aoExpirar(expirou);
    await expect(get('/me')).rejects.toBeInstanceOf(AxiosError);
    expect(expirou).toHaveBeenCalled();
    expect(sessao.token()).toBeNull();
  });

  it('formata os erros da API com os campos inválidos', () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    const e = new AxiosError('422', 'ERR', config, null, {
      status: 422,
      statusText: '',
      headers: {},
      config,
      data: {
        erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Dados inválidos', campos: { email: ['Invalid email address'] } },
      },
    });
    expect(mensagemDeErro(e)).toBe('Dados inválidos (email: Invalid email address)');
    expect(mensagemDeErro(new AxiosError('rede', 'ERR_NETWORK', config))).toMatch(/conexão/);
  });
});
