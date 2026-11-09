import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Documento } from '../../lib/tipos';
import { gerarComIA, lerJson, SISTEMA_ACADEMICO } from '../../lib/ia';
import { registrarUsoIA, useConfigIA } from '../../components/IA';

type Questao = { id: string; codigo: string; enunciado: string };

/** Dados do documento (e o resumo do assunto) como contexto para a IA */
export function contextoDoDocumento(
  doc: Pick<Documento, 'titulo' | 'autores' | 'ano' | 'periodico' | 'resumo' | 'palavrasChave' | 'doi'>,
  questoes: Questao[],
  resumoAssunto?: string,
): string {
  const linhas: [string, unknown][] = [
    ['Título', doc.titulo],
    ['Autores', doc.autores],
    ['Ano', doc.ano],
    ['Periódico', doc.periodico],
    ['DOI', doc.doi],
    ['Palavras-chave', doc.palavrasChave],
    ['Resumo (abstract) do documento', doc.resumo],
    ['Resumo do assunto escrito pelo pesquisador', resumoAssunto],
    ['Questões de análise da pesquisa', questoes.map((q) => `${q.codigo}: ${q.enunciado}`).join('\n')],
  ];
  return linhas
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim())
    .map(([k, v]) => `${k}: ${String(v).includes('\n') ? `\n${v}` : v}`)
    .join('\n');
}

/**
 * Sugere, com a conta de IA do usuário, respostas para as questões ainda em branco, a partir do
 * resumo do assunto e dos dados do documento. Só preenche o vazio; tudo fica editável.
 */
export function SugerirRespostas({
  questoes,
  respostas,
  contexto,
  projetoId,
  aoAplicar,
}: {
  questoes: Questao[];
  respostas: Record<string, string>;
  contexto: () => string;
  projetoId: string;
  aoAplicar: (novas: Record<string, string>) => void;
}) {
  const config = useConfigIA();
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const embranco = questoes.filter((q) => !respostas[q.id]?.trim());

  const sugerir = async () => {
    if (!config || !embranco.length) return;
    setGerando(true);
    setMsg(null);
    try {
      const texto = await gerarComIA(config, {
        sistema: `${SISTEMA_ACADEMICO} Responda somente com um objeto JSON válido.`,
        mensagem: `Responda às questões de análise abaixo sobre o documento, usando apenas as informações do contexto. Quando o documento não trouxer a informação, responda "Não informado no documento".

${contexto()}

Questões a responder:
${embranco.map((q) => `${q.codigo}: ${q.enunciado}`).join('\n')}

Devolva um JSON no formato {"${embranco[0].codigo}": "resposta", ...} com uma chave para cada código.`,
        json: true,
      });
      const j = lerJson<Record<string, unknown>>(texto);
      const novas: Record<string, string> = {};
      for (const q of embranco) {
        const v = j[q.codigo];
        if (typeof v === 'string' && v.trim()) novas[q.id] = v.trim();
      }
      aoAplicar(novas);
      registrarUsoIA(projetoId, 'Sugerir respostas da análise', config, { entidade: 'analise' });
      setMsg({
        ok: true,
        texto: `${Object.keys(novas).length} resposta(s) sugerida(s) nas questões em branco. Revise cada uma com o texto completo do documento.`,
      });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível gerar as respostas.' });
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
      {config ? (
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={gerando || !embranco.length}
          onClick={sugerir}
        >
          {gerando ? (
            <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
          ) : (
            <i className="bi bi-stars me-1" aria-hidden="true" />
          )}
          {embranco.length
            ? `Sugerir respostas com IA (${embranco.length} em branco)`
            : 'Todas as questões já têm resposta'}
        </button>
      ) : (
        <span className="small text-secondary">
          <i className="bi bi-stars me-1" aria-hidden="true" />
          Use o botão <strong>IA</strong> de cada questão, ou conecte sua conta de IA no{' '}
          <Link to="/perfil#ia">Perfil</Link> para sugerir todas as respostas de uma vez.
        </span>
      )}
      {msg && (
        <span className={`small ${msg.ok ? 'text-success' : 'text-danger'}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.texto}
        </span>
      )}
    </div>
  );
}
