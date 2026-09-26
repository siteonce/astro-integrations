/**
 * Relation targets. Importing this module registers them.
 * The server bundle does not load `content.config.ts`, so a view that calls
 * `getRelated` imports this module itself.
 */
import { relation } from '@repo/astro-intl';

export const authorRelation = relation('authors');
export const sourceRelation = relation('sources');
export const roleRelation = relation('roles');
export const tagRelation = relation('tags');
