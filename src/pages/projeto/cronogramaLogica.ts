/**
 * Cronograma do projeto (mesmas regras da API em modules/relatorio/cronograma.ts):
 * etapas (linhas) x períodos (colunas). As marcações ficam por mês ("AAAA-MM"), então trocar a
 * granularidade não perde nada: um período aparece marcado quando algum mês dele está marcado.
 */

export const GRANULARIDADES = {
  MENSAL: { porAno: 12, rotulo: 'Mensal', periodo: 'mês', curto: '' },
  BIMESTRAL: { porAno: 6, rotulo: 'Bimestral', periodo: 'bimestre', curto: 'Bim' },
  TRIMESTRAL: { porAno: 4, rotulo: 'Trimestral', periodo: 'trimestre', curto: 'Trim' },
  QUADRIMESTRAL: { porAno: 3, rotulo: 'Quadrimestral', periodo: 'quadrimestre', curto: 'Quad' },
  SEMESTRAL: { porAno: 2, rotulo: 'Semestral', periodo: 'semestre', curto: 'Sem' },
  ANUAL: { porAno: 1, rotulo: 'Anual', periodo: 'ano', curto: '' },
} as const;
export type Granularidade = keyof typeof GRANULARIDADES;
export const LISTA_GRANULARIDADES = Object.keys(GRANULARIDADES) as Granularidade[];

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONGOS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
export const MAX_ANOS = 21;

export type OrigemEtapa = 'REVISAO' | 'PESQUISA' | 'LIVRE';
export type EtapaCronograma = {
  id: string;
  nome: string;
  origem: OrigemEtapa;
  revisaoEtapaId?: string | null;
  meses: string[];
};
export type DadosCronograma = {
  granularidade: Granularidade;
  anoInicio: number;
  anoFim: number;
  etapas: EtapaCronograma[];
  ocultarVazias?: boolean;
};
export type Periodo = {
  chave: string;
  ano: number;
  indice: number;
  rotulo: string;
  descricao: string;
  meses: string[];
};

export type EtapaDaRevisao = {
  id: string;
  nome: string;
  ordem: number;
  categoria: string;
  status: string;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  revisaoId: string;
  revisaoTitulo: string;
};
export type SugestoesCronograma = {
  dataInicio: string | null;
  dataFim: string | null;
  etapasRevisao: EtapaDaRevisao[];
};

/** Etapas típicas de uma pesquisa de pós-graduação (como no cronograma do projeto de pesquisa) */
export const ETAPAS_PESQUISA = [
  'Disciplinas',
  'Estágio de docência',
  'Elaboração do protocolo',
  'Revisão de literatura',
  'Qualificação',
  'Análise de frameworks e ferramentas',
  'Desenvolvimento dos artefatos',
  'Testes com usuários',
  'Coleta de dados',
  'Análise dos dados',
  'Estágio de pesquisa',
  'Redação da tese',
  'Redação da dissertação',
  'Comunicação científica (artigos)',
  'Defesa',
  'Entrega da versão final',
];

const mes = (ano: number, m: number) => `${ano}-${String(m).padStart(2, '0')}`;

export function periodosDoAno(g: Granularidade, ano: number): Periodo[] {
  const { porAno, curto } = GRANULARIDADES[g];
  const tamanho = 12 / porAno;
  return Array.from({ length: porAno }, (_, i) => {
    const meses = Array.from({ length: tamanho }, (_, k) => mes(ano, i * tamanho + k + 1));
    const rotulo = g === 'MENSAL' ? MESES[i] : g === 'ANUAL' ? String(ano) : `${curto} ${i + 1}`;
    const descricao =
      g === 'MENSAL'
        ? `${MESES_LONGOS[i]} de ${ano}`
        : g === 'ANUAL'
          ? String(ano)
          : `${i + 1}º ${GRANULARIDADES[g].periodo} de ${ano} (${MESES_LONGOS[i * tamanho]} a ${MESES_LONGOS[i * tamanho + tamanho - 1]})`;
    return { chave: `${ano}-${g[0]}${i + 1}`, ano, indice: i, rotulo, descricao, meses };
  });
}

export const anosDe = (d: Pick<DadosCronograma, 'anoInicio' | 'anoFim'>) =>
  Array.from({ length: Math.max(0, d.anoFim - d.anoInicio + 1) }, (_, i) => d.anoInicio + i);

export const periodoMarcado = (e: Pick<EtapaCronograma, 'meses'>, p: Pick<Periodo, 'meses'>) =>
  p.meses.some((m) => e.meses.includes(m));

/** Marca (ou desmarca) todos os meses do período na etapa */
export function marcarPeriodo(e: EtapaCronograma, p: Pick<Periodo, 'meses'>, marcar: boolean): EtapaCronograma {
  const meses = new Set(e.meses);
  for (const m of p.meses) {
    if (marcar) meses.add(m);
    else meses.delete(m);
  }
  return { ...e, meses: [...meses].sort() };
}

/** Meses de um intervalo de datas (inclusive) */
export function mesesEntre(inicio: string, fim: string): string[] {
  const [ai, mi] = inicio.slice(0, 7).split('-').map(Number);
  const [af, mf] = fim.slice(0, 7).split('-').map(Number);
  const out: string[] = [];
  for (let a = ai, m = mi; a < af || (a === af && m <= mf); m === 12 ? ((m = 1), a++) : m++) {
    out.push(mes(a, m));
    if (out.length > 12 * MAX_ANOS) break;
  }
  return out;
}

export const intervaloDaEtapa = (e: Pick<EtapaCronograma, 'meses'>) => {
  if (!e.meses.length) return null;
  const ord = [...e.meses].sort();
  return { inicio: ord[0], fim: ord[ord.length - 1] };
};

export const mesCurto = (m: string) => {
  const [a, n] = m.split('-');
  return `${MESES[Number(n) - 1].toLowerCase()}/${a}`;
};

/** Primeiro rascunho: anos do período do projeto (ou o ano atual e o seguinte) e granularidade trimestral */
export function cronogramaInicial(s: SugestoesCronograma | undefined, hoje = new Date()): DadosCronograma {
  const ano = hoje.getFullYear();
  const ini = s?.dataInicio ? Number(s.dataInicio.slice(0, 4)) : ano;
  const fim = s?.dataFim ? Number(s.dataFim.slice(0, 4)) : Math.max(ini, ano) + 1;
  return {
    granularidade: 'TRIMESTRAL',
    anoInicio: ini,
    anoFim: Math.min(Math.max(fim, ini), ini + MAX_ANOS - 1),
    etapas: [],
    ocultarVazias: true,
  };
}

let seq = 0;
export const novoId = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`;

export const novaEtapa = (
  nome: string,
  origem: OrigemEtapa,
  revisaoEtapaId: string | null = null,
): EtapaCronograma => ({
  id: novoId(),
  nome: nome.trim().slice(0, 200),
  origem,
  revisaoEtapaId,
  meses: [],
});

/**
 * Meses em que uma etapa de revisão foi executada, pelas datas registradas:
 * de iniciada a concluída; em andamento, até o mês atual.
 */
export function mesesDaEtapaRevisao(
  e: Pick<EtapaDaRevisao, 'iniciadaEm' | 'concluidaEm'>,
  hoje = new Date(),
): string[] {
  if (!e.iniciadaEm) return [];
  const fim = e.concluidaEm ?? mes(hoje.getFullYear(), hoje.getMonth() + 1);
  return fim < e.iniciadaEm.slice(0, 7) ? [e.iniciadaEm.slice(0, 7)] : mesesEntre(e.iniciadaEm, fim);
}

/** Preenche as etapas vindas das revisões com as datas de início e conclusão registradas */
export function preencherPelasDatas(
  d: DadosCronograma,
  etapas: EtapaDaRevisao[],
  hoje = new Date(),
): { dados: DadosCronograma; preenchidas: number } {
  let preenchidas = 0;
  const porId = new Map(etapas.map((e) => [e.id, e]));
  const novas = d.etapas.map((e) => {
    const r = e.revisaoEtapaId ? porId.get(e.revisaoEtapaId) : undefined;
    const meses = r
      ? mesesDaEtapaRevisao(r, hoje).filter((m) => anoDoMes(m) >= d.anoInicio && anoDoMes(m) <= d.anoFim)
      : [];
    if (!meses.length) return e;
    preenchidas++;
    return { ...e, meses: [...new Set([...e.meses, ...meses])].sort() };
  });
  return { dados: { ...d, etapas: novas }, preenchidas };
}

const anoDoMes = (m: string) => Number(m.slice(0, 4));

/** Mudança dos anos: avisa quantas marcações ficariam fora do novo intervalo */
export function marcacoesForaDosAnos(d: DadosCronograma, anoInicio: number, anoFim: number) {
  return d.etapas.reduce(
    (s, e) => s + e.meses.filter((m) => anoDoMes(m) < anoInicio || anoDoMes(m) > anoFim).length,
    0,
  );
}

export function moverEtapa(d: DadosCronograma, id: string, delta: -1 | 1): DadosCronograma {
  const i = d.etapas.findIndex((e) => e.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= d.etapas.length) return d;
  const etapas = [...d.etapas];
  [etapas[i], etapas[j]] = [etapas[j], etapas[i]];
  return { ...d, etapas };
}

/** Normaliza o que vem da API (rascunho antigo ou incompleto) */
export function completarCronograma(
  salvo: Partial<DadosCronograma> | null | undefined,
  s?: SugestoesCronograma,
): DadosCronograma {
  const base = cronogramaInicial(s);
  if (!salvo) return base;
  const granularidade =
    salvo.granularidade && salvo.granularidade in GRANULARIDADES ? salvo.granularidade : base.granularidade;
  return {
    granularidade,
    anoInicio: salvo.anoInicio ?? base.anoInicio,
    anoFim: salvo.anoFim ?? base.anoFim,
    ocultarVazias: salvo.ocultarVazias ?? true,
    etapas: (salvo.etapas ?? []).map((e) => ({ ...e, meses: [...(e.meses ?? [])].sort() })),
  };
}

/** Pronto para salvar: tira meses fora dos anos e etapas sem nome */
export function paraSalvar(d: DadosCronograma): DadosCronograma {
  return {
    ...d,
    etapas: d.etapas
      .filter((e) => e.nome.trim())
      .map((e) => ({
        ...e,
        nome: e.nome.trim(),
        meses: [...new Set(e.meses)].filter((m) => anoDoMes(m) >= d.anoInicio && anoDoMes(m) <= d.anoFim).sort(),
      })),
  };
}
