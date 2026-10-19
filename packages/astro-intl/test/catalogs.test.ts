import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createT } from '@siteonce/astro-intl';
import { warningsFrom } from './fixtures.ts';

describe('catalogs', { concurrency: 1 }, () => {
  it('formats a nested message', () => {
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

  it('leaves a missing key visible and takes no message from another locale', () => {
    const { t } = createT({
      en: { HomePage: { title: 'Home' } },
      de: { HomePage: {} },
    });
    assert.equal(t('de', 'HomePage.title'), 'HomePage.title');
    assert.equal(t('fr', 'HomePage.title'), 'HomePage.title');
  });

  it('leaves a key visible when it names a group or runs past a message', () => {
    const { t } = createT({ en: { a: 'hi', HomePage: { title: 'Home' } } });
    assert.equal(t('en', 'a.b'), 'a.b');
    assert.equal(t('en', 'HomePage'), 'HomePage');
  });

  it('throws when a message is not valid ICU', () => {
    assert.throws(
      () => createT({ en: { greet: 'Hello {' } }),
      {
        message:
          '@siteonce/astro-intl: message "greet" in locale "en" is not valid ICU. Fix it in the "en" catalog.',
      },
      'en greet',
    );
    assert.throws(
      () =>
        createT({
          en: { greet: 'Hello {name}' },
          de: { HomePage: { greeting: 'Hallo {' } },
        }),
      {
        message:
          '@siteonce/astro-intl: message "HomePage.greeting" in locale "de" is not valid ICU. Fix it in the "de" catalog.',
      },
      'de HomePage.greeting',
    );
  });

  it('returns the message as written and warns when a value is missing', async () => {
    const { t } = createT({ en: { greet: 'Hello {name}' } });
    const warnings = await warningsFrom(async () => {
      assert.equal(t('en', 'greet'), 'Hello {name}');
    });
    assert.deepEqual(warnings, [
      '@siteonce/astro-intl: message "greet" in locale "en" is missing a value; returned as written.',
    ]);
  });

  it('returns the message as written and warns when a value has the wrong type', async () => {
    const cases: { key: string; message: string; values: Record<string, string> }[] = [
      { key: 'when', message: '{d, date}', values: { d: 'not a date' } },
      { key: 'count', message: '{n, number}', values: { n: 'many' } },
      { key: 'items', message: '{n, plural, other {# items}}', values: { n: 'many' } },
    ];
    for (const { key, message, values } of cases) {
      const { t } = createT({ en: { [key]: message } });
      const warnings = await warningsFrom(async () => {
        assert.equal(t('en', key, values), message, message);
      });
      assert.deepEqual(
        warnings,
        [
          `@siteonce/astro-intl: message "${key}" in locale "en" could not format a value; returned as written.`,
        ],
        message,
      );
    }
  });

  it('formats a numeric string as a number', async () => {
    const { t } = createT({ en: { count: '{n, number}' } });
    const warnings = await warningsFrom(async () => {
      assert.equal(t('en', 'count', { n: '3' }), '3');
    });
    assert.deepEqual(warnings, []);
  });

  it('reads a key in a bound locale and namespace', () => {
    const { useTranslations } = createT({
      de: { Auth: { SignUp: { title: 'Konto anlegen' } } },
    });
    const t = useTranslations('de', 'Auth.SignUp');
    assert.equal(t('title'), 'Konto anlegen');
    assert.equal(t('missing'), 'Auth.SignUp.missing');
  });
});
