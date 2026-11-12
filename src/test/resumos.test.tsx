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

describe('limite de 250 palavras nos resumos', async () => {
  const { cortarPalavras, palavras } = await import('../pages/projeto/ResumosProtocolo');
  const texto = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`).join(' ');

  it('corta depois da palavra 250 e mantém textos menores como estão', () => {
    expect(palavras(cortarPalavras(texto(300)))).toBe(250);
    expect(cortarPalavras(texto(300)).endsWith('p250')).toBe(true);
    expect(cortarPalavras('um\ndois  três ', 2)).toBe('um\ndois');
    expect(cortarPalavras('um dois ', 2)).toBe('um dois ');
    expect(cortarPalavras(texto(10))).toBe(texto(10));
  });

  it('ligado, limita a digitação, as traduções e oferece cortar os resumos longos', async () => {
    localStorage.clear();
    post.mockResolvedValueOnce({ traducoes: { en: texto(400), es: texto(260) }, aviso: 'Revise.' });
    montar();
    const chave = await screen.findByRole('switch', { name: /Limitar a 250 palavras/ });
    await userEvent.click(chave);
    expect(localStorage.getItem('konektron.resumo.limite250.p1')).toBe('1');
    await userEvent.click(screen.getByRole('button', { name: /Preencher os vazios/ }));
    await waitFor(() =>
      expect(palavras((screen.getByLabelText('Resumo em Inglês') as HTMLTextAreaElement).value)).toBe(250),
    );
    expect(palavras((screen.getByLabelText('Resumo em Espanhol') as HTMLTextAreaElement).value)).toBe(250);
    expect(screen.getAllByText('250 / 250 palavras')).toHaveLength(2);
    // desligado, um texto longo colado fica inteiro; ao religar, aparece o aviso e o botão de cortar
    await userEvent.click(chave);
    const pt = screen.getByLabelText('Resumo em Português');
    await userEvent.clear(pt);
    await userEvent.click(pt);
    await userEvent.paste(texto(270));
    expect(palavras((pt as HTMLTextAreaElement).value)).toBe(270);
    await userEvent.click(chave);
    expect(screen.getByText(/1 resumo\(s\) passam do limite/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Cortar em 250 palavras/ }));
    expect(palavras((pt as HTMLTextAreaElement).value)).toBe(250);
  });
});
