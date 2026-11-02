import { Fragment } from 'react';

// http(s)://… ou www.… até o próximo espaço; pontuação final (.,;:!?) e parênteses soltos ficam fora do link
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?'")\]])/gi;

/** Texto com os links clicáveis (abrem em nova aba). Só http/https: nada de javascript: ou outros esquemas. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part.toLowerCase().startsWith('www.') ? `https://${part}` : part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
