import { createContext, useContext } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useProjeto } from '../../lib/consultas';
import { ehDono, podeEditar, rotulo } from '../../lib/formato';
import type { Projeto } from '../../lib/tipos';
import { Carregando, ErroAlerta } from '../../components/ui';

type Ctx = { projeto: Projeto; papel: string; edita: boolean; dono: boolean };
const ProjetoContext = createContext<Ctx | null>(null);

export function useProjetoAtual() {
  const ctx = useContext(ProjetoContext);
  if (!ctx) throw new Error('useProjetoAtual fora do ProjetoLayout');
  return ctx;
}

const ABAS = [
  { para: '', texto: 'Visão geral', icone: 'bi-house' },
  { para: 'protocolo', texto: 'Protocolo', icone: 'bi-clipboard-check' },
  { para: 'questoes', texto: 'Questões', icone: 'bi-question-circle' },
  { para: 'criterios', texto: 'Critérios', icone: 'bi-funnel' },
  { para: 'documentos', texto: 'Documentos', icone: 'bi-file-earmark-text' },
  { para: 'referencias', texto: 'Referências', icone: 'bi-bookmarks' },
  { para: 'revisoes', texto: 'Revisões', icone: 'bi-journal-text' },
  { para: 'analises', texto: 'Análises', icone: 'bi-clipboard-data' },
  { para: 'membros', texto: 'Membros', icone: 'bi-people' },
];

export function ProjetoLayout() {
  const { projetoId = '' } = useParams();
  const q = useProjeto(projetoId);
  if (q.isLoading) return <Carregando />;
  if (q.error || !q.data)
    return (
      <>
        <ErroAlerta erro={q.error ?? 'Projeto não encontrado'} />
        <Link to="/projetos">Voltar aos projetos</Link>
      </>
    );
  const p = q.data;
  const papel = p.papel ?? 'LEITOR';
  const abas =
    papel === 'RESPONSAVEL' || papel === 'ORIENTADOR' || papel === 'ADMIN'
      ? [...ABAS, { para: 'auditoria', texto: 'Auditoria', icone: 'bi-clock-history' }]
      : ABAS;

  return (
    <ProjetoContext.Provider value={{ projeto: p, papel, edita: podeEditar(papel), dono: ehDono(papel) }}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb small mb-1">
          <li className="breadcrumb-item">
            <Link to="/projetos">Projetos</Link>
          </li>
          <li className="breadcrumb-item active text-truncate" aria-current="page" style={{ maxWidth: '40ch' }}>
            {p.titulo}
          </li>
        </ol>
      </nav>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="k-display mb-0 me-2">{p.titulo}</h1>
        <span className="badge text-bg-light border">{rotulo(papel)}</span>
        {p.status === 'ARQUIVADO' && <span className="badge text-bg-secondary">Arquivado</span>}
      </div>
      <ul className="nav nav-tabs mb-4 flex-nowrap overflow-auto">
        {abas.map((a) => (
          <li className="nav-item" key={a.para}>
            <NavLink end={a.para === ''} to={a.para} className="nav-link text-nowrap">
              <i className={`bi ${a.icone} me-1`} aria-hidden="true" />
              {a.texto}
            </NavLink>
          </li>
        ))}
      </ul>
      <Outlet />
    </ProjetoContext.Provider>
  );
}
