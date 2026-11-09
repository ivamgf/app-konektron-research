import type { CampoBusca, Protocolo } from '../../lib/tipos';

// RF07: os passos do assistente (9 e 10 acrescentados depois: metodologia; riscos, benefícios e resultados)
export const PASSOS = [
  { n: 1, titulo: 'Tema e questão' },
  { n: 2, titulo: 'Outras questões' },
  { n: 3, titulo: 'Hipótese' },
  { n: 4, titulo: 'Objetivos' },
  { n: 5, titulo: 'Justificativa' },
  { n: 6, titulo: 'Palavras-chave' },
  { n: 7, titulo: 'Strings de busca' },
  { n: 8, titulo: 'Descritores' },
  { n: 9, titulo: 'Metodologia' },
  { n: 10, titulo: 'Riscos, benefícios e resultados' },
] as const;
export const TOTAL_PASSOS = PASSOS.length;

/** Tipos de metodologia (mesmos códigos da API) */
export const METODOLOGIAS: [string, string][] = [
  ['DSR', 'Design Science Research (DSR)'],
  ['QUANTITATIVA', 'Pesquisa quantitativa'],
  ['QUALITATIVA', 'Pesquisa qualitativa'],
  ['MISTA', 'Métodos mistos (quali-quantitativa)'],
  ['REVISAO_SISTEMATICA', 'Revisão sistemática da literatura'],
  ['REVISAO_INTEGRATIVA', 'Revisão integrativa'],
  ['REVISAO_ESCOPO', 'Revisão de escopo (scoping review)'],
  ['REVISAO_NARRATIVA', 'Revisão narrativa'],
  ['BIBLIOMETRIA', 'Estudo bibliométrico'],
  ['ESTUDO_CASO', 'Estudo de caso'],
  ['PESQUISA_ACAO', 'Pesquisa-ação'],
  ['EXPERIMENTAL', 'Pesquisa experimental'],
  ['QUASE_EXPERIMENTAL', 'Pesquisa quase-experimental'],
  ['SURVEY', 'Levantamento (survey)'],
  ['ETNOGRAFIA', 'Etnografia'],
  ['TEORIA_FUNDAMENTADA', 'Teoria fundamentada (grounded theory)'],
  ['FENOMENOLOGIA', 'Pesquisa fenomenológica'],
  ['DOCUMENTAL', 'Pesquisa documental'],
  ['BIBLIOGRAFICA', 'Pesquisa bibliográfica'],
  ['EXPLORATORIA', 'Pesquisa exploratória'],
  ['DESCRITIVA', 'Pesquisa descritiva'],
  ['EXPLICATIVA', 'Pesquisa explicativa'],
  ['DELPHI', 'Método Delphi'],
  ['OUTRA', 'Outra'],
];

export type Rascunho = {
  tema: string;
  questaoPesquisa: string;
  hipotese: string;
  objetivoGeral: string;
  justificativa: string;
  outrasQuestoes: { texto: string }[];
  objetivos: { texto: string }[];
  palavrasChave: { termo: string; idiomaId: number | null }[];
  strings: { baseDadosId: string | null; campo: CampoBusca; expressao: string }[];
  descritores: { termo: string; vocabulario: 'DECS' | 'MESH' | 'LIVRE'; codigo: string }[];
  metodologiaTipo: string;
  metodologiaOutro: string;
  metodologia: string;
  riscos: string;
  beneficios: string;
  resultadosEsperados: string;
};

export function rascunhoDe(p: Protocolo): Rascunho {
  return {
    tema: p.tema ?? '',
    questaoPesquisa: p.questaoPesquisa ?? '',
    hipotese: p.hipotese ?? '',
    objetivoGeral: p.objetivoGeral ?? '',
    justificativa: p.justificativa ?? '',
    outrasQuestoes: p.outrasQuestoes.map((x) => ({ texto: x.texto })),
    objetivos: p.objetivos.map((x) => ({ texto: x.texto })),
    palavrasChave: p.palavrasChave.map((x) => ({ termo: x.termo, idiomaId: x.idiomaId })),
    strings: p.strings.map((x) => ({ baseDadosId: x.baseDadosId, campo: x.campo, expressao: x.expressao })),
    descritores: p.descritores.map((x) => ({ termo: x.termo, vocabulario: x.vocabulario, codigo: x.codigo ?? '' })),
    metodologiaTipo: p.metodologiaTipo ?? '',
    metodologiaOutro: p.metodologiaOutro ?? '',
    metodologia: p.metodologia ?? '',
    riscos: p.riscos ?? '',
    beneficios: p.beneficios ?? '',
    resultadosEsperados: p.resultadosEsperados ?? '',
  };
}

const texto = (v: string) => (v.trim() ? v : null);

/**
 * Corpo do PUT /projetos/:id/protocolo para o passo (RF08: rascunho salvo a cada passo).
 * Itens de lista em branco são descartados (a API exige texto em cada item).
 */
export function corpoDoPasso(passo: number, r: Rascunho, proximoPasso: number) {
  const base = { passoAtual: Math.min(TOTAL_PASSOS, Math.max(1, proximoPasso)) };
  switch (passo) {
    case 1:
      return { ...base, tema: texto(r.tema), questaoPesquisa: texto(r.questaoPesquisa) };
    case 2:
      return { ...base, outrasQuestoes: r.outrasQuestoes.filter((x) => x.texto.trim()) };
    case 3:
      return { ...base, hipotese: texto(r.hipotese) };
    case 4:
      return { ...base, objetivoGeral: texto(r.objetivoGeral), objetivos: r.objetivos.filter((x) => x.texto.trim()) };
    case 5:
      return { ...base, justificativa: texto(r.justificativa) };
    case 6:
      return { ...base, palavrasChave: r.palavrasChave.filter((x) => x.termo.trim()) };
    case 7:
      return { ...base, strings: r.strings.filter((x) => x.expressao.trim()) };
    case 8:
      return {
        ...base,
        descritores: r.descritores.filter((x) => x.termo.trim()).map((x) => ({ ...x, codigo: texto(x.codigo) })),
      };
    case 9:
      return {
        ...base,
        metodologiaTipo: r.metodologiaTipo || null,
        metodologiaOutro: r.metodologiaTipo === 'OUTRA' ? texto(r.metodologiaOutro) : null,
        metodologia: texto(r.metodologia),
      };
    case 10:
      return {
        ...base,
        riscos: texto(r.riscos),
        beneficios: texto(r.beneficios),
        resultadosEsperados: texto(r.resultadosEsperados),
      };
    default:
      return base;
  }
}

/** Passo a passo, quais estão preenchidos (para o check do stepper) */
export function passosPreenchidos(r: Rascunho): Record<number, boolean> {
  return {
    1: !!(r.tema.trim() && r.questaoPesquisa.trim()),
    2: r.outrasQuestoes.some((x) => x.texto.trim()),
    3: !!r.hipotese.trim(),
    4: !!r.objetivoGeral.trim() && r.objetivos.some((x) => x.texto.trim()),
    5: !!r.justificativa.trim(),
    6: r.palavrasChave.filter((x) => x.termo.trim()).length >= 3,
    7: r.strings.some((x) => x.expressao.trim()),
    8: r.descritores.some((x) => x.termo.trim()),
    9: !!r.metodologiaTipo && (r.metodologiaTipo !== 'OUTRA' || !!r.metodologiaOutro.trim()),
    10: !!r.resultadosEsperados.trim(),
  };
}
