import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getApi = vi.fn(async () => ({ data: '<svg xmlns="http://www.w3.org/2000/svg"><text>Incluídos</text></svg>' }));
vi.mock('../lib/api', async (original) => {
  const real = await original<typeof import('../lib/api')>();
  return { ...real, api: { ...real.api, get: getApi } };
});
const { DiagramaFluxo } = await import('../pages/revisao/DiagramaFluxo');

describe('DiagramaFluxo', () => {
  it('busca o SVG da revisão e mostra o diagrama com as opções de exportação', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:diagrama');
    URL.revokeObjectURL = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DiagramaFluxo revisaoId="r1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('img', { name: /Diagrama de fluxo da seleção/ })).toHaveAttribute(
      'src',
      'blob:diagrama',
    );
    expect(getApi).toHaveBeenCalledWith('/revisoes/r1/diagrama', { params: { formato: 'svg' }, responseType: 'text' });
    for (const nome of ['Imprimir', 'SVG', 'PNG']) expect(screen.getByRole('button', { name: nome })).toBeEnabled();
  });
});
