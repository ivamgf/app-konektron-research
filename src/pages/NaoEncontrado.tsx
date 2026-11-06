import { Link } from 'react-router-dom';
import { Vazio } from '../components/ui';

export function NaoEncontrado() {
  return (
    <Vazio icone="bi-signpost-split">
      <p>Página não encontrada.</p>
      <Link to="/projetos" className="btn btn-primary">
        Ir para os projetos
      </Link>
    </Vazio>
  );
}
