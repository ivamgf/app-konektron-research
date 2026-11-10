import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { contemTermo, ehFase1ou2, normalizar, termosDasStrings } from '../pages/revisao/termosBusca';
import { gravarConfigIA, lerConfigIA, lerJson, montarPedidoCampo, pedidoParaAssistente } from '../lib/ia';
import { contextoDoProtocolo, rascunhoDoGerado } from '../pages/projeto/ProtocoloIA';
import { rascunhoDe } from '../pages/projeto/protocoloPassos';
import { BotaoIA } from '../components/IA';
import type { EtapaRevisao, Protocolo } from '../lib/tipos';

describe('verificação dos termos de busca na triagem', () => {
  it('normaliza acentos e pontuação e acha termos inteiros ou com curinga', () => {
    const t = normalizar('Ontologias de Domínio: dados ABERTOS (Brasil)');
    expect(contemTermo(t, 'dominio')).toBe(true);
    expect(contemTermo(t, 'dados abertos')).toBe(true);
    expect(contemTermo(t, 'ontolog*')).toBe(true);
    expect(contemTermo(t, 'ontologia')).toBe(false); // palavra inteira: "ontologias" não é "ontologia"
    expect(termosDasStrings(['"open data" AND ("ontology" OR "ontologies")'])).toEqual([
      'open data',
      'ontology',
      'ontologies',
    ]);
  });

  it('vale só nas duas primeiras etapas de triagem', () => {
    const e = (id: string, ordem: number, categoria = 'TRIAGEM') =>
      ({ id, ordem, categoria, exigeTriagem: true }) as EtapaRevisao;
    const etapas = [e('b', 2, 'BUSCA'), e('t1', 3), e('t2', 4), e('t3', 5)];
    expect(ehFase1ou2(etapas[1], etapas)).toBe(true);
    expect(ehFase1ou2(etapas[2], etapas)).toBe(true);
    expect(ehFase1ou2(etapas[3], etapas)).toBe(false);
    expect(ehFase1ou2(etapas[0], etapas)).toBe(false);
  });
});

describe('IA com a conta do usuário', () => {
  afterEach(() => gravarConfigIA(null));

  it('lê JSON mesmo cercado por ```json e texto', () => {
    expect(lerJson<{ a: number }>('Aqui está:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(() => lerJson('sem json')).toThrow(/formato/);
  });

  it('guarda a chave só na sessão, a não ser que o usuário peça para lembrar', () => {
    gravarConfigIA({ provedor: 'anthropic', chave: 'sk-ant-x', modelo: 'claude-opus-5-5', lembrar: false });
    expect(sessionStorage.getItem('konektron.ia')).toContain('sk-ant-x');
    expect(localStorage.getItem('konektron.ia')).toBeNull();
    expect(lerConfigIA()?.modelo).toBe('claude-opus-5-5');
    gravarConfigIA(null);
    expect(lerConfigIA()).toBeNull();
  });

  it('monta o pedido do campo com contexto, texto atual e pedido adicional', () => {
    const p = montarPedidoCampo({
      campo: 'Justificativa',
      contexto: 'Tema: dados abertos',
      atual: 'Texto antigo',
      acao: 'melhorar',
      extra: 'até 100 palavras',
    });
    const tudo = pedidoParaAssistente(p);
    expect(tudo).toContain('Campo do formulário: "Justificativa".\nTarefa: Revise e melhore o texto atual do campo');
    expect(tudo).toContain('Tema: dados abertos');
    expect(tudo).toContain('Texto antigo');
    expect(tudo).toContain('até 100 palavras');
    expect(tudo).toMatch(/Não invente/);
  });

  it('sem conta conectada, o botão IA oferece copiar o pedido e abrir um assistente na web', async () => {
    render(
      <MemoryRouter>
        <BotaoIA campo="Tema" contexto={() => 'Questão: X'} valor="" aoAplicar={() => {}} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Assistente de IA para o campo Tema' }));
    expect(screen.getByRole('dialog', { name: 'IA · Tema' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copiar pedido e abrir/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerar com minha conta' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar este texto' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Resultado'), 'Tema colado do assistente');
    expect(screen.getByRole('button', { name: 'Usar este texto' })).toBeEnabled();
  });
});

describe('protocolo gerado pela IA', () => {
  const base = rascunhoDe({
    tema: 'Já escrito',
    questaoPesquisa: null,
    hipotese: null,
    objetivoGeral: null,
    justificativa: null,
    outrasQuestoes: [],
    objetivos: [],
    palavrasChave: [],
    descritores: [],
    strings: [],
    resumos: [],
  } as unknown as Protocolo);
  const idiomas = [
    { id: 1, codigo: 'pt', nome: 'Português' },
    { id: 2, codigo: 'en', nome: 'Inglês' },
  ];
  const gerado = {
    tema: 'Novo tema',
    questaoPesquisa: 'Como?',
    objetivos: ['Analisar A', 'Propor B'],
    palavrasChave: [
      { termo: 'ontologia', idioma: 'pt' },
      { termo: 'ontology', idioma: 'en' },
    ],
    metodologiaTipo: 'revisao_sistematica',
    resumo: 'Resumo gerado.',
  };

  it('preenche só os campos em branco e converte idiomas e metodologia', () => {
    const p = rascunhoDoGerado(gerado, base, idiomas, true);
    expect(p.tema).toBeUndefined();
    expect(p.questaoPesquisa).toBe('Como?');
    expect(p.objetivos).toEqual([{ texto: 'Analisar A' }, { texto: 'Propor B' }]);
    expect(p.palavrasChave).toEqual([
      { termo: 'ontologia', idiomaId: 1 },
      { termo: 'ontology', idiomaId: 2 },
    ]);
    expect(p.metodologiaTipo).toBe('REVISAO_SISTEMATICA');
    expect(p.resumos?.find((r) => r.idioma === 'pt')?.texto).toBe('Resumo gerado.');
  });

  it('pode substituir tudo e monta o contexto com o que foi preenchido', () => {
    expect(rascunhoDoGerado(gerado, base, idiomas, false).tema).toBe('Novo tema');
    expect(contextoDoProtocolo({ ...base, questaoPesquisa: 'Como?' })).toBe(
      'Tema: Já escrito\nQuestão de pesquisa: Como?',
    );
  });
});
