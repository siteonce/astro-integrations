import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createT } from './create-t.ts';

describe('createT', () => {
  it('does not load catalog files itself', () => {
    const source = readFileSync(fileURLToPath(new URL('./create-t.ts', import.meta.url)), 'utf8');
    assert.doesNotMatch(source, /\bnode:fs\b/);
    assert.doesNotMatch(source, /\breadFile(?:Sync)?\b/);
    assert.doesNotMatch(source, /\bcreateJiti\b/);
    assert.doesNotMatch(source, /\.json['"]/);
  });

  it('resolves nested ICU keys', () => {
    const { t } = createT({
      en: { HomePage: { greeting: 'Hello {name}' } },
    });
    assert.equal(t('en', 'HomePage.greeting', { name: 'Ada' }), 'Hello Ada');
  });

  it('formats ICU plurals', () => {
    const { t } = createT({
      en: { items: '{count, plural, one {# item} other {# items}}' },
    });
    assert.equal(t('en', 'items', { count: 1 }), '1 item');
    assert.equal(t('en', 'items', { count: 3 }), '3 items');
  });

  it('formats ICU dates with built-in styles', () => {
    const { t } = createT({
      en: { posted: 'Posted {date, date, short}' },
    });
    assert.match(t('en', 'posted', { date: new Date('2026-01-15T00:00:00Z') }), /^Posted /);
  });

  it('leaves missing keys visible and does not merge from another locale', () => {
    const { t } = createT({
      en: { HomePage: { title: 'Home' } },
      de: { HomePage: {} },
    });
    assert.equal(t('de', 'HomePage.title'), 'HomePage.title');
    assert.equal(t('fr', 'HomePage.title'), 'HomePage.title');
  });

  it('binds locale and namespace through useTranslations', () => {
    const { useTranslations } = createT({
      de: { Auth: { SignUp: { title: 'Konto anlegen' } } },
    });
    const t = useTranslations('de', 'Auth.SignUp');
    assert.equal(t('title'), 'Konto anlegen');
    assert.equal(t('missing'), 'Auth.SignUp.missing');
  });
});
