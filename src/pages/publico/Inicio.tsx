import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { LayoutPublico } from './LayoutPublico';

const PASSOS = [
  {
    titulo: 'Planeje o protocolo',
    texto:
      'Tema, questões, hipótese, objetivos, palavras-chave, strings de busca, metodologia e resumos em um assistente de 11 passos.',
  },
  {
    titulo: 'Busque e importe',
    texto: 'Registre as buscas em cada base de dados, importe os resultados e resolva os duplicados.',
  },
  {
    titulo: 'Faça a triagem',
    texto:
      'Inclua ou exclua documentos pelos critérios do protocolo, com atalhos de teclado e conflitos entre revisores.',
  },
  {
    titulo: 'Analise e relate',
    texto: 'Responda às questões de análise, monte a matriz de síntese e exporte o relatório e o fluxograma.',
  },
];

const RECURSOS = [
  {
    icone: 'bi-clipboard2-check',
    titulo: 'Protocolo de pesquisa',
    texto: 'Salvamento automático, versões, aprovação e exportação em PDF.',
  },
  {
    icone: 'bi-diagram-3',
    titulo: 'Revisões em etapas',
    texto: 'Tipos de revisão configuráveis, com etapas ajustáveis e linha do tempo do andamento.',
  },
  {
    icone: 'bi-funnel',
    titulo: 'Triagem colaborativa',
    texto: 'Critérios de inclusão e exclusão, decisões por revisor e resolução de conflitos.',
  },
  {
    icone: 'bi-journal-text',
    titulo: 'Documentos e referências',
    texto: 'Cadastro manual ou por importação, PDF anexo e referências nas normas NBR e APA.',
  },
  {
    icone: 'bi-table',
    titulo: 'Análise e síntese',
    texto: 'Respostas por documento, matriz de síntese, discussão e comparação por questão.',
  },
  {
    icone: 'bi-file-earmark-bar-graph',
    titulo: 'Fluxograma e relatórios',
    texto: 'Fluxograma da revisão em SVG ou PNG, checklist, relatório em PDF e planilhas XLSX.',
  },
  {
    icone: 'bi-people',
    titulo: 'Equipe e auditoria',
    texto: 'Convide membros para o projeto, defina papéis e acompanhe o histórico de alterações.',
  },
  {
    icone: 'bi-shield-lock',
    titulo: 'Privacidade',
    texto: 'Tratamento de dados conforme a LGPD, com exportação e exclusão dos seus dados pelo perfil.',
  },
];

const NUMEROS = [
  ['11', 'passos no protocolo'],
  ['NBR · APA', 'normas de referência'],
  ['PDF · DOCX · XLSX', 'formatos de exportação'],
];

/** Página inicial aberta: apresenta o Konektron Research antes do login */
export function Inicio() {
  const { usuario } = useAuth();

  return (
    <LayoutPublico>
      <div className="k-home">
        <section className="k-home-hero" aria-labelledby="k-home-titulo">
          <span className="k-home-hero-forma d-none d-lg-block" aria-hidden="true" />
          <div className="container-xl px-3 py-5 d-flex flex-wrap align-items-center gap-5 position-relative">
            <div className="flex-grow-1 py-md-4" style={{ maxWidth: 640 }}>
              <img
                src="/brand/konektron.png"
                alt="Logo KoneKtron"
                width={88}
                height={88}
                className="k-home-logo d-block mb-4"
              />
              <span className="k-home-selo mb-3">
                <i className="bi bi-mortarboard me-1" aria-hidden="true" /> KoneKtron · Research
              </span>
              <h1 className="k-home-titulo mb-3" id="k-home-titulo">
                Pesquisa científica do protocolo ao relatório
              </h1>
              <p className="k-home-lead mb-4">
                O Konektron Research organiza revisões de literatura e pesquisas científicas em um só lugar: protocolo,
                buscas, triagem de documentos, análise e relatórios, com a equipe trabalhando no mesmo projeto.
              </p>
              <div className="d-flex flex-wrap gap-3 mb-5">
                {usuario ? (
                  <Link to="/projetos" className="btn btn-laranja btn-lg fw-bold px-4">
                    Ir para meus projetos <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="btn btn-laranja btn-lg fw-bold px-4">
                      Entrar <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                    </Link>
                    <Link to="/registrar" className="btn btn-outline-light btn-lg px-4">
                      Cadastrar
                    </Link>
                  </>
                )}
              </div>
              <dl className="k-home-numeros mb-0">
                {NUMEROS.map(([n, rotulo]) => (
                  <div key={rotulo}>
                    <dt>{n}</dt>
                    <dd>{rotulo}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="k-home-cartao mx-auto" aria-hidden="true">
              <div className="k-label text-secondary mb-2">Revisão sistemática</div>
              <ol className="list-unstyled mb-0">
                {['Protocolo', 'Buscas', 'Duplicados', 'Triagem', 'Análise'].map((etapa, i) => (
                  <li key={etapa} className={i < 3 ? 'feita' : i === 3 ? 'atual' : ''}>
                    <i
                      className={`bi ${i < 3 ? 'bi-check-circle-fill' : i === 3 ? 'bi-play-circle-fill' : 'bi-circle'}`}
                    />
                    {etapa}
                  </li>
                ))}
              </ol>
              <div className="progress mt-3" style={{ height: 6 }}>
                <div className="progress-bar" style={{ width: '70%' }} />
              </div>
            </div>
          </div>
        </section>

        <section className="k-home-faixa k-home-passos" aria-labelledby="k-home-como">
          <div className="container-xl px-3">
            <h2 className="k-home-secao" id="k-home-como">
              Como funciona
            </h2>
            <p className="k-home-sub">Uma revisão de literatura completa, em quatro movimentos.</p>
            <ol className="row g-3 list-unstyled mb-0">
              {PASSOS.map((p) => (
                <li className="col-sm-6 col-lg-3" key={p.titulo}>
                  <div className="k-home-passo">
                    <h3>{p.titulo}</h3>
                    <p>{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="k-home-faixa k-home-recursos" aria-labelledby="k-home-recursos">
          <div className="container-xl px-3">
            <h2 className="k-home-secao" id="k-home-recursos">
              Recursos
            </h2>
            <p className="k-home-sub">Tudo o que a pesquisa precisa, do primeiro rascunho ao relatório final.</p>
            <ul className="row g-4 list-unstyled mb-0">
              {RECURSOS.map((r) => (
                <li className="col-sm-6 col-lg-3" key={r.titulo}>
                  <div className="k-home-recurso">
                    <span className="k-home-icone">
                      <i className={`bi ${r.icone}`} aria-hidden="true" />
                    </span>
                    <h3>{r.titulo}</h3>
                    <p>{r.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="container-xl px-3 py-5">
          <section
            className="k-home-cta p-4 p-md-5 d-flex flex-wrap align-items-center justify-content-between gap-3"
            aria-labelledby="k-home-acesso"
          >
            <div className="position-relative">
              <h2 className="h3 text-white mb-1" id="k-home-acesso">
                {usuario ? `Bem-vindo de volta, ${usuario.nome.split(' ')[0]}` : 'Acesso para pesquisadores'}
              </h2>
              <p className="mb-0">
                {usuario
                  ? 'Seus projetos estão esperando por você.'
                  : 'As contas são criadas pela equipe da OrkneyTech. Já tem acesso? É só entrar.'}
              </p>
            </div>
            <div className="d-flex flex-wrap gap-2 position-relative">
              {usuario ? (
                <Link to="/projetos" className="btn btn-light btn-lg fw-bold">
                  Meus projetos
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn btn-light btn-lg fw-bold">
                    Entrar
                  </Link>
                  <Link to="/registrar" className="btn btn-outline-light btn-lg">
                    Como obter acesso
                  </Link>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </LayoutPublico>
  );
}
