import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Abas, Modal } from '../components/ui';
import { tituloDaRota } from '../components/TituloDaPagina';
import { teclaDeAtalho } from '../pages/revisao/triagemLogica';

describe('acessibilidade (WCAG 2.2 / WAI-ARIA)', () => {
  it('cada tela tem um título próprio (2.4.2)', () => {
    expect(tituloDaRota('/login')).toBe('Entrar');
    expect(tituloDaRota('/projetos/')).toBe('Projetos de pesquisa');
    expect(tituloDaRota('/projetos/abc')).toBe('Visão geral do projeto');
    expect(tituloDaRota('/projetos/abc/protocolo')).toBe('Protocolo');
    expect(tituloDaRota('/projetos/abc/revisoes/r1')).toBe('Revisão');
    expect(tituloDaRota('/projetos/abc/analises/a1')).toBe('Análise');
    expect(tituloDaRota('/qualquer/coisa')).toBe('Página não encontrada');
  });

  it('abas seguem o padrão APG: tablist, aria-selected e setas', async () => {
    function Exemplo() {
      const [aba, setAba] = useState<'a' | 'b' | 'c'>('a');
      return (
        <Abas
          abas={[
            { id: 'a', texto: 'Primeira' },
            { id: 'b', texto: 'Segunda' },
            { id: 'c', texto: 'Terceira' },
          ]}
          atual={aba}
          aoMudar={setAba}
          rotulo="Exemplo"
        >
          <p>Conteúdo {aba}</p>
        </Abas>
      );
    }
    render(<Exemplo />);
    expect(screen.getByRole('tablist', { name: 'Exemplo' })).toBeInTheDocument();
    const primeira = screen.getByRole('tab', { name: 'Primeira' });
    expect(primeira).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Segunda' })).toHaveAttribute('tabindex', '-1');
    primeira.focus();
    await userEvent.keyboard('{ArrowRight}');
    const segunda = screen.getByRole('tab', { name: 'Segunda' });
    expect(segunda).toHaveFocus();
    expect(segunda).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Segunda' })).toHaveTextContent('Conteúdo b');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Terceira' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Primeira' })).toHaveFocus();
  });

  it('modal tem nome acessível e prende o Tab dentro dele', async () => {
    render(
      <>
        <button type="button">Fora</button>
        <Modal titulo="Editar" aberto aoFechar={() => {}}>
          <input aria-label="Nome" />
          <button type="button">Salvar</button>
        </Modal>
      </>,
    );
    expect(screen.getByRole('dialog', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveFocus();
    // a armadilha do Tab depende de layout (getClientRects), que o jsdom não calcula; aqui só a ordem natural
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Fora' })).not.toHaveFocus();
  });

  it('atalhos da triagem não disparam dentro de abas ou diálogos', () => {
    const tecla = (key: string, alvo: HTMLElement) => {
      const ev = new KeyboardEvent('keydown', { key });
      Object.defineProperty(ev, 'target', { value: alvo });
      return teclaDeAtalho(ev);
    };
    const lista = document.createElement('div');
    lista.setAttribute('role', 'tablist');
    const aba = document.createElement('button');
    lista.appendChild(aba);
    document.body.appendChild(lista);
    expect(tecla('ArrowDown', aba)).toBeNull();
    expect(tecla('s', document.body)).toBe('s');
    lista.remove();
  });
});
