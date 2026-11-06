import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { mensagemDeErro, post } from '../lib/api';
import { chaves } from '../lib/consultas';
import type { Projeto } from '../lib/tipos';
import { Carregando } from '../components/ui';

/** Link do e-mail de convite: APP_URL/convites?token=... (o usuário precisa estar logado com o e-mail convidado) */
export default function Convite() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const qc = useQueryClient();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [erro, setErro] = useState<string | null>(token ? null : 'Link de convite inválido.');
  const enviado = useRef(false);

  useEffect(() => {
    if (!token || enviado.current) return;
    enviado.current = true;
    post<Projeto>('/projetos/convites/aceitar', { token })
      .then((p) => {
        setProjeto(p);
        qc.invalidateQueries({ queryKey: chaves.projetos });
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, [token, qc]);

  return (
    <div className="mx-auto" style={{ maxWidth: 520 }}>
      <h1 className="k-display">Convite para projeto</h1>
      {!projeto && !erro && <Carregando texto="Aceitando o convite…" />}
      {erro && <div className="alert alert-danger">{erro}</div>}
      {projeto && (
        <div className="alert alert-success">
          Você agora participa de <strong>{projeto.titulo}</strong>.{' '}
          <Link to={`/projetos/${projeto.id}`} className="alert-link">
            Abrir o projeto
          </Link>
        </div>
      )}
    </div>
  );
}
