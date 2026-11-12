import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const APP = 'Konektron Research';

const FIXAS: Record<string, string> = {
  '/': 'Início',
  '/registrar': 'Cadastro de novos usuários',
  '/login': 'Entrar',
  '/esqueci-senha': 'Esqueci minha senha',
  '/redefinir-senha': 'Redefinir senha',
  '/confirmar-email': 'Confirmar e-mail',
  '/projetos': 'Projetos de pesquisa',
  '/convites': 'Convites',
  '/tipos-revisao': 'Tipos de revisão',
  '/perfil': 'Perfil',
  '/notificacoes': 'Notificações',
  '/admin/usuarios': 'Usuários',
  '/admin/catalogos': 'Catálogos',
};

const SECOES_PROJETO: Record<string, string> = {
  '': 'Visão geral do projeto',
  protocolo: 'Protocolo',
  questoes: 'Questões',
  criterios: 'Critérios',
  documentos: 'Documentos',
  referencias: 'Referências',
  revisoes: 'Revisões',
  analises: 'Análises',
  cronograma: 'Cronograma',
  relatorio: 'Relatório de pesquisa',
  membros: 'Membros',
  artigo: 'Gerador de artigo',
  auditoria: 'Auditoria',
};

/** Nome da tela a partir do endereço (WCAG 2.4.2 Página com título) */
export function tituloDaRota(caminho: string): string {
  const limpo = caminho.replace(/\/+$/, '') || '/';
  if (FIXAS[limpo]) return FIXAS[limpo];
  const projeto = /^\/projetos\/[^/]+(?:\/([^/]+)(\/[^/]+)?)?$/.exec(limpo);
  if (projeto) {
    const [, secao = '', item] = projeto;
    if (item && secao === 'revisoes') return 'Revisão';
    if (item && secao === 'analises') return 'Análise';
    if (!item && secao in SECOES_PROJETO) return SECOES_PROJETO[secao];
  }
  return 'Página não encontrada';
}

/**
 * Atualiza o título da aba do navegador a cada troca de tela e anuncia a nova tela aos leitores
 * de tela (numa SPA a página não recarrega, então o leitor não percebe a navegação sozinho).
 */
export function TituloDaPagina() {
  const { pathname } = useLocation();
  const [anuncio, setAnuncio] = useState('');
  const primeira = useRef(true);
  useEffect(() => {
    const nome = tituloDaRota(pathname);
    document.title = nome === 'Início' ? APP : `${nome} · ${APP}`;
    // na primeira carga o leitor já lê o título da página
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    setAnuncio(`Página: ${nome}`);
  }, [pathname]);
  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {anuncio}
    </div>
  );
}
