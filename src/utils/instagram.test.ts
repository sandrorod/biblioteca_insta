import { instagramEmbedUrl, instagramKey, isInstagramUrl, normalizeInstagramUrl, parseInstagramPost, profileFromUrl } from './instagram';

describe('links do Instagram', () => {
  it('reconhece reel, post e tv (inclusive com perfil no caminho)', () => {
    expect(parseInstagramPost('https://www.instagram.com/reel/ABC123xyz/?igsh=abc')).toEqual({ kind: 'reel', shortcode: 'ABC123xyz' });
    expect(parseInstagramPost('https://instagram.com/reels/ABC123xyz')).toEqual({ kind: 'reel', shortcode: 'ABC123xyz' });
    expect(parseInstagramPost('https://www.instagram.com/p/C1-_x/')).toEqual({ kind: 'p', shortcode: 'C1-_x' });
    expect(parseInstagramPost('https://www.instagram.com/fulano/p/XYZ/')).toEqual({ kind: 'p', shortcode: 'XYZ' });
    expect(parseInstagramPost('https://www.instagram.com/fulano/')).toBeNull();
  });

  it('chave igual para o mesmo vídeo por /p/ e /reel/ (mesma regra do banco)', () => {
    expect(instagramKey('https://www.instagram.com/reel/ABC/?igsh=1')).toBe(instagramKey('https://instagram.com/p/ABC'));
    expect(instagramKey('https://Exemplo.com/a/?x=1')).toBe('https://exemplo.com/a');
  });

  it('limpa parâmetros de rastreamento', () => {
    expect(normalizeInstagramUrl(' https://www.instagram.com/reel/ABC/?igsh=xyz ')).toBe('https://www.instagram.com/reel/ABC/');
  });

  it('valida domínio e monta o player', () => {
    expect(isInstagramUrl('https://www.instagram.com/p/x')).toBe(true);
    expect(isInstagramUrl('https://evil.com/instagram.com/p/x')).toBe(false);
    expect(isInstagramUrl('nada')).toBe(false);
    expect(instagramEmbedUrl('https://www.instagram.com/reel/ABC/')).toBe('https://www.instagram.com/reel/ABC/embed/captioned/');
  });

  it('extrai perfil de link de perfil', () => {
    expect(profileFromUrl('https://www.instagram.com/editor.pro/')).toBe('editor.pro');
    expect(profileFromUrl('https://www.instagram.com/explore/')).toBeNull();
  });
});
