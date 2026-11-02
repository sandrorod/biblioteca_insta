import { render, screen } from '@testing-library/react';
import { Linkify } from './Linkify';

describe('links nos comentários', () => {
  it('transforma URLs em links que abrem em nova aba', () => {
    render(<Linkify text="Veja https://exemplo.com/a?b=1, e também www.site.com.br. Fim" />);
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://exemplo.com/a?b=1', 'https://www.site.com.br']);
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/Fim/)).toBeInTheDocument();
  });

  it('não vira link sem http(s)/www (ex.: javascript:)', () => {
    render(<Linkify text="javascript:alert(1) e texto comum" />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
