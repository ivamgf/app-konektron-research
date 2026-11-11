// Contatos da OrkneyTech (mesmos do app-konektron-node).
export const SITE_ORKNEYTECH = 'www.orkneytech-lab.com';
export const EMAIL_ORKNEYTECH = 'konektron@orkneytech-lab.com';

/** mailto: pedido de assinatura (até a integração com o meio de pagamento) */
export function linkPedidoPlano(plano: string, ciclo: 'mensal' | 'anual', email?: string) {
  const assunto = `Assinatura do plano ${plano} (${ciclo}) no Konektron Research`;
  const corpo = [
    'Olá, equipe OrkneyTech.',
    '',
    `Quero assinar o plano ${plano}, com pagamento ${ciclo}.`,
    '',
    `E-mail da conta: ${email ?? ''}`,
    'CPF ou CNPJ para a cobrança:',
  ].join('\n');
  return `mailto:${EMAIL_ORKNEYTECH}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
