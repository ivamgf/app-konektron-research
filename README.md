# app-konektron-research

App web do **Konektron Research**, sistema de cadastro e elaboração de pesquisas científicas (protocolo de pesquisa, revisões de literatura em etapas, triagem e análise de documentos). Implementa a interface da ERS v1.1 e consome a [API](https://github.com/ivamgf/api-konektron-research).

## Stack

- React 18 + TypeScript, Vite
- Bootstrap 5 com os tokens do Design System Konektron (primária verde `#007A4F`, tema claro e escuro), Bootstrap Icons, Roboto e Roboto Mono
- React Router, TanStack Query, React Hook Form + Zod, Axios com interceptador JWT
- Vitest + Testing Library

## Rodar localmente

1. Node 24 e `npm install`.
2. Suba a API (`npm run dev` em `api-konektron-research`, porta 3333). O `CORS_ORIGINS` da API precisa incluir `http://localhost:5173`.
3. Se a API não estiver em `http://localhost:3333/api/v1`, copie `.env.example` para `.env` e ajuste `VITE_API_URL`.
4. `npm run dev` e abra http://localhost:5173.

Comandos: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` · `npm run format`.

## Telas

| Tela                                                                                                                                                                                           | Rota                                                               | ERS                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------- |
| Página inicial (apresentação do sistema, aberta)                                                                                                                                               | `/`                                                                | —                      |
| Cadastro: aviso de que as contas são criadas pela OrkneyTech, com contato (sem formulário)                                                                                                     | `/registrar` (`/cadastro`)                                         | —                      |
| Login, recuperação de senha, confirmação de e-mail                                                                                                                                             | `/login`, `/esqueci-senha`, `/redefinir-senha`, `/confirmar-email` | RF01, RF02, RNF07      |
| Painel de projetos (ativos, arquivados, lixeira)                                                                                                                                               | `/projetos`                                                        | RF05, RN17             |
| Visão geral: dados, arquivar, lixeira, exportar XLSX, busca global, temas e categorias                                                                                                         | `/projetos/:id`                                                    | RF05, RF42, RF46       |
| Protocolo: assistente de 8 passos com salvamento automático, conclusão, PDF, versões e aprovação                                                                                               | `/projetos/:id/protocolo`                                          | RF07–RF15, RN02–RN04   |
| Questões de análise e critérios                                                                                                                                                                | `/projetos/:id/questoes`, `/criterios`                             | RF09, RF10             |
| Documentos: cadastro manual, referências NBR/APA, PDF anexo                                                                                                                                    | `/projetos/:id/documentos`                                         | RF26, RF27, RF34       |
| Revisões: criação com ajuste de etapas; linha do tempo; buscas e importação; duplicados; triagem com atalhos S/E; conflitos; inclusão; painel e fluxograma (SVG/PNG); checklist; relatório PDF | `/projetos/:id/revisoes/:revisaoId`                                | RF21–RF35, RF43        |
| Análise (página única): respostas com salvamento automático, matriz de síntese, discussão, considerações, comparação por questão, exportação                                                   | `/projetos/:id/analises/:analiseId`                                | RF36–RF41              |
| Membros e convites; auditoria                                                                                                                                                                  | `/projetos/:id/membros`, `/auditoria`                              | RF06, RF44             |
| Tipos de revisão (árvore + etapas)                                                                                                                                                             | `/tipos-revisao`                                                   | RF16–RF18              |
| Perfil e preferências; exportar e excluir dados                                                                                                                                                | `/perfil`                                                          | RF04, RNF07            |
| Notificações; aceitar convite                                                                                                                                                                  | `/notificacoes`, `/convites`                                       | RF45, RF06             |
| Administração: usuários e catálogos                                                                                                                                                            | `/admin/usuarios`, `/admin/catalogos`                              | RF03, RF19, RF20, UC14 |

O cadastro público está desativado no app: o botão **Cadastrar** leva a `/registrar`, que orienta o pesquisador a pedir a conta à OrkneyTech (`konektron@orkneytech-lab.com`). Os contatos ficam em `src/lib/contato.ts`.

Os links dos e-mails da API (`APP_URL/confirmar-email`, `/redefinir-senha` e `/convites`) abrem as telas acima.

## Sessão

- O token de acesso (15 min) fica só em memória. O refresh token vai em cookie httpOnly (RNF04), e o app renova a sessão sozinho ao receber 401.
- O cookie só é enviado entre domínios do mesmo site (`app.dominio.com.br` e `api.dominio.com.br`); nos endereços `*.herokuapp.com` o navegador o bloqueia. Por isso o refresh token também fica no `localStorage` (chave `kr_rt`), e a sessão sobrevive ao F5. As abas renovam uma de cada vez (Web Locks), porque a API derruba todas as sessões se um refresh token já usado for reapresentado. Falha de rede na renovação não encerra a sessão; só a recusa da API (401) encerra.
- Na análise, se a conexão cair, as respostas ficam guardadas no navegador e são enviadas quando ela volta (UC12, fluxo 4a).

## Heroku

- App `konektron-research-web` com o buildpack `heroku/nodejs`. O `heroku-postbuild` roda o build do Vite e o `Procfile` serve `dist/` com `serve -s` na porta `$PORT`.
- Config Var obrigatória antes do build: `VITE_API_URL=https://<api>/api/v1` (o Vite a embute no build; trocar exige novo deploy). Sem ela o build na Heroku falha de propósito, para não publicar um app apontando para `localhost`.
- Deploy: `heroku config:set VITE_API_URL=https://<api>/api/v1 -a konektron-research-web` e `git push heroku main`.
- Na API, inclua a URL do app em `CORS_ORIGINS` e use-a em `APP_URL` (links dos e-mails).
