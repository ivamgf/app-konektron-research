import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const trocarIdioma = vi.fn();
vi.mock('../lib/traducaoSite', async (original) => ({
  ...(await original<typeof import('../lib/traducaoSite')>()),
  trocarIdioma,
}));
const { SeletorIdioma } = await import('../components/SeletorIdioma');
const { IDIOMAS_SITE } = await import('../lib/traducaoSite');

describe('SeletorIdioma', () => {
  it('tem português, inglês, espanhol e francês', () => {
    expect(IDIOMAS_SITE.map((i) => i.codigo)).toEqual(['pt', 'en', 'es', 'fr']);
  });

  it('abre o menu, marca o idioma atual e troca para o francês', async () => {
    render(<SeletorIdioma />);
    const botao = screen.getByRole('button', { name: /Idioma da interface/ });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Português/ })).toHaveAttribute('aria-current', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Français/ }));
    expect(trocarIdioma).toHaveBeenCalledWith('fr');
    expect(botao).toHaveAttribute('aria-expanded', 'false');
  });

  it('Esc fecha o menu e devolve o foco ao botão', async () => {
    render(<SeletorIdioma />);
    const botao = screen.getByRole('button', { name: /Idioma da interface/ });
    await userEvent.click(botao);
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /English/ })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: /English/ })).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });
});
