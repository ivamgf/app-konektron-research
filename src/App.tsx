import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout, RequerAdmin } from './components/Layout';
import { Carregando } from './components/ui';
import { Login } from './pages/auth/Login';
import { Registrar } from './pages/auth/Registrar';
import { EsqueciSenha, RedefinirSenha } from './pages/auth/Senha';
import { ConfirmarEmail } from './pages/auth/ConfirmarEmail';
import { Projetos } from './pages/Projetos';
import { ProjetoLayout } from './pages/projeto/ProjetoLayout';
import { VisaoGeral } from './pages/projeto/VisaoGeral';
import { NaoEncontrado } from './pages/NaoEncontrado';

// Telas maiores carregadas sob demanda
const Protocolo = lazy(() => import('./pages/projeto/Protocolo'));
const Questoes = lazy(() => import('./pages/projeto/Questoes'));
const Criterios = lazy(() => import('./pages/projeto/Criterios'));
const Documentos = lazy(() => import('./pages/projeto/Documentos'));
const Revisoes = lazy(() => import('./pages/projeto/Revisoes'));
const Analises = lazy(() => import('./pages/projeto/Analises'));
const Membros = lazy(() => import('./pages/projeto/Membros'));
const Auditoria = lazy(() => import('./pages/projeto/Auditoria'));
const Revisao = lazy(() => import('./pages/revisao/Revisao'));
const Analise = lazy(() => import('./pages/analise/Analise'));
const TiposRevisao = lazy(() => import('./pages/TiposRevisao'));
const Perfil = lazy(() => import('./pages/Perfil'));
const Notificacoes = lazy(() => import('./pages/Notificacoes'));
const Convite = lazy(() => import('./pages/Convite'));
const Usuarios = lazy(() => import('./pages/admin/Usuarios'));
const Catalogos = lazy(() => import('./pages/admin/Catalogos'));

export function App() {
  return (
    <Suspense fallback={<Carregando />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registrar" element={<Registrar />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        {/* links dos e-mails da API (APP_URL/...) */}
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/confirmar-email" element={<ConfirmarEmail />} />

        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/projetos" replace />} />
          <Route path="/projetos" element={<Projetos />} />
          <Route path="/convites" element={<Convite />} />
          <Route path="/projetos/:projetoId" element={<ProjetoLayout />}>
            <Route index element={<VisaoGeral />} />
            <Route path="protocolo" element={<Protocolo />} />
            <Route path="questoes" element={<Questoes />} />
            <Route path="criterios" element={<Criterios />} />
            <Route path="documentos" element={<Documentos />} />
            <Route path="revisoes" element={<Revisoes />} />
            <Route path="revisoes/:revisaoId" element={<Revisao />} />
            <Route path="analises" element={<Analises />} />
            <Route path="analises/:analiseId" element={<Analise />} />
            <Route path="membros" element={<Membros />} />
            <Route path="auditoria" element={<Auditoria />} />
          </Route>
          <Route path="/tipos-revisao" element={<TiposRevisao />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/notificacoes" element={<Notificacoes />} />
          <Route element={<RequerAdmin />}>
            <Route path="/admin/usuarios" element={<Usuarios />} />
            <Route path="/admin/catalogos" element={<Catalogos />} />
          </Route>
          <Route path="*" element={<NaoEncontrado />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
