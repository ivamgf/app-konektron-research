import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Acessibilidade } from '../components/Acessibilidade';
import {
  aplicarPreferencias,
  gravarPreferencias,
  lerPreferencias,
  PADRAO,
  proximoTamanho,
} from '../lib/acessibilidade';

const html = document.documentElement;

describe('painel de acessibilidade', () => {
  afterEach(() => {
    localStorage.clear();
    aplicarPreferencias({ ...PADRAO });
  });

  it('escala da fonte vai de 90% a 200% e não passa dos limites', () => {
    expect(proximoTamanho(100, 1)).toBe(112.5);
    expect(proximoTamanho(100, -1)).toBe(90);
    expect(proximoTamanho(90, -1)).toBe(90);
    expect(proximoTamanho(200, 1)).toBe(200);
    expect(proximoTamanho(33, 1)).toBe(112.5); // valor estranho volta para a escala
  });

  it('grava e lê as preferências, ignorando valores inválidos', () => {
    gravarPreferencias({ ...PADRAO, contraste: true, fonte: 150 });
    expect(lerPreferencias()).toEqual({ ...PADRAO, contraste: true, fonte: 150 });
    localStorage.setItem('konektron:acessibilidade', '{"contraste":"sim","fonte":999}');
    expect(lerPreferencias()).toEqual(PADRAO);
    localStorage.setItem('konektron:acessibilidade', 'não é json');
    expect(lerPreferencias()).toEqual(PADRAO);
    gravarPreferencias({ ...PADRAO });
    expect(localStorage.getItem('konektron:acessibilidade')).toBeNull();
  });

  it('liga o alto contraste e aumenta o texto, aplicando no <html>', async () => {
    const u = userEvent.setup();
    render(<Acessibilidade />);
    const botao = screen.getByRole('button', { name: /acessibilidade/i });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    await u.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Acessibilidade' })).toBeVisible();

    await u.click(screen.getByRole('switch', { name: /alto contraste/i }));
    expect(html).toHaveAttribute('data-k-contraste');
    expect(screen.getByRole('status')).toHaveTextContent('Alto contraste: ligado');

    await u.click(screen.getByRole('button', { name: 'Aumentar o texto' }));
    await u.click(screen.getByRole('button', { name: 'Aumentar o texto' }));
    expect(html.style.fontSize).toBe('125%');
    expect(lerPreferencias()).toMatchObject({ contraste: true, fonte: 125 });

    await u.click(screen.getByRole('button', { name: 'Restaurar o padrão' }));
    expect(html).not.toHaveAttribute('data-k-contraste');
    expect(html.style.fontSize).toBe('');
  });

  it('Esc fecha o painel e devolve o foco; Alt+Shift+A abre', async () => {
    const u = userEvent.setup();
    render(<Acessibilidade />);
    const botao = screen.getByRole('button', { name: /acessibilidade/i });
    await u.keyboard('{Alt>}{Shift>}A{/Shift}{/Alt}');
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    await u.keyboard('{Escape}');
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(botao).toHaveFocus();
  });
});
