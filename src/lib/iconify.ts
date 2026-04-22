export type IconSearchResult = {
  icons: string[]
  total: number
  limit: number
}

/**
 * Search Iconify for icon names.
 * @param query free-text query
 * @param opts.prefix restrict to a collection (e.g. 'ph' for Phosphor). Empty = all collections.
 * @param opts.limit max results
 */
export async function searchIcons(
  query: string,
  opts: { prefix?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<IconSearchResult> {
  const q = query.trim()
  if (!q) return { icons: [], total: 0, limit: 0 }

  const params = new URLSearchParams({
    query: q,
    limit: String(opts.limit ?? 32),
  })
  if (opts.prefix) params.set('prefix', opts.prefix)

  const url = `https://api.iconify.design/search?${params}`
  const res = await fetch(url, { signal: opts.signal })
  if (!res.ok) return { icons: [], total: 0, limit: 0 }
  const data = (await res.json()) as IconSearchResult
  return data
}
