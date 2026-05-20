export default {
  index: {
    title: 'Home',
    type: 'page',
    display: 'hidden',
    theme: {
      layout: 'full',
      sidebar: false,
      toc: false,
      breadcrumb: false,
      pagination: false,
      navbar: false,
      footer: false,
    },
  },
  documentation: {
    title: 'Documentation',
    type: 'page',
    href: '/getting-started/overview',
  },
  blog: {
    title: 'Blog',
    type: 'page',
    theme: {
      sidebar: false,
      toc: false,
      breadcrumb: false,
      pagination: false,
    },
  },
  'getting-started': 'Getting Started',
  configuration: 'Configuration',
  usage: 'Usage',
  sdks: 'SDKs & Integrations',
  troubleshooting: 'Troubleshooting',
  '---': {
    type: 'separator',
  },
  reference: {
    title: 'Reference',
    type: 'menu',
    items: {
      'api-reference': { title: 'API Reference', href: '/api-reference' },
      architecture: { title: 'Architecture', href: '/reference/architecture' },
      contributing: { title: 'Contributing', href: '/reference/contributing' },
    },
  },
};
