import { useQuery } from '@tanstack/react-query';
import { get } from './api';

/** Planos de uso (mesmas regras da API em modules/planos). O "vitalício" é interno e não aparece aqui. */
export type Plano = 'FREE' | 'STANDARD' | 'MASTER';
export type Recurso = 'QUESTOES' | 'ANALISES' | 'ARTIGO' | 'TCLE' | 'SIMILARIDADE' | 'VERIFICACAO_TERMOS';

export const NOME_RECURSO: Record<Recurso, string> = {
  QUESTOES: 'Aba Questões',
  ANALISES: 'Aba Análises (matriz de síntese, discussão e comparativo)',
  ARTIGO: 'Gerador de artigo',
  TCLE: 'Gerador de TCLE',
  SIMILARIDADE: 'Sugestão por similaridade na triagem',
  VERIFICACAO_TERMOS: 'Verificação dos termos de busca em títulos, resumos e palavras-chave',
};

export type ResumoPlano = {
  plano: Plano;
  limiteProjetos: number | null;
  /** membros por projeto além do responsável */
  limiteMembros: number | null;
  limiteArmazenamentoMb: number;
  armazenamentoUsadoBytes: number;
  projetosUsados: number;
  podeCriarProjeto: boolean;
  /** plano gratuito: quando os projetos serão removidos (null se não se aplica) */
  expiraEm: string | null;
  bloqueado: boolean;
  recursos: Recurso[];
};

type InfoPlano = {
  id: Plano;
  nome: string;
  mensal: number | null;
  anual: number | null;
  resumo: string;
  inclui: string[];
  naoInclui: Recurso[];
  destaque?: boolean;
};

export const PLANOS: InfoPlano[] = [
  {
    id: 'FREE',
    nome: 'Free',
    mensal: null,
    anual: null,
    resumo: 'Para conhecer o Konektron.',
    inclui: [
      'Até 3 projetos',
      '1 membro por projeto, além de você',
      '500 MB para PDFs e arquivos',
      'Integração com IA (com a sua conta ou chave)',
      'Protocolo, questões, critérios, documentos e referências',
      'Revisões em etapas, buscas, duplicados e triagem',
      'Os projetos ficam 3 meses no sistema depois de atingido o limite',
    ],
    naoInclui: ['ANALISES', 'ARTIGO', 'TCLE', 'SIMILARIDADE', 'VERIFICACAO_TERMOS'],
  },
  {
    id: 'STANDARD',
    nome: 'Standard',
    mensal: 49.9,
    anual: 499,
    resumo: 'Para quem conduz revisões com frequência.',
    inclui: [
      'Projetos ilimitados',
      'Até 5 membros por projeto, além de você',
      '5 GB para PDFs e arquivos',
      'Integração com IA (com a sua conta ou chave)',
      'Protocolo, questões, critérios, documentos e referências',
      'Revisões em etapas, buscas, duplicados e triagem',
      'Equipe, papéis e auditoria',
    ],
    naoInclui: ['ANALISES', 'ARTIGO', 'TCLE', 'SIMILARIDADE', 'VERIFICACAO_TERMOS'],
  },
  {
    id: 'MASTER',
    nome: 'Master',
    mensal: 99.9,
    anual: 999,
    resumo: 'Acesso ilimitado a tudo.',
    inclui: [
      'Tudo do Standard',
      'Membros ilimitados e 20 GB para arquivos',
      'Aba Análises (matriz de síntese, discussão e comparativo)',
      'Gerador de artigo e gerador de TCLE',
      'Sugestão por similaridade e verificação dos termos de busca na triagem',
    ],
    naoInclui: [],
    destaque: true,
  },
];

export const nomePlano = (p: Plano) => PLANOS.find((x) => x.id === p)?.nome ?? p;
export const preco = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Espaço em MB ou GB */
export const tamanho = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
    : `${Math.round(bytes / 1024 ** 2).toLocaleString('pt-BR')} MB`;

export const chavePlano = ['me', 'plano'] as const;
export const usePlano = (ativo = true) =>
  useQuery({ queryKey: chavePlano, queryFn: () => get<ResumoPlano>('/me/plano'), enabled: ativo });

/** O projeto tem o recurso? (a API manda os recursos do plano do dono no GET /projetos/:id) */
export const temRecurso = (p: { recursos?: Recurso[] }, r: Recurso) => !p.recursos || p.recursos.includes(r);
