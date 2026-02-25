/**
 * useScheduledPosts.ts
 *
 * Fetches scheduled posts with infinite scroll pagination.
 * Provides approve/reject mutations that call AgentService and
 * optimistically update the TanStack Query cache.
 */

import { useState, useCallback } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { AgentService } from '../services/agentService'
import type {
  ScheduledPost,
  ScheduledPostFilterState,
  ScheduledPostStatus,
} from '@/types'
import { DEFAULT_SCHEDULED_POST_FILTERS } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

// ─────────────────────────────────────────────────────────────────────────────
// Result interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UseScheduledPostsResult {
  posts:         ScheduledPost[]
  isLoading:     boolean
  error:         string | null
  filters:       ScheduledPostFilterState
  setFilters:    (f: ScheduledPostFilterState) => void
  approvePost:   (postId: string) => Promise<void>
  rejectPost:    (postId: string) => Promise<void>
  hasNextPage:   boolean
  fetchNextPage: () => void
  refetch:       () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useScheduledPosts(businessAccountId: string | null): UseScheduledPostsResult {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ScheduledPostFilterState>(DEFAULT_SCHEDULED_POST_FILTERS)

  // ── Query key ──────────────────────────────────────────────────────────────
  const queryKey = ['scheduled-posts', businessAccountId, filters.status] as const

  // ── Infinite query ─────────────────────────────────────────────────────────
  const postsQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      if (!businessAccountId) return { items: [], total: 0, nextPage: undefined }

      const offset = (pageParam as number) * PAGE_SIZE
      // AgentService.getScheduledPosts fetches from offset 0 with a limit;
      // we drive pagination by computing the limit based on offset + PAGE_SIZE.
      const result = await AgentService.getScheduledPosts(
        businessAccountId,
        filters.status === 'all' ? 'all' : (filters.status as ScheduledPostStatus),
        offset + PAGE_SIZE
      )

      if (!result.success) throw new Error(result.error ?? 'Failed to fetch scheduled posts')

      // Slice only the current page's items from the full result
      const allItems = result.data as ScheduledPost[]
      const items    = allItems.slice(offset, offset + PAGE_SIZE)
      const total    = result.count ?? allItems.length

      // Apply client-side search filter if set
      const filtered = filters.search
        ? items.filter(
            (p) =>
              p.caption?.toLowerCase().includes(filters.search.toLowerCase()) ||
              p.hashtags?.join(' ').toLowerCase().includes(filters.search.toLowerCase())
          )
        : items

      return {
        items:    filtered,
        total,
        nextPage: (offset + PAGE_SIZE) < total ? (pageParam as number) + 1 : undefined,
      }
    },
    initialPageParam:  0,
    getNextPageParam:  (lastPage) => lastPage.nextPage,
    enabled:           !!businessAccountId,
    staleTime:         2 * 60 * 1000,
    gcTime:            5 * 60 * 1000,
    retry:             3,
    retryDelay:        (i) => Math.min(1000 * 2 ** i, 30_000),
    refetchOnWindowFocus: false,
  })

  const posts = postsQuery.data?.pages.flatMap((p) => p.items) ?? []

  // ── Optimistic update helper ───────────────────────────────────────────────
  const updatePostStatus = useCallback(
    async (postId: string, status: ScheduledPostStatus): Promise<void> => {
      const result = await AgentService.updateScheduledPostStatus(postId, status)
      if (!result.success) throw new Error(result.error ?? 'Failed to update post status')

      // Update the cached post in-place across all pages
      queryClient.setQueryData(queryKey, (old: typeof postsQuery.data) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((p: ScheduledPost) =>
              p.id === postId ? { ...p, status } : p
            ),
          })),
        }
      })
    },
    [queryClient, queryKey]
  )

  const approvePost = useCallback(
    (postId: string) => updatePostStatus(postId, 'approved'),
    [updatePostStatus]
  )

  const rejectPost = useCallback(
    (postId: string) => updatePostStatus(postId, 'rejected'),
    [updatePostStatus]
  )

  // ── Error ──────────────────────────────────────────────────────────────────
  const error = postsQuery.error
    ? (postsQuery.error instanceof Error ? postsQuery.error.message : String(postsQuery.error))
    : null

  return {
    posts,
    isLoading:     postsQuery.isLoading,
    error,
    filters,
    setFilters,
    approvePost,
    rejectPost,
    hasNextPage:   postsQuery.hasNextPage ?? false,
    fetchNextPage: () => postsQuery.fetchNextPage(),
    refetch:       () => postsQuery.refetch(),
  }
}
