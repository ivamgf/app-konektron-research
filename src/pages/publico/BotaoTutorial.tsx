import { TUTORIAL_ARQUIVO, TUTORIAL_URL } from '../../lib/tutorial';

/** Link de download do tutorial em PDF */
export function BotaoTutorial({ className = 'btn btn-outline-primary' }: { className?: string }) {
  return (
    <a href={TUTORIAL_URL} download={TUTORIAL_ARQUIVO} className={className}>
      <i className="bi bi-file-earmark-arrow-down me-1" aria-hidden="true" />
      Baixar o tutorial (PDF)
    </a>
  );
}
