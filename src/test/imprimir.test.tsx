import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const post = vi.fn();
const get = vi.fn();
vi.mock('../lib/api', async (original) => ({ ...(await original<typeof import('../lib/api')>()), post, get }));
const { BotaoImprimir } = await import('../components/BotaoImprimir');

describe('BotaoImprimir', () => {
  it('"Somente o protocolo" abre o modal do protocolo sem chamar a API', async () => {
    const aoImprimirProtocolo = vi.fn();
    render(<BotaoImprimir projetoId="p1" aoImprimirProtocolo={aoImprimirProtocolo} />);
    await userEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Somente o protocolo/ }));
    expect(aoImprimirProtocolo).toHaveBeenCalledOnce();
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('"Projeto inteiro" gera o PDF do projeto e mostra o link ao concluir', async () => {
    post.mockResolvedValueOnce({ tarefaId: 7 });
    get.mockResolvedValueOnce({ id: 7, status: 'CONCLUIDA', resultado: { url: 'https://x/projeto.pdf' } });
    render(<BotaoImprimir projetoId="p1" aoImprimirProtocolo={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Projeto inteiro/ }));
    expect(post).toHaveBeenCalledWith('/projetos/p1/exportar', { formato: 'pdf' });
    await waitFor(() => expect(screen.getByRole('link', { name: /Abrir PDF do projeto/ })).toHaveAttribute('href', 'https://x/projeto.pdf'));
  });

  it('Esc fecha o menu', async () => {
    render(<BotaoImprimir projetoId="p1" aoImprimirProtocolo={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
