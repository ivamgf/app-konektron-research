import type { DocumentoTriagem, Protocolo } from '../../lib/tipos';

/**
 * Similaridade de cada documento com o tema da pesquisa (fases 1 e 2 da triagem), calculada no
 * navegador, sem serviço externo nem custo: vetores TF-IDF com a similaridade do cosseno.
 *
 * - Perfil do protocolo: os dados do protocolo resumidos para a tarefa — tema, questão de pesquisa,
 *   objetivos, palavras-chave, termos das strings de busca e o resumo (um perfil por idioma).
 * - Documento: título + resumo + palavras-chave.
 * - Termos: minúsculas, sem acentos, sem palavras vazias (pt/en/es) e reduzidos ao radical por
 *   truncamento (6 letras), o que aproxima formas e idiomas: ontology/ontologies/ontologia → "ontolo".
 * - Peso TF-IDF com tf sublinear (1 + log tf) e IDF suavizado calculado sobre os documentos da etapa,
 *   para que termos comuns a quase todos (ex.: "data") pesem menos que os específicos do tema.
 * - Nota (0 a 1): o maior cosseno entre o documento e os perfis por idioma, posto numa escala
 *   calibrada (o cosseno bruto entre um resumo e um perfil de tema é baixo mesmo quando o assunto
 *   é o mesmo). Veja {@link escalaNota}. É sugestão: a decisão continua sendo do revisor.
 */

const PALAVRAS_VAZIAS = new Set(
  // inglês
  (
    'a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves using used use based via within across among new paper study studies approach results result proposed propose present presents article research however well may one two three ' +
    // português
    'ao aos as com como da das de dela dele deles do dos e ela elas ele eles em entre era essa esse esta este eu foi for foram ha isso isto ja la mais mas me mesmo meu minha muito na nas nem no nos nossa nosso num numa o os ou para pela pelas pelo pelos por qual quando que quem se sem ser seu seus sua suas tambem te tem ter teu tua um uma umas uns voce sobre ate apos estudo artigo trabalho pesquisa resultados proposta ' +
    // espanhol
    'al como con de del el en entre es esta este ha la las lo los mas mi muy no nos o otra otro para pero por que se ser si sin sobre su sus tambien un una unos unas y estudio articulo trabajo investigacion'
  ).split(/\s+/),
);

const RAIZ = 6;

/** minúsculas, sem acentos, em palavras; tira palavras vazias, números e palavras de 1–2 letras */
export function termosDoTexto(texto: string | null | undefined): string[] {
  const palavras = (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/);
  const out: string[] = [];
  for (const p of palavras) {
    if (p.length < 3 || /^\d+$/.test(p) || PALAVRAS_VAZIAS.has(p)) continue;
    out.push(p.length > RAIZ ? p.slice(0, RAIZ) : p);
  }
  return out;
}

type Vetor = Map<string, number>;

function frequencias(termos: string[]): Map<string, number> {
  const f = new Map<string, number>();
  for (const t of termos) f.set(t, (f.get(t) ?? 0) + 1);
  return f;
}

function pesar(freq: Map<string, number>, idf: (t: string) => number): Vetor {
  const v: Vetor = new Map();
  for (const [t, n] of freq) v.set(t, (1 + Math.log(n)) * idf(t));
  return v;
}

export function cosseno(a: Vetor, b: Vetor): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const x of a.values()) na += x * x;
  for (const x of b.values()) nb += x * x;
  if (!na || !nb) return 0;
  const [menor, maior] = a.size < b.size ? [a, b] : [b, a];
  for (const [t, x] of menor) {
    const y = maior.get(t);
    if (y) dot += x * y;
  }
  return dot / Math.sqrt(na * nb);
}

/** Um texto do perfil e o idioma dele (null = vale para todos os idiomas) */
export type TrechoPerfil = { rotulo: string; texto: string; idioma: string | null; peso: number };

/**
 * Os dados do protocolo resumidos para a comparação. Os campos que definem o tema (tema, questão,
 * objetivo geral, palavras-chave e termos das strings) pesam mais que o resumo, que costuma trazer
 * também método e números.
 */
export function perfilDoProtocolo(
  p:
    | Pick<
        Protocolo,
        'tema' | 'questaoPesquisa' | 'objetivoGeral' | 'objetivos' | 'palavrasChave' | 'strings' | 'resumos'
      >
    | null
    | undefined,
): TrechoPerfil[] {
  if (!p) return [];
  const t: TrechoPerfil[] = [];
  const add = (rotulo: string, texto: string | null | undefined, idioma: string | null, peso: number) => {
    if (texto?.trim()) t.push({ rotulo, texto: texto.trim(), idioma, peso });
  };
  add('Tema', p.tema, null, 3);
  add('Questão de pesquisa', p.questaoPesquisa, null, 2);
  add('Objetivo geral', p.objetivoGeral, null, 2);
  add('Objetivos específicos', (p.objetivos ?? []).map((o) => o.texto).join('; '), null, 1);
  const porIdioma = new Map<string, string[]>();
  for (const k of p.palavrasChave ?? []) {
    if (!k.termo?.trim()) continue;
    const id = k.idiomaId === null ? '' : String(k.idiomaId);
    porIdioma.set(id, [...(porIdioma.get(id) ?? []), k.termo.trim()]);
  }
  for (const [id, termos] of porIdioma) add('Palavras-chave', termos.join('; '), id || null, 3);
  const strings = [...new Set((p.strings ?? []).flatMap((s) => s.expressao.split(';')))]
    .map((s) =>
      s
        .replace(/\b(AND|OR|NOT)\b|[()"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
  if (strings.length) add('Termos das strings de busca', strings.join('; '), null, 3);
  for (const r of p.resumos ?? []) add(`Resumo (${r.idiomaNome})`, r.texto, String(r.idiomaId), 1);
  return t;
}

/** Texto do perfil para mostrar e editar (o usuário pode ajustar o que entra na comparação) */
export const textoDoPerfil = (perfil: TrechoPerfil[]) => perfil.map((t) => `${t.rotulo}: ${t.texto}`).join('\n\n');

/**
 * Cosseno bruto → nota de 0 a 1. Entre um resumo de artigo e o perfil do tema o cosseno TF-IDF
 * fica quase sempre abaixo de 0,25, mesmo quando o assunto é o mesmo. Calibrado com uma revisão
 * real (136 documentos): os incluídos tiveram cosseno mediano ≈ 0,10 e os excluídos ≈ 0,036.
 * A escala √(cosseno / 0,2), saturada em 1, põe os incluídos típicos em ≈ 0,7 e os excluídos
 * típicos em ≈ 0,4, mantendo a ordem entre os documentos.
 */
export const COSSENO_REFERENCIA = 0.2;
export const escalaNota = (c: number) => Math.min(1, Math.sqrt(Math.max(0, c) / COSSENO_REFERENCIA));

export type Similaridade = { nota: number; cosseno: number; termosComuns: string[] };

export type DocTexto = Pick<DocumentoTriagem, 'titulo' | 'resumo' | 'palavrasChave'>;

/**
 * Calcula a nota de cada documento. O perfil pode vir como trechos (calculados do protocolo) ou como
 * texto livre (o perfil ajustado pelo usuário), que então vale para todos os idiomas.
 */
export function similaridades<T extends DocTexto>(docs: T[], perfil: TrechoPerfil[] | string): Similaridade[] {
  const trechos: TrechoPerfil[] =
    typeof perfil === 'string'
      ? perfil.trim()
        ? // os rótulos ("Tema:", "Palavras-chave:") não entram na comparação
          [{ rotulo: '', texto: perfil.replace(/^[^:\n]{1,40}:\s/gm, ''), idioma: null, peso: 1 }]
        : []
      : perfil;
  if (!trechos.length) return docs.map(() => ({ nota: 0, cosseno: 0, termosComuns: [] }));

  // um perfil por idioma: trechos do idioma + os que valem para todos
  const idiomas = [...new Set(trechos.map((t) => t.idioma).filter((x): x is string => x !== null))];
  const perfis = (idiomas.length ? idiomas : [null]).map((id) => {
    const f = new Map<string, number>();
    for (const t of trechos) {
      if (t.idioma !== null && t.idioma !== id) continue;
      for (const [termo, n] of frequencias(termosDoTexto(t.texto))) f.set(termo, (f.get(termo) ?? 0) + n * t.peso);
    }
    return f;
  });

  const freqDocs = docs.map((d) => {
    // título e palavras-chave contam em dobro: dizem do que trata o texto
    const f = frequencias([
      ...termosDoTexto(d.titulo),
      ...termosDoTexto(d.titulo),
      ...termosDoTexto(d.palavrasChave),
      ...termosDoTexto(d.palavrasChave),
      ...termosDoTexto(d.resumo),
    ]);
    return f;
  });
  const df = new Map<string, number>();
  for (const f of [...freqDocs, ...perfis]) for (const t of f.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = freqDocs.length + perfis.length;
  const idf = (t: string) => Math.log((n + 1) / ((df.get(t) ?? 0) + 1)) + 1;
  const vetPerfis = perfis.map((f) => pesar(f, idf));

  return freqDocs.map((f) => {
    const v = pesar(f, idf);
    let melhor = 0;
    let perfil = vetPerfis[0];
    for (const p of vetPerfis) {
      const c = cosseno(v, p);
      if (c > melhor) [melhor, perfil] = [c, p];
    }
    const termosComuns = [...v.keys()]
      .filter((t) => perfil.has(t))
      .sort((a, b) => v.get(b)! * perfil.get(b)! - v.get(a)! * perfil.get(a)!)
      .slice(0, 8);
    return { nota: escalaNota(melhor), cosseno: melhor, termosComuns };
  });
}

/**
 * Limiar fixo da sugestão de seleção: só documentos com nota >= 0,7 são sugeridos (em verde).
 * Abaixo disso não há sugestão, mas o revisor pode selecionar qualquer documento pelo próprio julgamento.
 */
export const LIMIAR_SUGESTAO = 0.7;
export const ehSugeridoPorSimilaridade = (nota: number) => nota >= LIMIAR_SUGESTAO;
export function faixaNota(nota: number): 'alta' | 'baixa' {
  if (ehSugeridoPorSimilaridade(nota)) return 'alta';
  return 'baixa';
}
