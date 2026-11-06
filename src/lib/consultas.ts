import { useQuery } from '@tanstack/react-query';
import { get } from './api';
import type {
  BaseDados,
  ChecklistModelo,
  Diretriz,
  Idioma,
  Projeto,
  Protocolo,
  Revisao,
  Tema,
  TipoDocumento,
  TipoRevisao,
} from './tipos';

// Chaves de cache usadas em mais de uma tela
export const chaves = {
  projetos: ['projetos'] as const,
  projeto: (id: string) => ['projeto', id] as const,
  protocolo: (id: string) => ['projeto', id, 'protocolo'] as const,
  revisoes: (id: string) => ['projeto', id, 'revisoes'] as const,
  revisao: (id: string) => ['revisao', id] as const,
  analises: (id: string) => ['projeto', id, 'analises'] as const,
  temas: (id: string) => ['projeto', id, 'temas'] as const,
  tiposRevisao: (projetoId?: string) => ['tipos-revisao', projetoId ?? 'globais'] as const,
};

const LONGO = 5 * 60_000; // catálogos mudam pouco

export const useBases = () =>
  useQuery({ queryKey: ['bases-dados'], queryFn: () => get<BaseDados[]>('/bases-dados'), staleTime: LONGO });
export const useIdiomas = () =>
  useQuery({ queryKey: ['idiomas'], queryFn: () => get<Idioma[]>('/idiomas'), staleTime: LONGO });
export const useTiposDocumento = () =>
  useQuery({
    queryKey: ['tipos-documento'],
    queryFn: () => get<TipoDocumento[]>('/tipos-documento'),
    staleTime: LONGO,
  });
export const useDiretrizes = () =>
  useQuery({ queryKey: ['diretrizes'], queryFn: () => get<Diretriz[]>('/diretrizes'), staleTime: LONGO });
export const useChecklists = () =>
  useQuery({ queryKey: ['checklists'], queryFn: () => get<ChecklistModelo[]>('/checklists'), staleTime: LONGO });

export const useTiposRevisao = (projetoId?: string) =>
  useQuery({
    queryKey: chaves.tiposRevisao(projetoId),
    queryFn: () => get<TipoRevisao[]>('/tipos-revisao', projetoId ? { projetoId } : undefined),
  });

export const useProjeto = (id: string) =>
  useQuery({ queryKey: chaves.projeto(id), queryFn: () => get<Projeto>(`/projetos/${id}`) });
export const useProtocolo = (id: string) =>
  useQuery({ queryKey: chaves.protocolo(id), queryFn: () => get<Protocolo>(`/projetos/${id}/protocolo`) });
export const useRevisoes = (id: string) =>
  useQuery({ queryKey: chaves.revisoes(id), queryFn: () => get<Revisao[]>(`/projetos/${id}/revisoes`) });
export const useTemas = (id: string) =>
  useQuery({ queryKey: chaves.temas(id), queryFn: () => get<Tema[]>(`/projetos/${id}/temas`) });

/** Monta "Sistemática › Integrativa" a partir de tipoPaiId */
export function caminhoDoTipo(tipos: TipoRevisao[] | undefined, id: string | null | undefined): string {
  if (!tipos || !id) return '';
  const partes: string[] = [];
  let atual = tipos.find((t) => t.id === id);
  for (let i = 0; atual && i < 10; i++) {
    partes.unshift(atual.nome);
    atual = tipos.find((t) => t.id === atual!.tipoPaiId);
  }
  return partes.join(' › ');
}
