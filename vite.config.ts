/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // Na Heroku (STACK=heroku-xx) o endereço da API precisa vir da Config Var: sem ela o app iria para
  // produção apontando para localhost.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), 'VITE_') };
  if (command === 'build' && process.env.STACK?.startsWith('heroku') && !env.VITE_API_URL) {
    throw new Error('Defina a Config Var VITE_API_URL (ex.: https://<api>/api/v1) antes do deploy na Heroku.');
  }

  return {
    plugins: [react()],
    server: { port: 5173 },
    css: {
      preprocessorOptions: {
        scss: { quietDeps: true, silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'] },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
