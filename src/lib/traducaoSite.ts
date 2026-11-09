/**
 * Tradução automática da interface (português → inglês ou espanhol) pelo tradutor de sites do
 * Google. A escolha fica no cookie "googtrans" (o próprio tradutor o lê ao carregar) e no
 * localStorage; trocar de idioma recarrega a página para aplicar em tudo.
 */

export const IDIOMAS_SITE = [
  { codigo: 'pt', nome: 'Português', curto: 'PT', lang: 'pt-BR' },
  { codigo: 'en', nome: 'English', curto: 'EN', lang: 'en' },
  { codigo: 'es', nome: 'Español', curto: 'ES', lang: 'es' },
] as const;
export type IdiomaSite = (typeof IDIOMAS_SITE)[number]['codigo'];

const CHAVE = 'konektron.idioma';
const SCRIPT = 'https://translate.google.com/translate_a/element.js?cb=konektronIniciarTradutor';

const valido = (v: unknown): v is IdiomaSite => IDIOMAS_SITE.some((i) => i.codigo === v);

/** Idioma escolhido: cookie do tradutor (/pt/en) ou o salvo no navegador; padrão português */
export function idiomaAtual(): IdiomaSite {
  const cookie = /(?:^|;\s*)googtrans=\/pt\/([a-z-]+)/.exec(document.cookie)?.[1];
  if (valido(cookie)) return cookie;
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (valido(salvo)) return salvo;
  } catch {
    // navegador sem localStorage
  }
  return 'pt';
}

function gravarCookie(valor: string | null) {
  const dominios = ['', location.hostname, `.${location.hostname.split('.').slice(-2).join('.')}`];
  for (const d of dominios) {
    const dominio = d ? `; domain=${d}` : '';
    document.cookie = valor
      ? `googtrans=${valor}; path=/${dominio}; max-age=31536000; SameSite=Lax`
      : `googtrans=; path=/${dominio}; max-age=0`;
  }
}

/** Troca o idioma da interface e recarrega a página */
export function trocarIdioma(codigo: IdiomaSite) {
  try {
    localStorage.setItem(CHAVE, codigo);
  } catch {
    // ignora: o cookie basta
  }
  gravarCookie(codigo === 'pt' ? null : `/pt/${codigo}`);
  location.reload();
}

/**
 * O tradutor troca nós de texto do DOM; quando o React depois tenta remover ou inserir ao lado
 * de um nó que já não está onde ele espera, dá erro. Esta proteção (recomendada pela equipe do
 * React, issue #11538) só é ligada com a tradução ativa.
 */
function protegerReact() {
  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, filho: T): T {
    if (filho.parentNode !== this) return filho;
    return removeChild.call(this, filho) as T;
  };
  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, novo: T, referencia: Node | null): T {
    if (referencia && referencia.parentNode !== this) return novo;
    return insertBefore.call(this, novo, referencia) as T;
  };
}

/** Chamado uma vez, antes de montar o app: carrega o tradutor só se o idioma não for português */
export function iniciarTraducaoDoSite() {
  const idioma = idiomaAtual();
  document.documentElement.lang = idioma === 'pt' ? 'pt-BR' : idioma;
  if (idioma === 'pt') return;
  gravarCookie(`/pt/${idioma}`);
  protegerReact();
  const alvo = document.createElement('div');
  alvo.id = 'google_translate_element';
  alvo.style.display = 'none';
  document.body.appendChild(alvo);
  (window as unknown as Record<string, unknown>).konektronIniciarTradutor = () => {
    const g = (window as unknown as { google?: any }).google;
    if (!g?.translate?.TranslateElement) return;
    new g.translate.TranslateElement(
      { pageLanguage: 'pt', includedLanguages: 'en,es', autoDisplay: false },
      'google_translate_element',
    );
  };
  const s = document.createElement('script');
  s.src = SCRIPT;
  s.async = true;
  s.onerror = () => console.warn('Tradução automática indisponível (o tradutor não carregou).');
  document.head.appendChild(s);
}
