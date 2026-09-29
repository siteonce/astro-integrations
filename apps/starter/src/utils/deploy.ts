// Host check the customer edits: map this host's environment onto one exclusive
// deploy class. Lives here, not `astro:env`. This is the only file that reads
// host env; everything else branches on `deployClass`.
type DeployClass = 'production' | 'preview' | 'local';

const hostContext = process.env.CONTEXT;

export const deployClass: DeployClass =
  hostContext === 'production'
    ? 'production'
    : hostContext === 'deploy-preview' || hostContext === 'branch-deploy'
      ? 'preview'
      : 'local';
