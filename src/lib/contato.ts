// Contatos da OrkneyTech (mesmos do app-konektron-node). Os cadastros de usuários são feitos pela equipe.
export const SITE_ORKNEYTECH = 'www.orkneytech-lab.com';
export const EMAIL_ORKNEYTECH = 'konektron@orkneytech-lab.com';

/** mailto: já preenchido com o pedido de cadastro e os dados que a equipe precisa */
export function linkPedidoCadastro() {
  const assunto = 'Pedido de cadastro no Konektron Research';
  const corpo = [
    'Olá, equipe OrkneyTech.',
    '',
    'Gostaria de ter acesso ao Konektron Research.',
    '',
    'Nome completo:',
    'E-mail para acesso:',
    'Instituição:',
    'ORCID (opcional):',
    'Finalidade de uso (pesquisa, grupo, disciplina):',
  ].join('\n');
  return `mailto:${EMAIL_ORKNEYTECH}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}

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
