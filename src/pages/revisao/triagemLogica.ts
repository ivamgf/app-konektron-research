import type { DocumentoTriagem, MotivoExclusao } from '../../lib/tipos';

/** Pendente para o usuário: ainda não decidiu (com dois revisores, a decisão final pode esperar o outro) */
export const pendenteParaMim = (d: DocumentoTriagem, doisRevisores: boolean) =>
  doisRevisores ? !d.minhaDecisao : !d.decisaoFinal && !d.conflito;

/** Depois de decidir, vai para o próximo pendente (seguindo a ordem da lista e dando a volta) */
export function proximoPendente(
  docs: DocumentoTriagem[],
  atualId: string | null,
  doisRevisores: boolean,
): string | null {
  if (!docs.length) return null;
  const i = Math.max(
    0,
    docs.findIndex((d) => d.revisaoDocumentoId === atualId),
  );
  for (let k = 1; k <= docs.length; k++) {
    const d = docs[(i + k) % docs.length];
    if (pendenteParaMim(d, doisRevisores) && d.revisaoDocumentoId !== atualId) return d.revisaoDocumentoId;
  }
  return null;
}

export type Exclusao = { motivo: MotivoExclusao | ''; criterioId: string; observacao: string };

/** RN10: exclusão exige motivo; critério exige o critério; "Outro" exige texto */
export function validarExclusao(e: Exclusao): string | null {
  if (!e.motivo) return 'Escolha o motivo da exclusão';
  if (e.motivo === 'CRITERIO' && !e.criterioId) return 'Escolha o critério de exclusão';
  if (e.motivo === 'OUTRO' && !e.observacao.trim()) return 'Descreva o motivo';
  return null;
}

export function corpoDecisao(decisao: 'SELECIONADO' | 'EXCLUIDO', e?: Exclusao) {
  if (decisao === 'SELECIONADO') return { decisao, motivo: null, criterioId: null, observacao: null };
  return {
    decisao,
    motivo: e!.motivo || null,
    criterioId: e!.motivo === 'CRITERIO' ? e!.criterioId : null,
    observacao: e!.observacao.trim() || null,
  };
}

/** Atalhos só valem fora de campos de texto */
const CHAVE_ATALHOS = 'konektron.atalhosTriagem';

/** WCAG 2.1.4: os atalhos de uma tecla só (S, E, J, K) podem ser desligados pelo usuário */
export function atalhosLigados(): boolean {
  try {
    return localStorage.getItem(CHAVE_ATALHOS) !== 'off';
  } catch {
    return true;
  }
}
export function gravarAtalhos(ligados: boolean) {
  try {
    localStorage.setItem(CHAVE_ATALHOS, ligados ? 'on' : 'off');
  } catch {
    // navegador sem localStorage: vale só nesta tela
  }
}

export function teclaDeAtalho(ev: KeyboardEvent): 's' | 'e' | 'proximo' | 'anterior' | null {
  const alvo = ev.target as HTMLElement | null;
  if (ev.defaultPrevented) return null;
  if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return null;
  // não rouba as setas de componentes que as usam (abas, menus, listas) nem age com um modal aberto
  if (alvo?.closest?.('[role="tablist"], [role="menu"], [role="listbox"], [role="radiogroup"], [role="dialog"]'))
    return null;
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return null;
  const k = ev.key.toLowerCase();
  if (k === 's') return 's';
  if (k === 'e') return 'e';
  if (k === 'arrowdown' || k === 'j') return 'proximo';
  if (k === 'arrowup' || k === 'k') return 'anterior';
  return null;
}
