import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ListaEditavel } from '../components/ListaEditavel';

const entrar = vi.fn();
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ usuario: null, entrar }) }));
const { Login } = await import('../pages/auth/Login');

describe('Login', () => {
  it('valida os campos antes de chamar a API', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Informe um e-mail válido')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha')).toBeInTheDocument();
    expect(entrar).not.toHaveBeenCalled();
  });

  it('envia e-mail e senha', async () => {
    entrar.mockResolvedValueOnce(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'Teste@2026');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(entrar).toHaveBeenCalledWith('ana@example.com', 'Teste@2026'));
  });
});

function ListaDeTeste() {
  const [itens, setItens] = useState([{ texto: 'primeiro' }, { texto: 'segundo' }]);
  return (
    <>
      <ListaEditavel
        itens={itens}
        aoMudar={setItens}
        novo={() => ({ texto: '' })}
        rotuloItem={(i) => `Objetivo ${i + 1}`}
        render={(it, set, i) => (
          <input aria-label={`Texto ${i + 1}`} value={it.texto} onChange={(e) => set({ texto: e.target.value })} />
        )}
      />
      <output>{itens.map((i) => i.texto).join('|')}</output>
    </>
  );
}

describe('ListaEditavel', () => {
  it('adiciona, reordena, edita e remove itens', async () => {
    render(<ListaDeTeste />);
    const saida = () => screen.getByRole('status').textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Descer Objetivo 1' }));
    expect(saida()).toBe('segundo|primeiro');
    await userEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    await userEvent.type(screen.getByLabelText('Texto 3'), 'terceiro');
    expect(saida()).toBe('segundo|primeiro|terceiro');
    await userEvent.click(screen.getByRole('button', { name: 'Remover Objetivo 1' }));
    expect(saida()).toBe('primeiro|terceiro');
    expect(screen.getByRole('button', { name: 'Subir Objetivo 1' })).toBeDisabled();
  });
});
