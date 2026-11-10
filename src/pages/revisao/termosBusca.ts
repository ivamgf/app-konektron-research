import type { DocumentoTriagem, EtapaRevisao, Protocolo } from '../../lib/tipos';

/**
 * Verificação automática dos termos de busca nas fases 1 e 2 da triagem. O documento é sugerido para
 * inclusão quando atende à LÓGICA da string de busca do protocolo, com os operadores AND, OR e NOT e
 * os parênteses, considerando título, resumo e palavras-chave juntos: cada termo pode estar em
 * qualquer uma das três seções.
 *
 * Ex.: `(data analysis) AND (linked data) OR (natural disasters)` pede "data analysis" e
 * ("linked data" ou "natural disasters"). Com "data analysis" no título e no resumo e só
 * "natural disasters" nas palavras-chave, o documento atende.
 *
 * Precedência dos operadores (a das bases como a Scopus): OR liga mais forte que AND, e NOT/AND NOT
 * é o mais fraco. Por isso `A AND B OR C` = `A AND (B OR C)`. Palavras sem aspas e sem operador
 * entre elas formam uma expressão (`data analysis` = "data analysis"); `*` no fim é curinga.
 * Uma string pode ter versões em vários idiomas separadas por `;`: basta atender a uma delas.
 */

export type Onde = 'titulo' | 'resumo' | 'palavrasChave';
export const NOME_ONDE: Record<Onde, string> = { titulo: 'título', resumo: 'resumo', palavrasChave: 'palavras-chave' };

/** minúsculas, sem acentos, só letras/números separados por um espaço */
export const normalizar = (s: string | null | undefined) =>
  ` ${(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9*]+/g, ' ')
    .trim()} `;

/** O termo (palavra ou expressão; "ontolog*" vale como prefixo) aparece no texto já normalizado? */
export function contemTermo(textoNormalizado: string, termo: string): boolean {
  const t = normalizar(termo).trim();
  if (!t) return false;
  if (t.endsWith('*')) return textoNormalizado.includes(` ${t.slice(0, -1).trim()}`);
  return textoNormalizado.includes(` ${t} `);
}

/** Termos entre aspas nas strings de busca: "open data" AND ("ontology" OR "ontologies") */
export function termosDasStrings(expressoes: string[]): string[] {
  const termos = new Set<string>();
  for (const e of expressoes) for (const m of e.matchAll(/"([^"]+)"/g)) if (m[1].trim()) termos.add(m[1].trim());
  return [...termos];
}

// ------------------------------------------------------------------ expressão booleana

export type No =
  { tipo: 'termo'; termo: string } | { tipo: 'e' | 'ou'; filhos: No[] } | { tipo: 'nao'; base: No; excluir: No[] };

type Token = { t: '(' | ')' | 'AND' | 'OR' | 'NOT' } | { t: 'termo'; v: string; aspas: boolean };

function tokens(expr: string): Token[] {
  const out: Token[] = [];
  const re = /"([^"]*)"|“([^”]*)”|(\()|(\))|([^\s()"“”]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) {
    if (m[1] !== undefined || m[2] !== undefined) {
      const v = (m[1] ?? m[2]).trim();
      if (v) out.push({ t: 'termo', v, aspas: true });
    } else if (m[3]) out.push({ t: '(' });
    else if (m[4]) out.push({ t: ')' });
    else {
      const w = m[5];
      const u = w.toUpperCase();
      if (u === 'AND' || w === '&&') out.push({ t: 'AND' });
      else if (u === 'OR' || w === '||') out.push({ t: 'OR' });
      else if (u === 'NOT' || u === 'AND_NOT') out.push({ t: 'NOT' });
      // proximidade (W/3, PRE/2, NEAR/5) vale como AND
      else if (/^(W|PRE|NEAR|ADJ)\/?\d*$/i.test(w)) out.push({ t: 'AND' });
      // código de campo antes do parêntese: TITLE-ABS-KEY(, TS=(, ti:
      else if (/^[A-Z][A-Z-]*[=:]?$/.test(w) && expr[re.lastIndex] === '(' && w.length > 1) continue;
      else {
        const limpo = w.replace(/^[A-Za-z-]+[:=]/, '').replace(/[?$]/g, '*');
        // palavras soltas seguidas viram uma expressão
        const ant = out[out.length - 1];
        if (ant && ant.t === 'termo' && !ant.aspas) ant.v = `${ant.v} ${limpo}`;
        else if (limpo) out.push({ t: 'termo', v: limpo, aspas: false });
      }
    }
  }
  return out;
}

/** Lê a expressão (OR > AND > NOT). Parênteses faltando ou sobrando são tolerados. */
export function lerExpressao(expr: string): No | null {
  const tk = tokens(expr);
  let i = 0;
  const primario = (): No | null => {
    const x = tk[i];
    if (!x) return null;
    if (x.t === '(') {
      i++;
      const n = nao();
      if (tk[i]?.t === ')') i++;
      return n;
    }
    if (x.t === 'termo') {
      i++;
      return { tipo: 'termo', termo: x.v };
    }
    return null;
  };
  const ou = (): No | null => {
    const filhos: No[] = [];
    const a = primario();
    if (a) filhos.push(a);
    while (tk[i]?.t === 'OR') {
      i++;
      const b = primario();
      if (b) filhos.push(b);
    }
    return filhos.length > 1 ? { tipo: 'ou', filhos } : (filhos[0] ?? null);
  };
  const comeca = () => tk[i] && (tk[i].t === 'termo' || tk[i].t === '(');
  const e = (): No | null => {
    const filhos: No[] = [];
    const a = ou();
    if (a) filhos.push(a);
    for (;;) {
      if (tk[i]?.t === 'AND' && tk[i + 1]?.t !== 'NOT') i++;
      else if (!comeca()) break; // sem operador entre dois termos = AND
      const b = ou();
      if (!b) break;
      filhos.push(b);
    }
    return filhos.length > 1 ? { tipo: 'e', filhos } : (filhos[0] ?? null);
  };
  const nao = (): No | null => {
    const base = e();
    const excluir: No[] = [];
    for (;;) {
      if (tk[i]?.t === 'AND' && tk[i + 1]?.t === 'NOT') i += 2;
      else if (tk[i]?.t === 'NOT') i++;
      else break;
      const x = e();
      if (x) excluir.push(x);
    }
    if (!base) return null;
    return excluir.length ? { tipo: 'nao', base, excluir } : base;
  };
  const r = nao();
  // sobra (ex.: parêntese fechando a mais): continua lendo e junta com AND
  while (i < tk.length) {
    if (tk[i].t === ')' || tk[i].t === 'AND' || tk[i].t === 'OR' || tk[i].t === 'NOT') {
      i++;
      continue;
    }
    const mais = nao();
    if (!mais) break;
    return r ? { tipo: 'e', filhos: [r, mais] } : mais;
  }
  return r;
}

/** Texto legível da expressão, com os parênteses explícitos */
export function textoDoNo(n: No, raiz = true): string {
  if (n.tipo === 'termo') return n.termo;
  if (n.tipo === 'nao')
    return `${textoDoNo(n.base, false)} ${n.excluir.map((x) => `NOT ${textoDoNo(x, false)}`).join(' ')}`;
  const s = n.filhos.map((f) => textoDoNo(f, false)).join(n.tipo === 'e' ? ' AND ' : ' OR ');
  return raiz ? s : `(${s})`;
}

export function termosDoNo(n: No): string[] {
  if (n.tipo === 'termo') return [n.termo];
  if (n.tipo === 'nao') return [...termosDoNo(n.base), ...n.excluir.flatMap(termosDoNo)];
  return [...new Set(n.filhos.flatMap(termosDoNo))];
}

export type TextosDoc = Record<Onde, string>;
export const textosDoDocumento = (d: Pick<DocumentoTriagem, 'titulo' | 'resumo' | 'palavrasChave'>): TextosDoc => ({
  titulo: normalizar(d.titulo),
  resumo: normalizar(d.resumo),
  palavrasChave: normalizar(d.palavrasChave),
});

export const ondeAparece = (textos: TextosDoc, termo: string) =>
  (Object.keys(textos) as Onde[]).filter((o) => contemTermo(textos[o], termo));

export function avaliar(n: No, textos: TextosDoc): boolean {
  if (n.tipo === 'termo') return ondeAparece(textos, n.termo).length > 0;
  if (n.tipo === 'nao') return avaliar(n.base, textos) && !n.excluir.some((x) => avaliar(x, textos));
  return n.tipo === 'e' ? n.filhos.every((f) => avaliar(f, textos)) : n.filhos.some((f) => avaliar(f, textos));
}

// ------------------------------------------------------------------ strings do protocolo

/** Uma versão da string (um idioma) já lida */
export type ExpressaoBusca = { texto: string; no: No };

export type Clausula = { texto: string; ok: boolean; negada?: boolean };
export type ResultadoTermos = {
  sugerido: boolean;
  expressao: ExpressaoBusca;
  /** partes ligadas por AND (e as negadas por NOT): o que foi atendido e o que faltou */
  clausulas: Clausula[];
  encontrados: { termo: string; onde: Onde[] }[];
  faltando: string[];
};

/**
 * As expressões a conferir: cada string de busca do protocolo, separada em versões por `;`
 * (idiomas), sem repetições. Sem strings, usa as palavras-chave de cada idioma ligadas por AND.
 */
export function expressoesDoProtocolo(
  p: Pick<Protocolo, 'palavrasChave' | 'strings'> | undefined | null,
): ExpressaoBusca[] {
  if (!p) return [];
  const vistas = new Set<string>();
  const out: ExpressaoBusca[] = [];
  const add = (texto: string) => {
    const t = texto.trim();
    if (!t) return;
    const no = lerExpressao(t);
    if (!no) return;
    const chave = textoDoNo(no).toLowerCase();
    if (vistas.has(chave)) return;
    vistas.add(chave);
    out.push({ texto: t, no });
  };
  for (const s of p.strings ?? []) for (const parte of s.expressao.split(';')) add(parte);
  if (out.length) return out;
  const grupos = new Map<string, string[]>();
  for (const k of p.palavrasChave ?? []) {
    if (!k.termo?.trim()) continue;
    const chave = k.idiomaId === null ? '' : String(k.idiomaId);
    grupos.set(chave, [...(grupos.get(chave) ?? []), k.termo.trim()]);
  }
  const semIdioma = grupos.get('') ?? [];
  if (semIdioma.length && grupos.size > 1) grupos.delete('');
  for (const [k, termos] of grupos) {
    const todos = k ? [...new Set([...termos, ...semIdioma])] : termos;
    add(todos.map((t) => `"${t.replace(/"/g, '')}"`).join(' AND '));
  }
  return out;
}

function clausulas(n: No, textos: TextosDoc): Clausula[] {
  if (n.tipo === 'nao')
    return [
      ...clausulas(n.base, textos),
      ...n.excluir.map((x) => ({ texto: textoDoNo(x), ok: !avaliar(x, textos), negada: true })),
    ];
  const partes = n.tipo === 'e' ? n.filhos : [n];
  return partes.map((f) => ({ texto: textoDoNo(f), ok: avaliar(f, textos) }));
}

/** Confere o documento contra cada expressão e devolve a que ele atende (ou a que ficou mais perto) */
export function verificarTermos(
  d: Pick<DocumentoTriagem, 'titulo' | 'resumo' | 'palavrasChave'>,
  expressoes: ExpressaoBusca[],
): ResultadoTermos | null {
  if (!expressoes.length) return null;
  const textos = textosDoDocumento(d);
  let melhor: ResultadoTermos | null = null;
  let melhorNota = -1;
  for (const expressao of expressoes) {
    const termos = termosDoNo(expressao.no);
    const encontrados: ResultadoTermos['encontrados'] = [];
    const faltando: string[] = [];
    for (const termo of termos) {
      const onde = ondeAparece(textos, termo);
      if (onde.length) encontrados.push({ termo, onde });
      else faltando.push(termo);
    }
    const cl = clausulas(expressao.no, textos);
    const r: ResultadoTermos = {
      sugerido: avaliar(expressao.no, textos),
      expressao,
      clausulas: cl,
      encontrados,
      faltando,
    };
    if (r.sugerido) return r;
    const nota = cl.filter((c) => c.ok).length / cl.length + encontrados.length / (termos.length || 1) / 100;
    if (nota > melhorNota) [melhor, melhorNota] = [r, nota];
  }
  return melhor;
}

// ------------------------------------------------------------------ fases da triagem

/** Número da fase no nome da etapa: "Triagem F1 (...)" → 1; "Triagem F2/F3" → 2; "Fase 3" → 3 */
export function numeroDaFase(nome: string | null | undefined): number | null {
  const m = (nome ?? '').match(/\bF(?:ase)?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * Fases 1 e 2 da triagem: as etapas de triagem chamadas F1/F2 (ou Fase 1/2); sem o número no nome,
 * as duas primeiras etapas de triagem da revisão, pela ordem.
 */
export function ehFase1ou2(etapa: EtapaRevisao, etapas: EtapaRevisao[] | undefined): boolean {
  if (etapa.categoria !== 'TRIAGEM' || !etapa.exigeTriagem) return false;
  const fase = numeroDaFase(etapa.nome);
  if (fase !== null) return fase <= 2;
  if (!etapas?.length) return true;
  const triagens = etapas.filter((e) => e.categoria === 'TRIAGEM' && e.exigeTriagem).sort((a, b) => a.ordem - b.ordem);
  return triagens.slice(0, 2).some((e) => e.id === etapa.id);
}

/** Mensagem quando a ordem quebra a sequência F1 → F2 → F3 (ou null se está certa) */
export function erroOrdemDasFases(etapas: { nome: string }[]): string | null {
  let ant: { nome: string; f: number } | null = null;
  for (const e of etapas) {
    const f = numeroDaFase(e.nome);
    if (f === null) continue;
    if (ant && f < ant.f) return `"${e.nome}" deve vir antes de "${ant.nome}" (F1 → F2 → F3)`;
    ant = { nome: e.nome, f };
  }
  return null;
}
