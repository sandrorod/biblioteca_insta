export interface TaxonomyRef {
  id: string;
  name: string;
  color: string;
}

export interface Video {
  id: string;
  title: string;
  instagram_url: string;
  description: string | null;
  thumbnail_url: string | null;
  profile_name: string | null;
  category_id: string | null;
  original_publish_date: string | null;
  notes: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  comments_count: number;
  created_at: string;
  updated_at: string;
  /** Dados trazidos do Instagram (legenda original, autor, números e data real da publicação) */
  /** Legenda salva em português (traduzida quando a original era de outro idioma) */
  instagram_caption: string | null;
  instagram_caption_original: string | null;
  instagram_caption_lang: string | null;
  instagram_author_name: string | null;
  instagram_like_count: number | null;
  instagram_comment_count: number | null;
  instagram_taken_at: string | null;
  instagram_fetched_at: string | null;
  category: TaxonomyRef | null;
  tags: TaxonomyRef[];
  /** Valor da ordenação atual (usado como cursor da próxima página) */
  sort_key: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
  created_at: string;
  video_count: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
  video_count: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  color: string;
  cover_url: string | null;
  display_cover_url: string | null;
  created_at: string;
  updated_at: string;
  video_count: number;
}

export interface Comment {
  id: string;
  video_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type SortOption = 'recent' | 'oldest' | 'title_asc' | 'title_desc' | 'updated';

/** Filtros da galeria — os nomes batem com o JSON aceito por biblioteca_list_videos/biblioteca_count_videos. */
export interface VideoFilters {
  search?: string;
  category_id?: string;
  uncategorized?: boolean;
  tag_ids?: string[];
  untagged?: boolean;
  favorites?: boolean;
  archived?: boolean;
  profile?: string;
  has_comments?: boolean;
  created_from?: string;
  created_to?: string;
  published_from?: string;
  published_to?: string;
  collection_id?: string;
}

export interface VideoInput {
  title: string;
  instagram_url: string;
  description: string | null;
  thumbnail_url: string | null;
  profile_name: string | null;
  category_id: string | null;
  original_publish_date: string | null;
  notes: string | null;
}

export interface DashboardStats {
  videos: number;
  archived: number;
  favorites: number;
  categories: number;
  tags: number;
  collections: number;
  comments: number;
  added_last_7_days: number;
  top_categories: (TaxonomyRef & { video_count: number })[];
  top_tags: (TaxonomyRef & { video_count: number })[];
}
