import nextra from 'nextra';

const withNextra = nextra({
  contentDirBasePath: '/',
  defaultShowCopyCode: true,
});

const basePath = process.env.GITHUB_ACTIONS ? '/rustrak' : '';

export default withNextra({
  output: 'export',
  images: { unoptimized: true },
  basePath,
  assetPrefix: process.env.GITHUB_ACTIONS ? '/rustrak/' : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
});
