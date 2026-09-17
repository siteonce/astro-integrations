import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { t, useTranslations } from './t.ts';

describe('catalogs', () => {
  it('returns chrome for en and de', () => {
    assert.equal(t('en', 'notFound.title'), 'Page not found');
    assert.equal(t('de', 'notFound.title'), 'Seite nicht gefunden');
    assert.equal(t('en', 'blog.title'), 'Blog');
    assert.equal(t('de', 'home.muted.title'), 'Gedämpfte Fläche');
  });

  it('binds locale through useTranslations', () => {
    const en = useTranslations('en', 'notFound');
    const de = useTranslations('de', 'notFound');
    assert.equal(en('backHome'), 'Back to home');
    assert.equal(de('backHome'), 'Zur Startseite');
  });
});
