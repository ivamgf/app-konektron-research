import { useId, useState } from 'react';
import type { Idioma } from '../../lib/tipos';
import { useIdiomas } from '../../lib/consultas';
import { gerarComIA, lerJson, type PedidoIA } from '../../lib/ia';
import { AVISO_IA, registrarUsoIA, useConfigIA } from '../../components/IA';
import { ErroAlerta, Modal } from '../../components/ui';
import { METODOLOGIAS, type Rascunho } from './protocoloPassos';

/** Texto com o que já foi preenchido no protocolo, usado como contexto nos pedidos à IA */
export function contextoDoProtocolo(r: Rascunho, idiomas?: Idioma[]): string {
  const nomeIdioma = (id: number | null) => idiomas?.find((i) => i.id === id)?.codigo ?? '';
  const metodo = METODOLOGIAS.find(([v]) => v === r.metodologiaTipo)?.[1];
  const linhas: [string, string | undefined][] = [
    ['Tema', r.tema],
    ['Questão de pesquisa', r.questaoPesquisa],
    ['Outras questões', r.outrasQuestoes.map((x) => `- ${x.texto}`).join('\n')],
    ['Hipótese', r.hipotese],
    ['Objetivo geral', r.objetivoGeral],
    ['Objetivos específicos', r.objetivos.map((x) => `- ${x.texto}`).join('\n')],
    ['Justificativa', r.justificativa],
    [
      'Palavras-chave',
      r.palavrasChave
        .filter((x) => x.termo.trim())
        .map((x) => `${x.termo}${nomeIdioma(x.idiomaId) ? ` (${nomeIdioma(x.idiomaId)})` : ''}`)
        .join('; '),
    ],
    ['Strings de busca', r.strings.map((x) => `- ${x.expressao}`).join('\n')],
    ['Tipo de metodologia', r.metodologiaTipo === 'OUTRA' ? r.metodologiaOutro : metodo],
    ['Metodologia', r.metodologia],
    ['Resultados esperados', r.resultadosEsperados],
  ];
  return linhas
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}: ${v!.includes('\n') ? `\n${v}` : v}`)
    .join('\n');
}

type Gerado = {
  tema?: string;
  questaoPesquisa?: string;
  outrasQuestoes?: string[];
  hipotese?: string;
  objetivoGeral?: string;
  objetivos?: string[];
  justificativa?: string;
  palavrasChave?: { termo: string; idioma: string }[];
  strings?: string[];
  metodologiaTipo?: string;
  metodologia?: string;
  resultadosEsperados?: string;
  riscos?: string;
  beneficios?: string;
  resumo?: string;
};

export function pedidoProtocolo(descricao: string): PedidoIA {
  return {
    sistema:
      'Você é um especialista em metodologia científica que redige protocolos de pesquisa em português do Brasil, ' +
      'com linguagem acadêmica. Não invente dados, resultados, autores nem referências. Responda somente com um ' +
      'objeto JSON válido, sem texto antes ou depois.',
    mensagem: `Elabore o protocolo de pesquisa a partir da descrição do pesquisador.

Descrição:
${descricao.trim()}

Devolva um JSON com estas chaves (todas em português, exceto as palavras-chave em outros idiomas):
{
  "tema": "frase curta",
  "questaoPesquisa": "uma pergunta",
  "outrasQuestoes": ["3 a 5 perguntas complementares"],
  "hipotese": "hipótese testável ou string vazia se não se aplica",
  "objetivoGeral": "verbo no infinitivo",
  "objetivos": ["3 a 5 objetivos específicos"],
  "justificativa": "2 a 3 parágrafos",
  "palavrasChave": [{"termo": "...", "idioma": "pt"}, {"termo": "...", "idioma": "en"}, {"termo": "...", "idioma": "es"}],
  "strings": ["1 a 3 strings booleanas com aspas, AND, OR e parênteses"],
  "metodologiaTipo": "um destes códigos: ${METODOLOGIAS.map(([v]) => v).join(', ')}",
  "metodologia": "abordagem, etapas, participantes, coleta e análise",
  "resultadosEsperados": "texto",
  "riscos": "texto ou string vazia",
  "beneficios": "texto ou string vazia",
  "resumo": "resumo do protocolo entre 150 e 300 palavras"
}
Use de 3 a 6 palavras-chave por idioma (pt, en, es).`,
  };
}

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : []);
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Converte a resposta da IA em campos do rascunho; `soVazios` preserva o que já foi escrito */
export function rascunhoDoGerado(g: Gerado, atual: Rascunho, idiomas: Idioma[], soVazios: boolean): Partial<Rascunho> {
  const out: Partial<Rascunho> = {};
  const texto = (k: keyof Rascunho & string, v: unknown) => {
    const t = txt(v);
    if (t && (!soVazios || !String(atual[k] ?? '').trim())) (out as Record<string, unknown>)[k] = t;
  };
  texto('tema', g.tema);
  texto('questaoPesquisa', g.questaoPesquisa);
  texto('hipotese', g.hipotese);
  texto('objetivoGeral', g.objetivoGeral);
  texto('justificativa', g.justificativa);
  texto('metodologia', g.metodologia);
  texto('resultadosEsperados', g.resultadosEsperados);
  texto('riscos', g.riscos);
  texto('beneficios', g.beneficios);
  const tipo = txt(g.metodologiaTipo).toUpperCase();
  if (METODOLOGIAS.some(([v]) => v === tipo) && (!soVazios || !atual.metodologiaTipo)) out.metodologiaTipo = tipo;
  const vazio = <T,>(arr: T[], teste: (x: T) => boolean) => !arr.some(teste);
  if (lista(g.outrasQuestoes).length && (!soVazios || vazio(atual.outrasQuestoes, (x) => !!x.texto.trim())))
    out.outrasQuestoes = lista(g.outrasQuestoes).map((texto) => ({ texto }));
  if (lista(g.objetivos).length && (!soVazios || vazio(atual.objetivos, (x) => !!x.texto.trim())))
    out.objetivos = lista(g.objetivos).map((texto) => ({ texto }));
  const palavras = (Array.isArray(g.palavrasChave) ? g.palavrasChave : [])
    .map((p) => ({
      termo: txt(typeof p === 'string' ? p : p?.termo).slice(0, 150),
      idiomaId: idiomas.find((i) => i.codigo === txt(p?.idioma).toLowerCase().slice(0, 2))?.id ?? null,
    }))
    .filter((p) => p.termo);
  if (palavras.length && (!soVazios || vazio(atual.palavrasChave, (x) => !!x.termo.trim())))
    out.palavrasChave = palavras;
  if (lista(g.strings).length && (!soVazios || vazio(atual.strings, (x) => !!x.expressao.trim())))
    out.strings = lista(g.strings).map((expressao) => ({ baseDadosId: null, campo: 'TODOS' as const, expressao }));
  const resumo = txt(g.resumo);
  if (resumo) {
    const pt = atual.resumos.find((x) => x.idioma === 'pt');
    if (!soVazios || !pt?.texto.trim())
      out.resumos = pt
        ? atual.resumos.map((x) => (x.idioma === 'pt' ? { ...x, texto: resumo } : x))
        : [{ idioma: 'pt', texto: resumo }, ...atual.resumos];
  }
  return out;
}

const NOMES: Partial<Record<keyof Rascunho, string>> = {
  tema: 'Tema',
  questaoPesquisa: 'Questão de pesquisa',
  outrasQuestoes: 'Outras questões',
  hipotese: 'Hipótese',
  objetivoGeral: 'Objetivo geral',
  objetivos: 'Objetivos específicos',
  justificativa: 'Justificativa',
  palavrasChave: 'Palavras-chave',
  strings: 'Strings de busca',
  metodologiaTipo: 'Tipo de metodologia',
  metodologia: 'Metodologia',
  resultadosEsperados: 'Resultados esperados',
  riscos: 'Riscos',
  beneficios: 'Benefícios',
  resumos: 'Resumo',
};

/** "Criar protocolo com IA": descreve a pesquisa em poucas linhas e a IA preenche todos os passos */
export function CriarProtocoloComIA({
  r,
  projetoId,
  aoAplicar,
}: {
  r: Rascunho;
  projetoId: string;
  aoAplicar: (parcial: Partial<Rascunho>) => Promise<void>;
}) {
  const config = useConfigIA();
  const idiomas = useIdiomas();
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [soVazios, setSoVazios] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [gerado, setGerado] = useState<Gerado | null>(null);
  const previa = gerado ? rascunhoDoGerado(gerado, r, idiomas.data ?? [], soVazios) : null;

  const gerar = async () => {
    if (!config) return;
    setGerando(true);
    setErro(null);
    setGerado(null);
    try {
      setGerado(lerJson<Gerado>(await gerarComIA(config, { ...pedidoProtocolo(descricao), json: true })));
    } catch (e) {
      setErro(e instanceof Error ? e.message : e);
    } finally {
      setGerando(false);
    }
  };

  const fechar = () => {
    setAberto(false);
    setErro(null);
  };

  return (
    <>
      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setAberto(true)}>
        <i className="bi bi-stars me-1" aria-hidden="true" />
        Criar protocolo com IA
      </button>
      <Modal
        titulo="Criar protocolo com IA"
        aberto={aberto}
        aoFechar={fechar}
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={fechar}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!previa || !Object.keys(previa).length || aplicando}
              onClick={async () => {
                if (!previa) return;
                setAplicando(true);
                await aoAplicar(previa);
                registrarUsoIA(projetoId, 'Criar protocolo a partir de descrição', config, {
                  entidade: 'protocolo',
                });
                setAplicando(false);
                setGerado(null);
                fechar();
              }}
            >
              {aplicando && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
              Aplicar ao protocolo
            </button>
          </>
        }
      >
        {!config ? (
          <div className="alert alert-info small">
            Para criar o protocolo inteiro de uma vez, conecte sua conta de IA no Perfil (Anthropic, OpenAI, Gemini,
            OpenRouter ou Ollama). Sem conta conectada, use o botão <strong>IA</strong> de cada campo, que também abre o
            ChatGPT, Claude, Gemini ou Copilot na web.
          </div>
        ) : (
          <>
            <label htmlFor={`${id}-descricao`} className="form-label fw-medium">
              Descreva a pesquisa
            </label>
            <textarea
              id={`${id}-descricao`}
              className="form-control"
              rows={6}
              value={descricao}
              maxLength={8000}
              aria-describedby={`${id}-dica`}
              placeholder="Ex.: Revisão sistemática sobre o uso de ontologias para integrar dados hidrológicos abertos no Brasil, de 2015 a 2025, para apoiar a gestão de recursos hídricos."
              onChange={(e) => setDescricao(e.target.value)}
            />
            <div id={`${id}-dica`} className="form-text mb-3">
              Diga o assunto, o tipo de estudo, a população ou o contexto, o período e o objetivo. Quanto mais detalhes,
              melhor o resultado.
            </div>
            <div className="form-check mb-3">
              <input
                id={`${id}-vazios`}
                type="checkbox"
                className="form-check-input"
                checked={soVazios}
                onChange={(e) => setSoVazios(e.target.checked)}
              />
              <label htmlFor={`${id}-vazios`} className="form-check-label">
                Preencher só os campos em branco (manter o que já escrevi)
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary mb-3"
              disabled={descricao.trim().length < 20 || gerando}
              onClick={gerar}
            >
              {gerando ? (
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
              ) : (
                <i className="bi bi-stars me-1" aria-hidden="true" />
              )}
              {gerando ? 'Gerando o protocolo…' : 'Gerar com minha conta'}
            </button>
            <ErroAlerta erro={erro} />
            {previa && (
              <div role="status">
                {Object.keys(previa).length ? (
                  <>
                    <p className="small mb-2">
                      Campos que serão preenchidos ({Object.keys(previa).length}). Você pode revisar e editar cada passo
                      depois.
                    </p>
                    <ul className="small">
                      {(Object.keys(previa) as (keyof Rascunho)[]).map((k) => (
                        <li key={k}>{NOMES[k] ?? k}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="small">Nada a preencher: todos os campos já têm conteúdo.</p>
                )}
                <details className="small mb-2">
                  <summary>Ver o protocolo gerado</summary>
                  <pre className="k-leitura small border rounded p-2 mt-2" style={{ maxHeight: 300, overflow: 'auto' }}>
                    {JSON.stringify(gerado, null, 2)}
                  </pre>
                </details>
              </div>
            )}
            <div className="form-text">
              <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />
              {AVISO_IA}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
