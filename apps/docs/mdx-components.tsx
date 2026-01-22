import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';
import { Video } from './src/components/video';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useMDXComponents = (components: any = {}) =>
  getDocsMDXComponents({ ...components, Video });
