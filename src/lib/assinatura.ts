import { useQuery } from '@tanstack/react-query';
import { get } from './api';

/** Assinatura dos planos pagos no Asaas (GET /planos/assinatura) */
export type Ciclo = 'MENSAL' | 'ANUAL';
export type StatusAssinatura = 'PENDENTE' | 'ATIVA' | 'ATRASADA' | 'CANCELADA';

export type DadosAssinatura = {
  cobrancaAtiva: boolean;
  sandbox: boolean;
  cpfCnpj: string | null;
  descontoEstudante: boolean;
  precos: Record<'STANDARD' | 'MASTER', Record<Ciclo, number>>;
  assinatura: {
    id: string;
    plano: 'STANDARD' | 'MASTER';
    ciclo: Ciclo;
    valor: number;
    status: StatusAssinatura;
    pagoAte: string | null;
    canceladaEm: string | null;
  } | null;
  pagamentos: {
    id: string;
    valor: number;
    status: string;
    forma: string | null;
    vencimento: string;
    pagoEm: string | null;
    linkFatura: string | null;
  }[];
};

export const STATUS_ASSINATURA: Record<StatusAssinatura, string> = {
  PENDENTE: 'Aguardando o primeiro pagamento',
  ATIVA: 'Ativa',
  ATRASADA: 'Pagamento em atraso',
  CANCELADA: 'Cancelada',
};

export const STATUS_PAGAMENTO: Record<string, string> = {
  PENDING: 'Em aberto',
  OVERDUE: 'Vencida',
  CONFIRMED: 'Paga',
  RECEIVED: 'Paga',
  RECEIVED_IN_CASH: 'Paga',
  REFUNDED: 'Estornada',
  REFUND_REQUESTED: 'Estorno pedido',
  CHARGEBACK_REQUESTED: 'Contestada',
  AWAITING_RISK_ANALYSIS: 'Em análise',
  DELETED: 'Removida',
};

export const chaveAssinatura = ['planos', 'assinatura'] as const;
export const useAssinatura = (ativo = true) =>
  useQuery({ queryKey: chaveAssinatura, queryFn: () => get<DadosAssinatura>('/planos/assinatura'), enabled: ativo });

/** CPF (11) ou CNPJ (14 dígitos) com os dígitos verificadores corretos (mesma regra da API) */
export function cpfCnpjValido(v: string) {
  const d = v.replace(/\D/g, '');
  if (!/^\d{11}$|^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = (pesos: number[]) => {
    const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  if (d.length === 11) {
    const p1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    return dv(p1) === Number(d[9]) && dv([11, ...p1]) === Number(d[10]);
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return dv(p1) === Number(d[12]) && dv([6, ...p1]) === Number(d[13]);
}

/** 52998224725 -> 529.982.247-25; 11222333000181 -> 11.222.333/0001-81 */
export function formatarCpfCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11)
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Leva o usuário à fatura do Asaas (Pix, boleto ou cartão) */
export const abrirFatura = (url: string) => window.location.assign(url);
