import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto/800.css';
import '@fontsource/roboto-mono/400.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/app.scss';
import { AuthProvider } from './auth/AuthProvider';
import { App } from './App';
import { lerErro } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // não insiste em 4xx (permissão, não encontrado, validação)
      retry: (falhas, erro) => {
        const status = lerErro(erro).status;
        return (!status || status >= 500) && falhas < 2;
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
