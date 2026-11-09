import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ResumoRascunho } from '../pages/projeto/protocoloPassos';

const idiomas = [
  { id: 1, codigo: 'pt', nome: 'Português' },
  { id: 2, codigo: 'en', nome: 'Inglês' },
  { id: 3, codigo: 'es', nome: 'Espanhol' },
  { id: 4, codigo: 'fr', nome: 'Francês' },
];
const get = vi.fn(async () => idiomas);
const post = vi.fn(async (_url: string, corpo: { para: string[] }) => ({
  traducoes: Object.fromEntries(corpo.para.map((p) => [p, `texto em ${p}`])),
  aviso: 'Revise.',
}));
vi.mock('../lib/api', async (original) => ({ ...(await original<typeof import('../lib/api')>()), get, post }));
const { ResumosProtocolo } = await import('../pages/projeto/ResumosProtocolo');

function Teste() {
  const [resumos, setResumos] = useState<ResumoRascunho[]>([
    { idioma: 'pt', texto: 'Esta pesquisa analisa ontologias.' },
    { idioma: 'en', texto: '' },
    { idioma: 'es', texto: '' },
  ]);
  return <ResumosProtocolo projetoId="p1" resumos={resumos} aoMudar={setResumos} somenteLeitura={false} />;
}
const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Teste />
    </QueryClientProvider>,
  );

describe('ResumosProtocolo', () => {
  it('traduz do português para os resumos vazios', async () => {
    montar();
    await userEvent.click(await screen.findByRole('button', { name: /Preencher os vazios \(2\)/ }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/projetos/p1/protocolo/traduzir', {
        texto: 'Esta pesquisa analisa ontologias.',
        de: 'pt',
        para: ['en', 'es'],
      }),
    );
    expect(await screen.findByDisplayValue('texto em en')).toBeInTheDocument();
    expect(screen.getByDisplayValue('texto em es')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Revise/);
  });

  it('adiciona resumo em outro idioma do catálogo e remove', async () => {
    montar();
    await userEvent.click(await screen.findByRole('button', { name: /Adicionar resumo em outro idioma/ }));
    expect(screen.getByLabelText('Idioma do resumo 4')).toHaveValue('fr');
    expect(screen.getByRole('button', { name: /Adicionar resumo em outro idioma/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Remover resumo em Francês' }));
    expect(screen.queryByLabelText('Idioma do resumo 4')).not.toBeInTheDocument();
  });
});
