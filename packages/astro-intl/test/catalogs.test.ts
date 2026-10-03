import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createT } from '@repo/astro-intl';

describe('catalogs', () => {
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
    // Noon UTC, formatted in UTC, so the short date does not follow the host zone.
    const zone = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      const { t } = createT({
        en: { posted: 'Posted {date, date, short}' },
      });
      assert.equal(t('en', 'posted', { date: new Date('2026-01-15T12:00:00Z') }), 'Posted 1/15/26');
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
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
