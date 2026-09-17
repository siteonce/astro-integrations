import { createT } from '@repo/astro-intl';
import de from './messages/de.json' with { type: 'json' };
import en from './messages/en.json' with { type: 'json' };

export const { t, useTranslations } = createT({ en, de });
