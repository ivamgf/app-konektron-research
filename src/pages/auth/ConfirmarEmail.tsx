import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { mensagemDeErro, post } from '../../lib/api';
import { Carregando } from '../../components/ui';
import { CartaoAuth } from './CartaoAuth';

/** Link do e-mail: APP_URL/confirmar-email?token=... */
export function ConfirmarEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [estado, setEstado] = useState<'enviando' | 'ok' | 'erro'>(token ? 'enviando' : 'erro');
  const [mensagem, setMensagem] = useState(token ? '' : 'Link inválido.');
  const enviado = useRef(false);

  useEffect(() => {
    if (!token || enviado.current) return; // StrictMode monta duas vezes em desenvolvimento
    enviado.current = true;
    post('/auth/confirmar-email', { token })
      .then(() => setEstado('ok'))
      .catch((e) => {
        setEstado('erro');
        setMensagem(mensagemDeErro(e));
      });
  }, [token]);

  return (
    <CartaoAuth titulo="Confirmação de e-mail">
      {estado === 'enviando' && <Carregando texto="Confirmando…" />}
      {estado === 'ok' && <div className="alert alert-success">E-mail confirmado. Sua conta está ativa.</div>}
      {estado === 'erro' && <div className="alert alert-danger">{mensagem}</div>}
      <Link to="/login" className="btn btn-primary w-100">
        Ir para o login
      </Link>
    </CartaoAuth>
  );
}
