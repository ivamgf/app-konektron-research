/**
 * IA com a conta do próprio usuário (sem custo para o Konektron).
 *
 * Caminho 1 – assistente: monta o pedido, copia e abre o ChatGPT, Claude, Gemini ou Copilot numa aba
 *   nova; o usuário cola a resposta de volta. Funciona com qualquer conta, inclusive gratuita.
 * Caminho 2 – chave de API do usuário: o navegador chama o provedor direto. A chave fica só neste
 *   navegador (sessão, ou guardada se o usuário pedir) e nunca passa pela API do Konektron.
 */

export type Provedor = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'ollama';

export type ConfigIA = {
  provedor: Provedor;
  chave: string;
  modelo: string;
  /** só Ollama: endereço do servidor local */
  url?: string;
  /** guardar a chave neste navegador (localStorage) em vez de só nesta sessão */
  lembrar: boolean;
};

export const PROVEDORES: Record<
  Provedor,
  { nome: string; modelos: string[]; chaveUrl?: string; semChave?: boolean; ajuda: string }
> = {
  anthropic: {
    nome: 'Anthropic (Claude)',
    modelos: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    chaveUrl: 'https://console.anthropic.com/settings/keys',
    ajuda: 'Chave de API do Claude Console (começa com sk-ant-). A assinatura Claude Pro/Max não inclui a API.',
  },
  openai: {
    nome: 'OpenAI (GPT)',
    modelos: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini'],
    chaveUrl: 'https://platform.openai.com/api-keys',
    ajuda: 'Chave da plataforma OpenAI (começa com sk-). A assinatura do ChatGPT Plus não inclui a API.',
  },
  gemini: {
    nome: 'Google (Gemini)',
    modelos: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    chaveUrl: 'https://aistudio.google.com/app/apikey',
    ajuda: 'Chave do Google AI Studio (tem cota gratuita com limites).',
  },
  openrouter: {
    nome: 'OpenRouter (vários modelos)',
    modelos: ['openrouter/auto', 'anthropic/claude-opus-5-5', 'openai/gpt-4.1', 'google/gemini-2.5-pro'],
    chaveUrl: 'https://openrouter.ai/keys',
    ajuda: 'Uma conta só para vários modelos. Use "Conectar com OpenRouter" para não precisar copiar a chave.',
  },
  ollama: {
    nome: 'Ollama (modelo local, gratuito)',
    modelos: ['llama3.1', 'qwen2.5', 'mistral'],
    semChave: true,
    ajuda: 'Roda no seu computador. Inicie o Ollama com OLLAMA_ORIGINS liberando este site.',
  },
};

const CHAVE = 'konektron.ia';

function armazenamentos(): Storage[] {
  const s: Storage[] = [];
  try {
    s.push(sessionStorage);
  } catch {
    /* sem sessionStorage */
  }
  try {
    s.push(localStorage);
  } catch {
    /* sem localStorage */
  }
  return s;
}

export function lerConfigIA(): ConfigIA | null {
  for (const s of armazenamentos()) {
    try {
      const v = s.getItem(CHAVE);
      if (v) {
        const c = JSON.parse(v) as ConfigIA;
        if (c?.provedor && PROVEDORES[c.provedor]) return c;
      }
    } catch {
      /* ignora valor inválido */
    }
  }
  return null;
}

export function gravarConfigIA(c: ConfigIA | null) {
  for (const s of armazenamentos()) {
    try {
      s.removeItem(CHAVE);
    } catch {
      /* ignora */
    }
  }
  if (!c) return;
  try {
    (c.lembrar ? localStorage : sessionStorage).setItem(CHAVE, JSON.stringify(c));
  } catch {
    /* navegador sem armazenamento: vale só até recarregar */
  }
  window.dispatchEvent(new Event('konektron-ia'));
}

export const iaConfigurada = (c: ConfigIA | null): c is ConfigIA =>
  !!c && (PROVEDORES[c.provedor].semChave || !!c.chave.trim()) && !!c.modelo.trim();

// ------------------------------------------------------------------ chamada

export type PedidoIA = { sistema: string; mensagem: string; json?: boolean };

export class ErroIA extends Error {}

function erroHttp(status: number, detalhe: string) {
  if (status === 401 || status === 403)
    return new ErroIA('Chave de API recusada pelo provedor. Confira a chave no Perfil.');
  if (status === 429)
    return new ErroIA('Limite ou crédito da sua conta de IA esgotado. Tente mais tarde ou confira o saldo.');
  if (status === 404) return new ErroIA(`Modelo não encontrado no provedor. Confira o nome do modelo. ${detalhe}`);
  return new ErroIA(`O provedor de IA respondeu com erro ${status}. ${detalhe}`.trim());
}

async function postJson(url: string, corpo: unknown, headers: Record<string, string>) {
  let r: Response;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroIA('Não foi possível falar com o provedor de IA (rede ou bloqueio do navegador).');
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw erroHttp(r.status, j?.error?.message ?? j?.message ?? '');
  return j;
}

/** Formato de chat da OpenAI, também usado pelo OpenRouter e pelo Ollama */
async function chatCompat(url: string, c: ConfigIA, p: PedidoIA, headers: Record<string, string>) {
  const j = await postJson(
    url,
    {
      model: c.modelo,
      messages: [
        { role: 'system', content: p.sistema },
        { role: 'user', content: p.mensagem },
      ],
      ...(p.json && c.provedor !== 'ollama' ? { response_format: { type: 'json_object' } } : {}),
    },
    headers,
  );
  const texto = j?.choices?.[0]?.message?.content;
  if (typeof texto !== 'string') throw new ErroIA('Resposta vazia do provedor de IA.');
  return texto;
}

async function claude(c: ConfigIA, p: PedidoIA) {
  // SDK oficial, carregado só quando usado; a chave é do usuário e fica no navegador dele
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: c.chave, dangerouslyAllowBrowser: true });
  // fallback no servidor quando o modelo recusa por política (Opus 5.5 / Sonnet 5.5)
  const comFallback = c.modelo === 'claude-opus-5-5' || c.modelo === 'claude-sonnet-5-5';
  try {
    const r = await client.beta.messages.create({
      model: c.modelo,
      max_tokens: 16000,
      system: p.sistema,
      messages: [{ role: 'user', content: p.mensagem }],
      output_config: { effort: 'medium' },
      ...(comFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
    if (r.stop_reason === 'refusal') throw new ErroIA('O modelo recusou o pedido. Reformule o texto e tente de novo.');
    const texto = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    if (!texto.trim()) throw new ErroIA('Resposta vazia do Claude.');
    return texto;
  } catch (e) {
    if (e instanceof ErroIA) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw erroHttp(401, '');
    if (e instanceof Anthropic.RateLimitError) throw erroHttp(429, '');
    if (e instanceof Anthropic.NotFoundError) throw erroHttp(404, '');
    if (e instanceof Anthropic.APIError) throw erroHttp(e.status ?? 0, e.message);
    throw new ErroIA('Não foi possível falar com o Claude (rede ou bloqueio do navegador).');
  }
}

async function gemini(c: ConfigIA, p: PedidoIA) {
  const j = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.modelo)}:generateContent`,
    {
      systemInstruction: { parts: [{ text: p.sistema }] },
      contents: [{ role: 'user', parts: [{ text: p.mensagem }] }],
      ...(p.json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    },
    { 'x-goog-api-key': c.chave },
  );
  const texto = (j?.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? '').join('');
  if (!texto.trim()) throw new ErroIA('Resposta vazia do Gemini (o pedido pode ter sido bloqueado pelos filtros).');
  return texto;
}

/** Gera texto com a conta de IA configurada pelo usuário */
export async function gerarComIA(c: ConfigIA, p: PedidoIA): Promise<string> {
  switch (c.provedor) {
    case 'anthropic':
      return claude(c, p);
    case 'gemini':
      return gemini(c, p);
    case 'openai':
      return chatCompat('https://api.openai.com/v1/chat/completions', c, p, { Authorization: `Bearer ${c.chave}` });
    case 'openrouter':
      return chatCompat('https://openrouter.ai/api/v1/chat/completions', c, p, {
        Authorization: `Bearer ${c.chave}`,
        'HTTP-Referer': location.origin,
        'X-Title': 'Konektron Research',
      });
    case 'ollama':
      return chatCompat(`${(c.url || 'http://localhost:11434').replace(/\/+$/, '')}/v1/chat/completions`, c, p, {});
  }
}

/** Extrai o primeiro objeto ou lista JSON da resposta (alguns modelos cercam com ```json) */
export function lerJson<T>(texto: string): T {
  const limpo = texto.replace(/```(?:json)?/gi, '').trim();
  const ini = limpo.search(/[[{]/);
  if (ini < 0) throw new ErroIA('A IA não devolveu dados no formato esperado. Tente de novo.');
  const fecha = limpo[ini] === '[' ? ']' : '}';
  const fim = limpo.lastIndexOf(fecha);
  try {
    return JSON.parse(limpo.slice(ini, fim + 1)) as T;
  } catch {
    throw new ErroIA('A IA não devolveu dados no formato esperado. Tente de novo.');
  }
}

// ------------------------------------------------------------------ OpenRouter: conectar sem copiar chave (OAuth PKCE)

const VERIFICADOR = 'konektron.openrouter.verificador';
const base64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export async function conectarOpenRouter(volta = `${location.origin}/perfil`) {
  const verificador = base64url(crypto.getRandomValues(new Uint8Array(32)));
  sessionStorage.setItem(VERIFICADOR, verificador);
  const desafio = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)));
  location.href = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(volta)}&code_challenge=${desafio}&code_challenge_method=S256`;
}

/** Na volta do OpenRouter (?code=...), troca o código pela chave do usuário */
export async function concluirOpenRouter(codigo: string): Promise<string> {
  const verificador = sessionStorage.getItem(VERIFICADOR);
  if (!verificador) throw new ErroIA('Conexão com o OpenRouter expirou. Tente de novo.');
  const j = await postJson(
    'https://openrouter.ai/api/v1/auth/keys',
    { code: codigo, code_verifier: verificador, code_challenge_method: 'S256' },
    {},
  );
  sessionStorage.removeItem(VERIFICADOR);
  if (!j?.key) throw new ErroIA('O OpenRouter não devolveu a chave.');
  return j.key as string;
}

// ------------------------------------------------------------------ caminho 1: assistentes na web

export const ASSISTENTES = [
  {
    id: 'chatgpt',
    nome: 'ChatGPT',
    url: (q: string) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
    preenche: true,
  },
  {
    id: 'claude',
    nome: 'Claude',
    url: (q: string) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
    preenche: true,
  },
  {
    id: 'copilot',
    nome: 'Microsoft Copilot',
    url: (q: string) => `https://copilot.microsoft.com/?q=${encodeURIComponent(q)}`,
    preenche: true,
  },
  { id: 'gemini', nome: 'Gemini', url: () => 'https://gemini.google.com/app', preenche: false },
  { id: 'copiar', nome: 'Só copiar o pedido', url: () => '', preenche: false },
] as const;
export type AssistenteId = (typeof ASSISTENTES)[number]['id'];

/** Pedido completo (instruções + contexto) para colar num assistente de chat */
export const pedidoParaAssistente = (p: PedidoIA) => `${p.sistema}\n\n${p.mensagem}`;

export async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Copia o pedido e abre o assistente; pedidos longos não cabem na URL e vão só pela área de transferência */
export async function abrirNoAssistente(id: AssistenteId, pedido: string) {
  const copiou = await copiarTexto(pedido);
  const a = ASSISTENTES.find((x) => x.id === id)!;
  if (id !== 'copiar') {
    const url = a.preenche && pedido.length <= 6000 ? a.url(pedido) : ASSISTENTES.find((x) => x.id === id)!.url('');
    window.open(url.replace(/\?q=$/, ''), '_blank', 'noopener');
  }
  return copiou;
}

// ------------------------------------------------------------------ prompts

export const SISTEMA_ACADEMICO =
  'Você é um assistente de pesquisa científica que ajuda a escrever protocolos de pesquisa e revisões de literatura ' +
  'em português do Brasil, com linguagem acadêmica clara, objetiva e impessoal. Não invente dados, resultados, ' +
  'autores nem referências bibliográficas; quando faltar informação, escreva de forma genérica ou indique entre ' +
  'colchetes o que o pesquisador precisa completar. Responda apenas com o texto pedido, sem comentários antes ou depois.';

export const ACOES_TEXTO = [
  { id: 'gerar', nome: 'Gerar', instrucao: 'Escreva o conteúdo do campo' },
  {
    id: 'melhorar',
    nome: 'Melhorar o texto atual',
    instrucao: 'Revise e melhore o texto atual do campo (clareza, coesão, linguagem acadêmica), mantendo as ideias',
  },
  { id: 'resumir', nome: 'Resumir', instrucao: 'Resuma o texto atual do campo, mantendo as ideias principais' },
  { id: 'ingles', nome: 'Traduzir para inglês', instrucao: 'Traduza o texto atual do campo para o inglês acadêmico' },
] as const;
export type AcaoTexto = (typeof ACOES_TEXTO)[number]['id'];

export function montarPedidoCampo(o: {
  campo: string;
  orientacao?: string;
  contexto: string;
  atual: string;
  acao: AcaoTexto;
  extra?: string;
}): PedidoIA {
  const acao = ACOES_TEXTO.find((a) => a.id === o.acao)!;
  const partes = [
    `Campo do formulário: "${o.campo}".\nTarefa: ${acao.instrucao}.`,
    o.orientacao ? `Orientação para este campo: ${o.orientacao}` : '',
    o.contexto.trim() ? `Contexto da pesquisa:\n${o.contexto.trim()}` : '',
    o.atual.trim() ? `Texto atual do campo:\n${o.atual.trim()}` : '',
    o.extra?.trim() ? `Pedido adicional do pesquisador: ${o.extra.trim()}` : '',
  ];
  return { sistema: SISTEMA_ACADEMICO, mensagem: partes.filter(Boolean).join('\n\n') };
}
