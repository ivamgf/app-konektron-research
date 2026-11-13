import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LayoutPublico } from './LayoutPublico';
import { BotaoTutorial } from './BotaoTutorial';
import { EMAIL_ORKNEYTECH } from '../../lib/contato';

type Pergunta = { pergunta: string; resposta: ReactNode };
type Grupo = { id: string; titulo: string; perguntas: Pergunta[] };

export const FAQ: Grupo[] = [
  {
    id: 'geral',
    titulo: 'Sobre o Konektron Research',
    perguntas: [
      {
        pergunta: 'O que é o Konektron Research?',
        resposta:
          'Um sistema para planejar e conduzir revisões de literatura e pesquisas científicas em um só lugar: protocolo, buscas nas bases de dados, duplicados, triagem, análise, cronograma e relatório, com a equipe trabalhando no mesmo projeto.',
      },
      {
        pergunta: 'Existe um tutorial passo a passo?',
        resposta: (
          <>
            Sim. O tutorial em PDF explica como conduzir uma revisão do protocolo ao relatório, seguindo as diretrizes
            PRISMA 2020. Use o botão <strong>Baixar o tutorial (PDF)</strong> nesta página ou na página inicial.
          </>
        ),
      },
      {
        pergunta: 'Que tipos de revisão posso conduzir?',
        resposta:
          'Sistemática, de escopo, integrativa, narrativa e outras. Os tipos de revisão são configuráveis: cada um tem suas etapas, que podem ser ajustadas ao seu método no menu Tipos de revisão.',
      },
    ],
  },
  {
    id: 'conta',
    titulo: 'Conta e planos',
    perguntas: [
      {
        pergunta: 'Como crio minha conta?',
        resposta: (
          <>
            Pelo botão <Link to="/registrar?plano=FREE">Criar conta grátis</Link>. Depois do cadastro, confirme o e-mail
            pelo link que enviamos e entre com seu e-mail e senha.
          </>
        ),
      },
      {
        pergunta: 'Esqueci minha senha. O que faço?',
        resposta: (
          <>
            Na tela de entrar, use <Link to="/esqueci-senha">Esqueci minha senha</Link>. Você recebe por e-mail um link
            para criar uma senha nova.
          </>
        ),
      },
      {
        pergunta: 'Qual a diferença entre os planos?',
        resposta: (
          <>
            O Free permite até 3 projetos, com 1 membro além de você e 500 MB para arquivos. O Standard libera projetos
            ilimitados, até 5 membros por projeto e 5 GB. O Master inclui tudo, com membros ilimitados, 20 GB, a aba
            Análises, os geradores de artigo e de TCLE e os recursos extras de triagem. Veja os detalhes em{' '}
            <Link to="/planos">Planos</Link>.
          </>
        ),
      },
      {
        pergunta: 'Como pago a assinatura?',
        resposta: 'Por Pix, boleto ou cartão, no ciclo mensal ou anual. Estudantes têm 20% de desconto no Standard.',
      },
      {
        pergunta: 'O que acontece quando o plano Free atinge o limite?',
        resposta:
          'Os projetos continuam no sistema por 3 meses depois de atingido o limite. Nesse período, faça o upgrade para continuar trabalhando neles ou exporte o que precisar.',
      },
    ],
  },
  {
    id: 'pesquisa',
    titulo: 'Protocolo, buscas e triagem',
    perguntas: [
      {
        pergunta: 'Como funciona o protocolo?',
        resposta:
          'O protocolo é preenchido em um assistente de 11 passos: tema, questões, hipótese, objetivos, palavras-chave, strings de busca, metodologia e resumos. Ele é salvo automaticamente, guarda versões e pode ser exportado em PDF.',
      },
      {
        pergunta: 'Quais formatos de arquivo posso importar nas buscas?',
        resposta:
          'Os resultados exportados das bases de dados nos formatos RIS, NBIB, BibTeX (.bib), CSV, TXT e XLSX. Registre em cada busca a base, a data e a string usada.',
      },
      {
        pergunta: 'O sistema encontra artigos duplicados?',
        resposta:
          'Sim. Depois de importar as buscas, a etapa de duplicados mostra o mesmo estudo vindo de bases diferentes para você resolver, e as contagens alimentam o fluxograma da revisão.',
      },
      {
        pergunta: 'Posso fazer a triagem fora do sistema?',
        resposta:
          'Pode. Baixe o modelo CSV na revisão, faça a triagem na planilha e importe o arquivo na primeira fase, com a coluna Situação (Selecionado/Excluído). Os selecionados passam automaticamente para as fases seguintes.',
      },
      {
        pergunta: 'Há atalhos de teclado na triagem?',
        resposta:
          'Sim: S seleciona e E exclui o documento aberto. Os atalhos podem ser ligados ou desligados na própria tela de triagem.',
      },
    ],
  },
  {
    id: 'equipe',
    titulo: 'Equipe, análise e relatórios',
    perguntas: [
      {
        pergunta: 'Como convido outras pessoas para o projeto?',
        resposta:
          'Na aba Membros do projeto, informe o e-mail e o papel: Colaborador (edita o conteúdo), Orientador ou Leitor (acompanham sem editar). O convite chega por e-mail.',
      },
      {
        pergunta: 'O que o relatório traz?',
        resposta:
          'O fluxograma da revisão (SVG ou PNG), o checklist, o relatório de pesquisa em PDF e Word e planilhas XLSX, além das referências em ABNT, APA, MLA, Chicago, Vancouver e IEEE.',
      },
      {
        pergunta: 'Posso usar inteligência artificial?',
        resposta:
          'Sim. A integração com IA usa a sua própria conta ou chave e ajuda, por exemplo, a redigir partes do protocolo. As sugestões devem sempre ser revisadas por você.',
      },
    ],
  },
  {
    id: 'privacidade',
    titulo: 'Privacidade e suporte',
    perguntas: [
      {
        pergunta: 'Como meus dados são tratados?',
        resposta:
          'Conforme a LGPD. No seu Perfil você pode exportar os seus dados ou pedir a exclusão da conta a qualquer momento.',
      },
      {
        pergunta: 'Não encontrei minha dúvida. Como falo com o suporte?',
        resposta: (
          <>
            Escreva para <a href={`mailto:${EMAIL_ORKNEYTECH}`}>{EMAIL_ORKNEYTECH}</a>.
          </>
        ),
      },
    ],
  },
];

/** Perguntas frequentes: página aberta, acessível com ou sem login */
export default function Faq() {
  return (
    <LayoutPublico>
      <div className="container-xl px-3 py-5" style={{ maxWidth: 880 }}>
        <h1 className="mb-2">Perguntas frequentes</h1>
        <p className="text-secondary mb-4">
          Respostas rápidas sobre o Konektron Research. Para um roteiro completo da revisão, baixe o tutorial.
        </p>
        <div className="mb-5">
          <BotaoTutorial />
        </div>
        <nav aria-label="Temas das perguntas" className="mb-4">
          <ul className="list-inline mb-0">
            {FAQ.map((g) => (
              <li className="list-inline-item mb-2" key={g.id}>
                <a href={`#faq-${g.id}`} className="btn btn-outline-secondary btn-sm">
                  {g.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {FAQ.map((g) => (
          <section key={g.id} id={`faq-${g.id}`} className="mb-5" aria-labelledby={`faq-titulo-${g.id}`}>
            <h2 className="h4 mb-3" id={`faq-titulo-${g.id}`}>
              {g.titulo}
            </h2>
            <div className="k-faq">
              {g.perguntas.map((p) => (
                <details key={p.pergunta} className="k-faq-item">
                  <summary>{p.pergunta}</summary>
                  <div className="k-faq-resposta">{p.resposta}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </LayoutPublico>
  );
}
