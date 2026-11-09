import { useEffect, useId, useRef, useState } from 'react';
import { LinksDoArquivo, useTarefa } from './BotaoTarefa';

/**
 * Um botão "Imprimir" com duas opções:
 * - Somente o protocolo de pesquisa: chama `aoImprimirProtocolo` (abre o modal de versão e seções);
 * - Projeto inteiro: gera no worker o PDF com protocolo, relatórios das revisões e análises.
 */
export function BotaoImprimir({
  projetoId,
  aoImprimirProtocolo,
  className = 'btn btn-primary',
}: {
  projetoId: string;
  aoImprimirProtocolo: () => void;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const projeto = useTarefa();

  // fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    raiz.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  // setas navegam entre as opções
  const navegar = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const itens = [...(raiz.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLButtonElement);
    itens[(i + (e.key === 'ArrowDown' ? 1 : itens.length - 1)) % itens.length]?.focus();
  };

  const [formato, setFormato] = useState<'pdf' | 'docx'>('pdf');
  const escolher = (opcao: 'protocolo' | 'projeto' | 'projeto-docx') => {
    setAberto(false);
    if (opcao === 'protocolo') return aoImprimirProtocolo();
    const f = opcao === 'projeto-docx' ? 'docx' : 'pdf';
    setFormato(f);
    projeto.iniciar(`/projetos/${projetoId}/exportar`, { formato: f });
  };

  return (
    <div className="d-inline-flex flex-wrap align-items-center gap-2">
      <div className="dropdown" ref={raiz}>
        <button
          type="button"
          className={`${className} dropdown-toggle`}
          aria-haspopup="menu"
          aria-expanded={aberto}
          aria-controls={menuId}
          disabled={projeto.andamento}
          onClick={() => setAberto((a) => !a)}
        >
          {projeto.andamento ? (
            <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
          ) : (
            <i className="bi bi-printer me-1" aria-hidden="true" />
          )}
          {projeto.andamento ? `Gerando ${formato === 'docx' ? 'Word' : 'PDF'} do projeto…` : 'Imprimir'}
        </button>
        {aberto && (
          <ul
            id={menuId}
            className="dropdown-menu show shadow-sm"
            role="menu"
            onKeyDown={navegar}
            style={{ minWidth: '17rem' }}
          >
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="dropdown-item py-2"
                onClick={() => escolher('protocolo')}
              >
                <i className="bi bi-file-earmark-text me-2" aria-hidden="true" />
                Somente o protocolo de pesquisa
                <small className="d-block text-secondary ms-4">Escolha a versão e as seções</small>
              </button>
            </li>
            <li role="none">
              <button type="button" role="menuitem" className="dropdown-item py-2" onClick={() => escolher('projeto')}>
                <i className="bi bi-journal-richtext me-2" aria-hidden="true" />
                Projeto inteiro
                <small className="d-block text-secondary ms-4">Protocolo, revisões e análises</small>
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="dropdown-item py-2"
                onClick={() => escolher('projeto-docx')}
              >
                <i className="bi bi-file-earmark-word me-2" aria-hidden="true" />
                Projeto inteiro em Word (DOCX)
                <small className="d-block text-secondary ms-4">Para editar no Word ou no LibreOffice</small>
              </button>
            </li>
          </ul>
        )}
      </div>
      {projeto.url && (
        <LinksDoArquivo
          url={projeto.url}
          pdf={projeto.pdf}
          texto={projeto.pdf ? 'Abrir PDF do projeto' : 'Baixar DOCX do projeto'}
          nome={projeto.nome ?? (projeto.pdf ? 'projeto.pdf' : 'projeto.docx')}
        />
      )}
      {projeto.erro && (
        <span className="text-danger small" role="alert">
          {projeto.erro}
        </span>
      )}
    </div>
  );
}
