/**
 * Preferências de acessibilidade da interface (WCAG 2.2): ficam neste navegador e valem para todas
 * as telas, com ou sem login. São aplicadas como atributos no <html>, lidos pelo app.scss.
 *
 * - contraste: alto contraste (fundo preto, texto branco, links e foco em amarelo) — 1.4.3 / 1.4.6
 * - fonte: tamanho do texto de 90% a 200% — 1.4.4
 * - espacamento: altura de linha e espaço entre letras, palavras e parágrafos — 1.4.12
 * - fonteLegivel: fonte sem serifa mais aberta (ajuda pessoas com dislexia ou baixa visão)
 * - sublinharLinks: links sempre sublinhados (não dependem só da cor) — 1.4.1
 * - cursorGrande: ponteiro do mouse maior
 * - focoReforcado: moldura de foco mais grossa — 2.4.13
 * - semAnimacao: sem animações e transições — 2.3.3
 * - guiaLeitura: faixa que acompanha o ponteiro e destaca a linha que está sendo lida
 */

export type PreferenciasAcessibilidade = {
  contraste: boolean;
  fonte: number;
  espacamento: boolean;
  fonteLegivel: boolean;
  sublinharLinks: boolean;
  cursorGrande: boolean;
  focoReforcado: boolean;
  semAnimacao: boolean;
  guiaLeitura: boolean;
};

/** Tamanhos da fonte em % do padrão do navegador (100% = 16 px) */
export const TAMANHOS_FONTE = [90, 100, 112.5, 125, 150, 175, 200] as const;
const FONTE_PADRAO = 100;

export const PADRAO: PreferenciasAcessibilidade = {
  contraste: false,
  fonte: FONTE_PADRAO,
  espacamento: false,
  fonteLegivel: false,
  sublinharLinks: false,
  cursorGrande: false,
  focoReforcado: false,
  semAnimacao: false,
  guiaLeitura: false,
};

const CHAVE = 'konektron:acessibilidade';

/** Atributo no <html> de cada opção liga/desliga */
const ATRIBUTOS: Record<Exclude<keyof PreferenciasAcessibilidade, 'fonte'>, string> = {
  contraste: 'data-k-contraste',
  espacamento: 'data-k-espacamento',
  fonteLegivel: 'data-k-fonte-legivel',
  sublinharLinks: 'data-k-sublinhar',
  cursorGrande: 'data-k-cursor',
  focoReforcado: 'data-k-foco',
  semAnimacao: 'data-k-sem-animacao',
  guiaLeitura: 'data-k-guia',
};

export function lerPreferencias(): PreferenciasAcessibilidade {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Partial<PreferenciasAcessibilidade> | null;
    if (!salvo || typeof salvo !== 'object') return { ...PADRAO };
    const p = { ...PADRAO };
    for (const k of Object.keys(ATRIBUTOS) as (keyof typeof ATRIBUTOS)[]) p[k] = salvo[k] === true;
    p.fonte = (TAMANHOS_FONTE as readonly number[]).includes(Number(salvo.fonte)) ? Number(salvo.fonte) : FONTE_PADRAO;
    return p;
  } catch {
    return { ...PADRAO };
  }
}

export function gravarPreferencias(p: PreferenciasAcessibilidade) {
  try {
    if (ehPadrao(p)) localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // sem armazenamento: vale só enquanto a página estiver aberta
  }
}

export const ehPadrao = (p: PreferenciasAcessibilidade) =>
  (Object.keys(PADRAO) as (keyof PreferenciasAcessibilidade)[]).every((k) => p[k] === PADRAO[k]);

/** Aplica as preferências no <html> (chamado antes de montar o app, para não piscar) */
export function aplicarPreferencias(p: PreferenciasAcessibilidade, raiz: HTMLElement = document.documentElement) {
  for (const [k, atributo] of Object.entries(ATRIBUTOS) as [keyof typeof ATRIBUTOS, string][]) {
    if (p[k]) raiz.setAttribute(atributo, '');
    else raiz.removeAttribute(atributo);
  }
  raiz.style.fontSize = p.fonte === FONTE_PADRAO ? '' : `${p.fonte}%`;
}

/** Próximo tamanho da fonte (passo +1 aumenta, -1 diminui), sem sair da escala */
export function proximoTamanho(atual: number, passo: 1 | -1): number {
  const lista = TAMANHOS_FONTE as readonly number[];
  const i = lista.indexOf(atual);
  const j = Math.min(lista.length - 1, Math.max(0, (i < 0 ? lista.indexOf(FONTE_PADRAO) : i) + passo));
  return lista[j];
}

export const formatarTamanho = (t: number) => `${String(t).replace('.', ',')}%`;
