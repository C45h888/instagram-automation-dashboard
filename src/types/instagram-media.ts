// src/types/instagram-media.ts
/**
 * Instagram Media Types
 * Based on Meta Graph API v19.0 spec
 */

export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';

export interface InstagramMedia {
  id: string;
  media_type: InstagramMediaType;
  media_url: string;
  thumbnail_url?: string;
  caption?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface MediaGridResponse {
  success: boolean;
  data: InstagramMedia[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
  rate_limit: {
    remaining: number | string;
    limit: number;
    window: string;
  };
  // Error properties
  error?: string;
  code?: string;
  details?: any;
}

export interface CreatePostRequest {
  userId: string;
  businessAccountId: string;
  caption: string;
  image_url: string;
}

export interface CreatePostResponse {
  success: boolean;
  message?: string;
  data?: {
    media_id: string;
    creation_id: string;
  };
  rate_limit: {
    remaining: number | string;
    limit: number;
    window: string;
  };
  error?: string;
  code?: string;
  details?: any;
}
