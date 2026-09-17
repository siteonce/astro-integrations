import { deployConfigSchema } from '@repo/astro-site/schemas/config/deploy-config';

// Host check the customer edits: map this host's environment onto one exclusive
// deploy class. Lives here, not `astro:env`. Parsed on import.
const hostContext = process.env.CONTEXT;
const deployClass =
  hostContext === 'production'
    ? 'production'
    : hostContext === 'deploy-preview' || hostContext === 'branch-deploy'
      ? 'preview'
      : 'local';

export const deployConfig = deployConfigSchema.parse({
  class: deployClass,
});
