import { activeFilterCount, cleanFilters, filtersFromParams, paramsFromFilters } from './filters';

describe('filtros da galeria', () => {
  it('ida e volta pela URL', () => {
    const filters = { search: 'natal', tag_ids: ['a', 'b'], favorites: true, has_comments: false, category_id: 'c1', published_from: '2024-01-01' };
    const params = paramsFromFilters(filters, 'title_asc');
    expect(filtersFromParams(params)).toEqual({ filters, sort: 'title_asc' });
  });

  it('ordenação inválida volta para a padrão', () => {
    expect(filtersFromParams(new URLSearchParams('sort=hack')).sort).toBe('recent');
  });

  it('limpa vazios mas mantém has_comments=false e archived=false', () => {
    expect(cleanFilters({ search: '  ', tag_ids: [], favorites: false, has_comments: false, archived: false, profile: ' x ' })).toEqual({
      has_comments: false,
      archived: false,
      profile: 'x',
    });
  });

  it('conta filtros ativos (sem a pesquisa)', () => {
    expect(activeFilterCount({ search: 'x' })).toBe(0);
    expect(activeFilterCount({ tag_ids: ['a'], untagged: false, created_from: '2024-01-01', has_comments: true })).toBe(3);
  });
});
