import type { DocumentoTriagem, EtapaRevisao, Protocolo } from '../../lib/tipos';

/**
 * Verificação automática dos termos de busca nas fases 1 e 2 da triagem: o documento é sugerido
 * para inclusão quando TODOS os termos de um grupo aparecem nele, cada um no título, no resumo ou
 * nas palavras-chave (ex.: termo 1 no título, termos 1 e 2 no resumo, termo 3 nas palavras-chave).
 * Os grupos são por idioma: termos em português, inglês e espanhol não precisam aparecer juntos.
 */

export type Onde = 'titulo' | 'resumo' | 'palavrasChave';
export const NOME_ONDE: Record<Onde, string> = { titulo: 'título', resumo: 'resumo', palavrasChave: 'palavras-chave' };

export type GrupoTermos = { idioma: string; termos: string[] };
export type ResultadoTermos = {
  sugerido: boolean;
  grupo: GrupoTermos;
  encontrados: { termo: string; onde: Onde[] }[];
  faltando: string[];
};

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

/**
 * Grupos de termos do protocolo: as palavras-chave usadas nas strings de busca (todas, se nenhuma
 * aparece nas strings), agrupadas por idioma. Sem palavras-chave, usa os termos entre aspas das strings.
 */
export function gruposDoProtocolo(p: Pick<Protocolo, 'palavrasChave' | 'strings'> | undefined | null): GrupoTermos[] {
  if (!p) return [];
  const expressoes = (p.strings ?? []).map((s) => s.expressao);
  const textoStrings = normalizar(expressoes.join(' '));
  const palavras = (p.palavrasChave ?? []).filter((k) => k.termo?.trim());
  const nasStrings = palavras.filter((k) => contemTermo(textoStrings, k.termo));
  const usadas = nasStrings.length ? nasStrings : palavras;
  if (!usadas.length) {
    const termos = termosDasStrings(expressoes);
    return termos.length ? [{ idioma: 'strings', termos }] : [];
  }
  const grupos = new Map<string, string[]>();
  for (const k of usadas) {
    const chave = k.idiomaId === null ? 'sem-idioma' : String(k.idiomaId);
    grupos.set(chave, [...(grupos.get(chave) ?? []), k.termo.trim()]);
  }
  // termos sem idioma valem para todos os grupos de idioma
  const semIdioma = grupos.get('sem-idioma') ?? [];
  if (semIdioma.length && grupos.size > 1) {
    grupos.delete('sem-idioma');
    for (const [k, v] of grupos) grupos.set(k, [...new Set([...v, ...semIdioma])]);
  }
  return [...grupos].map(([idioma, termos]) => ({ idioma, termos: [...new Set(termos)] }));
}

/** Confere o documento contra cada grupo e devolve o melhor (o que atende ou o que tem mais termos) */
export function verificarTermos(
  d: Pick<DocumentoTriagem, 'titulo' | 'resumo' | 'palavrasChave'>,
  grupos: GrupoTermos[],
): ResultadoTermos | null {
  if (!grupos.length) return null;
  const textos: Record<Onde, string> = {
    titulo: normalizar(d.titulo),
    resumo: normalizar(d.resumo),
    palavrasChave: normalizar(d.palavrasChave),
  };
  let melhor: ResultadoTermos | null = null;
  for (const grupo of grupos) {
    const encontrados: ResultadoTermos['encontrados'] = [];
    const faltando: string[] = [];
    for (const termo of grupo.termos) {
      const onde = (Object.keys(textos) as Onde[]).filter((o) => contemTermo(textos[o], termo));
      if (onde.length) encontrados.push({ termo, onde });
      else faltando.push(termo);
    }
    const r = { sugerido: faltando.length === 0, grupo, encontrados, faltando };
    if (r.sugerido) return r;
    if (!melhor || encontrados.length / grupo.termos.length > melhor.encontrados.length / melhor.grupo.termos.length)
      melhor = r;
  }
  return melhor;
}

/** Fases 1 e 2 da triagem: as duas primeiras etapas de triagem da revisão, pela ordem */
export function ehFase1ou2(etapa: EtapaRevisao, etapas: EtapaRevisao[] | undefined): boolean {
  if (etapa.categoria !== 'TRIAGEM' || !etapa.exigeTriagem) return false;
  if (!etapas?.length) return true;
  const triagens = etapas.filter((e) => e.categoria === 'TRIAGEM' && e.exigeTriagem).sort((a, b) => a.ordem - b.ordem);
  return triagens.slice(0, 2).some((e) => e.id === etapa.id);
}
