import type { Loader, LoaderContext } from 'astro/loaders';

type DraftStore = Pick<LoaderContext['store'], 'values' | 'delete'>;

/** Deletes every entry whose `data.status` is `draft`. */
export function deleteDrafts(store: DraftStore): void {
  for (const entry of store.values()) {
    if (entry.data.status === 'draft') store.delete(entry.id);
  }
}

/**
 * Wraps a loader so drafts never enter the collection unless `keepDrafts`.
 * The sweep runs after the wrapped load, so it also removes drafts the
 * loader kept from a cached store without writing them again.
 */
export function withoutDrafts(loader: Loader, keepDrafts: boolean): Loader {
  if (keepDrafts) return loader;
  return {
    ...loader,
    name: `${loader.name}-without-drafts`,
    load: async (context) => {
      await loader.load(context);
      deleteDrafts(context.store);
    },
  };
}
