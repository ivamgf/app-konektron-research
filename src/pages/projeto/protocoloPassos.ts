import type { CampoBusca, Protocolo } from '../../lib/tipos';

// RF07: os 8 passos do assistente
export const PASSOS = [
  { n: 1, titulo: 'Tema e questão' },
  { n: 2, titulo: 'Outras questões' },
  { n: 3, titulo: 'Hipótese' },
  { n: 4, titulo: 'Objetivos' },
  { n: 5, titulo: 'Justificativa' },
  { n: 6, titulo: 'Palavras-chave' },
  { n: 7, titulo: 'Strings de busca' },
  { n: 8, titulo: 'Descritores' },
] as const;

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
  };
}

const texto = (v: string) => (v.trim() ? v : null);

/**
 * Corpo do PUT /projetos/:id/protocolo para o passo (RF08: rascunho salvo a cada passo).
 * Itens de lista em branco são descartados (a API exige texto em cada item).
 */
export function corpoDoPasso(passo: number, r: Rascunho, proximoPasso: number) {
  const base = { passoAtual: Math.min(8, Math.max(1, proximoPasso)) };
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
  };
}
