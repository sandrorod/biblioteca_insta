// Tradução da legenda para o português pela API gratuita do MyMemory (sem chave).
// Módulo puro: recebe o fetch por parâmetro (Edge Function usa o global; os testes, um falso).
// #hashtags, @menções e links não são traduzidos; textos longos vão em pedaços de até 450 caracteres.

const API = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK = 450;
/** Limite de pedidos por legenda (a cota gratuita é de ~5.000 caracteres por dia) */
const MAX_REQUESTS = 12;
const PROTECTED = /(https?:\/\/\S+|www\.\S+|#[\p{L}\p{N}_]+|@[\w.]+)/gu;

export interface TranslationResult {
  /** Texto final (traduzido ou, se não deu, o original) */
  text: string;
  /** Idioma detectado da original ("es", "en", "pt"…); null se não foi possível detectar */
  lang: string | null;
  translated: boolean;
}

type Fetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const decode = (s: string) =>
  s.replace(/&#39;|&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Pedaços de até `max` caracteres, quebrando em fim de frase e, se preciso, entre palavras. */
export function chunkText(text: string, max = MAX_CHUNK): string[] {
  const out: string[] = [];
  let cur = '';
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = '';
  };
  for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
    if (sentence.length > max) {
      push();
      for (const word of sentence.split(/\s+/)) {
        if ((cur + ' ' + word).trim().length > max) push();
        cur = (cur + ' ' + word).trim();
      }
      push();
    } else if ((cur + ' ' + sentence).trim().length > max) {
      push();
      cur = sentence;
    } else {
      cur = (cur + ' ' + sentence).trim();
    }
  }
  push();
  return out;
}

/** Partes da linha: texto a traduzir e trechos protegidos (hashtags, menções, links), na ordem. */
export function splitProtected(line: string): { text: string; translate: boolean }[] {
  const parts: { text: string; translate: boolean }[] = [];
  let last = 0;
  for (const m of line.matchAll(PROTECTED)) {
    if (m.index! > last) parts.push({ text: line.slice(last, m.index), translate: true });
    parts.push({ text: m[0], translate: false });
    last = m.index! + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), translate: true });
  // Só vale traduzir trechos com letras
  return parts.map((p) => (p.translate && !/\p{L}{2,}/u.test(p.text) ? { ...p, translate: false } : p));
}

export async function translateToPortuguese(text: string, fetchFn: Fetch): Promise<TranslationResult> {
  const original = { text, lang: null, translated: false };
  if (!text.trim()) return original;
  let requests = 0;
  let lang: string | null = null;

  const translateChunk = async (chunk: string): Promise<string> => {
    if (++requests > MAX_REQUESTS) throw new Error('legenda longa demais para a cota gratuita');
    const url = `${API}?${new URLSearchParams({ q: chunk, langpair: `${lang ?? 'autodetect'}|pt-BR` })}`;
    const res = await fetchFn(url);
    if (!res.ok) throw new Error('tradutor indisponível');
    const body = (await res.json()) as { responseStatus?: number | string; responseData?: { translatedText?: string; detectedLanguage?: string } };
    const out = body.responseData?.translatedText;
    if (Number(body.responseStatus) !== 200 || !out || /MYMEMORY WARNING/i.test(out)) throw new Error('cota de tradução esgotada');
    lang ??= body.responseData?.detectedLanguage?.slice(0, 2).toLowerCase() ?? null;
    return decode(out);
  };

  try {
    const lines: string[] = [];
    for (const line of text.split('\n')) {
      let built = '';
      for (const part of splitProtected(line)) {
        if (!part.translate) {
          built += part.text;
          continue;
        }
        // Preserva os espaços das pontas (entre o texto e uma hashtag, por exemplo)
        const lead = part.text.match(/^\s*/)![0];
        const trail = part.text.match(/\s*$/)![0];
        const pieces: string[] = [];
        for (const chunk of chunkText(part.text.trim())) {
          pieces.push(await translateChunk(chunk));
          // Já está em português: devolve a original sem gastar mais cota
          if (lang === 'pt') return { text, lang: 'pt', translated: false };
        }
        built += lead + pieces.join(' ') + trail;
      }
      lines.push(built);
    }
    if (lang === null) return original;
    return { text: lines.join('\n'), lang, translated: true };
  } catch {
    return { text, lang, translated: false };
  }
}
