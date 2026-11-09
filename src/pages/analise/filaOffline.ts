/**
 * UC12 fluxo 4a: sem conexão, as respostas ficam guardadas no navegador e são enviadas ao voltar.
 * Chave por análise + documento; a última gravação vale (ERS 9.4 item 4 para respostas de análise).
 */
export type Pendente = {
  url: string;
  corpo: {
    respostas?: { questaoAnaliseId: string; texto: string | null }[];
    resumoAssunto?: string | null;
    consideracoes?: string | null;
    observacoes?: string | null;
  };
  em: string;
};

const PREFIXO = 'konektron:pendente:';

export function guardar(chave: string, novo: Pendente, armazenamento: Storage = localStorage) {
  const atual = ler(chave, armazenamento);
  // junta com o que já estava pendente: a resposta mais nova de cada questão prevalece
  const respostas = new Map((atual?.corpo.respostas ?? []).map((r) => [r.questaoAnaliseId, r]));
  for (const r of novo.corpo.respostas ?? []) respostas.set(r.questaoAnaliseId, r);
  const corpo = { ...atual?.corpo, ...novo.corpo, respostas: [...respostas.values()] };
  armazenamento.setItem(PREFIXO + chave, JSON.stringify({ ...novo, corpo }));
}

export function ler(chave: string, armazenamento: Storage = localStorage): Pendente | null {
  try {
    const v = armazenamento.getItem(PREFIXO + chave);
    return v ? (JSON.parse(v) as Pendente) : null;
  } catch {
    return null;
  }
}

export function remover(chave: string, armazenamento: Storage = localStorage) {
  armazenamento.removeItem(PREFIXO + chave);
}

export function todos(armazenamento: Storage = localStorage): [string, Pendente][] {
  const out: [string, Pendente][] = [];
  for (let i = 0; i < armazenamento.length; i++) {
    const k = armazenamento.key(i);
    if (k?.startsWith(PREFIXO)) {
      const p = ler(k.slice(PREFIXO.length), armazenamento);
      if (p) out.push([k.slice(PREFIXO.length), p]);
    }
  }
  return out;
}
