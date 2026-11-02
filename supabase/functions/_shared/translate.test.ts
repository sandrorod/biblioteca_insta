import { chunkText, splitProtected, translateToPortuguese } from './translate';

/** Tradutor falso: marca o texto e informa o idioma; registra os pedidos. */
function fakeFetch(lang = 'es', fail = false) {
  const calls: string[] = [];
  const fn = async (url: string) => {
    const q = new URL(url).searchParams.get('q')!;
    calls.push(q);
    if (fail) return { ok: true, json: async () => ({ responseStatus: 429, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY' } }) };
    return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: `PT(${q})`, detectedLanguage: lang } }) };
  };
  return { fn, calls };
}

describe('tradução da legenda', () => {
  it('traduz o texto e preserva hashtags, menções, links e quebras de linha', async () => {
    const { fn, calls } = fakeFetch('es');
    const r = await translateToPortuguese('Hola amigos #chess @leomessi\nMirá https://x.com/a ya', fn);
    expect(r).toEqual({ text: 'PT(Hola amigos) #chess @leomessi\nPT(Mirá) https://x.com/a PT(ya)', lang: 'es', translated: true });
    expect(calls).toEqual(['Hola amigos', 'Mirá', 'ya']);
  });

  it('legenda em português não é traduzida (e para no primeiro pedido)', async () => {
    const { fn, calls } = fakeFetch('pt');
    const r = await translateToPortuguese('Agora você pode clonar a sua voz.\nSegunda linha', fn);
    expect(r).toEqual({ text: 'Agora você pode clonar a sua voz.\nSegunda linha', lang: 'pt', translated: false });
    expect(calls).toHaveLength(1);
  });

  it('cota esgotada: devolve a original sem erro', async () => {
    const { fn } = fakeFetch('es', true);
    expect(await translateToPortuguese('Hola', fn)).toEqual({ text: 'Hola', lang: null, translated: false });
  });

  it('só hashtags: nada a traduzir', async () => {
    const { fn, calls } = fakeFetch('es');
    expect(await translateToPortuguese('#a #b', fn)).toEqual({ text: '#a #b', lang: null, translated: false });
    expect(calls).toHaveLength(0);
  });

  it('divide textos longos em pedaços de até 450 caracteres, por frase', () => {
    const long = Array.from({ length: 30 }, (_, i) => `Frase número ${i} com algumas palavras.`).join(' ');
    const chunks = chunkText(long);
    expect(chunks.every((c) => c.length <= 450)).toBe(true);
    expect(chunks.join(' ')).toBe(long);
    expect(chunkText('a'.repeat(10) + ' ' + 'b '.repeat(400)).every((c) => c.length <= 450)).toBe(true);
  });

  it('separa trechos protegidos', () => {
    expect(splitProtected('oi #tag fim')).toEqual([
      { text: 'oi ', translate: true },
      { text: '#tag', translate: false },
      { text: ' fim', translate: true },
    ]);
  });
});
