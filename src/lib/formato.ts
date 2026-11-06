// Datas em dd/mm/aaaa no fuso America/Sao_Paulo (ERS 2.3 e seção de banco: a API grava em UTC)

const FUSO = 'America/Sao_Paulo';

/** "2026-11-05" (DATE) ou ISO completo → "05/11/2026" */
export function data(valor: string | null | undefined): string {
  if (!valor) return '—';
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: FUSO });
}

export function dataHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' });
}

export const ROTULOS: Record<string, string> = {
  // papéis
  RESPONSAVEL: 'Responsável',
  COLABORADOR: 'Colaborador',
  ORIENTADOR: 'Orientador',
  LEITOR: 'Leitor',
  ADMIN: 'Administrador',
  USUARIO: 'Usuário',
  // protocolo
  RASCUNHO: 'Rascunho',
  CONCLUIDO: 'Concluído',
  APROVADO: 'Aprovado',
  DEVOLVIDO: 'Devolvido',
  // projeto / revisão / etapa
  ATIVO: 'Ativo',
  ARQUIVADO: 'Arquivado',
  PLANEJADA: 'Planejada',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
  PENDENTE: 'Pendente',
  DISPENSADA: 'Dispensada',
  PROCESSANDO: 'Processando',
  ERRO: 'Erro',
  SEM_ARQUIVO: 'Sem arquivo',
  // categorias de etapa
  PROTOCOLO: 'Protocolo',
  BUSCA: 'Busca',
  DEDUPLICACAO: 'Deduplicação',
  TRIAGEM: 'Triagem',
  INCLUSAO: 'Inclusão',
  ANALISE: 'Análise',
  SINTESE: 'Síntese',
  DISCUSSAO: 'Discussão',
  CHECKLIST: 'Checklist',
  LIVRE: 'Livre',
  // triagem
  SELECIONADO: 'Selecionado',
  EXCLUIDO: 'Excluído',
  CRITERIO: 'Critério de exclusão',
  DUPLICADO: 'Duplicado',
  SEM_ACESSO: 'Sem acesso',
  OUTRO: 'Outro',
  EM_TRIAGEM: 'Em triagem',
  INCLUIDO: 'Incluído',
  // origem do documento
  REVISAO_ANTERIOR: 'Revisão anterior',
  INTEGRADO: 'Integrado',
  MANUAL: 'Manual',
  // campos de busca
  TITULO: 'Título',
  RESUMO: 'Resumo',
  PALAVRAS_CHAVE: 'Palavras-chave',
  TODOS: 'Todos os campos',
  // critérios
  INCLUSAO_CRIT: 'Inclusão',
  // análise
  NAO_INICIADO: 'Não iniciado',
  PARCIAL: 'Parcial',
  ABERTA: 'Aberta',
  INCLUIDOS_REVISAO: 'Incluídos da revisão',
  INTEGRADOS: 'Integrados e revisão anterior',
  REFERENCIAL_TEORICO: 'Referencial teórico',
  SELECAO_MANUAL: 'Seleção manual',
  // checklist
  ND: 'N/D',
  REALIZADO: 'Realizado',
  NAO_REALIZADO: 'Não realizado',
  // vocabulários
  DECS: 'DeCS',
  MESH: 'MeSH',
};

export const rotulo = (valor: string | null | undefined) => (valor ? (ROTULOS[valor] ?? valor) : '—');

/** Cor do badge por situação (ERS 8.3: verde = feito, vermelho = excluído, laranja = pendente, cinza = N/D) */
export function corDaSituacao(valor: string | null | undefined): string {
  switch (valor) {
    case 'CONCLUIDO':
    case 'CONCLUIDA':
    case 'APROVADO':
    case 'SELECIONADO':
    case 'REALIZADO':
    case 'INCLUIDO':
      return 'success';
    case 'EXCLUIDO':
    case 'NAO_REALIZADO':
    case 'ERRO':
    case 'CANCELADA':
    case 'DEVOLVIDO':
      return 'danger';
    case 'PENDENTE':
    case 'PARCIAL':
    case 'EM_ANDAMENTO':
    case 'PROCESSANDO':
    case 'RASCUNHO':
      return 'warning';
    case 'EM_TRIAGEM':
    case 'ATIVO':
    case 'ABERTA':
      return 'primary';
    default:
      return 'secondary';
  }
}

export const ICONE_SITUACAO: Record<string, string> = {
  success: 'bi-check-circle-fill',
  danger: 'bi-x-circle-fill',
  warning: 'bi-exclamation-circle',
  secondary: 'bi-dash-circle',
  primary: 'bi-circle',
};

/** Papéis que editam o conteúdo do projeto (RN da API: EDITA) */
export const podeEditar = (papel?: string | null) =>
  papel === 'RESPONSAVEL' || papel === 'COLABORADOR' || papel === 'ADMIN';
export const ehDono = (papel?: string | null) => papel === 'RESPONSAVEL' || papel === 'ADMIN';
