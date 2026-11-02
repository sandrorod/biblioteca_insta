import { isInstagramCdn, parseLooterPost, titleFromCaption } from './looter';

const sample = {
  status: true,
  attempts: 0,
  data: {
    full_name: 'Leo Messi',
    username: 'leomessi',
    medias: [{ type: 'video', link: 'https://scontent-ord5-2.cdninstagram.com/o1/v/t2/video.mp4', img: 'https://scontent-ord5-1.cdninstagram.com/v/t51/cover.jpg' }],
    comment_count: 22528,
    like_count: 2431120,
    taken_at_timestamp: 1792602086,
    caption: 'Le pedí a ChatGPT que me enseñara una apertura de ajedrez #chess #ai\nSegunda linha',
  },
};

describe('resposta da Instagram Looter (/post-dl)', () => {
  it('extrai legenda, autor, contagens, data e mídias', () => {
    expect(parseLooterPost(sample)).toEqual({
      username: 'leomessi',
      authorName: 'Leo Messi',
      caption: 'Le pedí a ChatGPT que me enseñara una apertura de ajedrez #chess #ai\nSegunda linha',
      likeCount: 2431120,
      commentCount: 22528,
      takenAt: '2026-10-21T17:01:26.000Z',
      publishDate: '2026-10-21',
      videoUrl: 'https://scontent-ord5-2.cdninstagram.com/o1/v/t2/video.mp4',
      imageUrl: 'https://scontent-ord5-1.cdninstagram.com/v/t51/cover.jpg',
    });
  });

  it('data no fuso de Brasília (publicação às 01h UTC conta no dia anterior)', () => {
    const at = Date.UTC(2026, 0, 2, 1, 0, 0) / 1000;
    expect(parseLooterPost({ status: true, data: { taken_at_timestamp: at } })?.publishDate).toBe('2026-01-01');
  });

  it('erro ou resposta vazia vira null', () => {
    expect(parseLooterPost({ status: false, errorMessage: 'Internal Error' })).toBeNull();
    expect(parseLooterPost({} as never)).toBeNull();
  });

  it('título a partir da legenda', () => {
    expect(titleFromCaption(sample.data.caption)).toBe('Le pedí a ChatGPT que me enseñara una apertura de ajedrez');
    expect(titleFromCaption('#so #hashtags')).toBe('#so #hashtags');
    expect(titleFromCaption('a'.repeat(200))?.length).toBe(118);
    expect(titleFromCaption(null)).toBeNull();
  });

  it('só aceita mídia dos servidores do Instagram', () => {
    expect(isInstagramCdn('https://scontent.cdninstagram.com/x.mp4')).toBe(true);
    expect(isInstagramCdn('https://video.fbcdn.net/x.mp4')).toBe(true);
    expect(isInstagramCdn('https://evil.com/cdninstagram.com/x.mp4')).toBe(false);
    expect(isInstagramCdn('http://scontent.cdninstagram.com/x.mp4')).toBe(false);
  });
});
