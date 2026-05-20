'use client';

import { useEffect } from 'react';

export function BlogLayoutClient() {
  useEffect(() => {
    document.body.classList.add('blog-layout');
    return () => {
      document.body.classList.remove('blog-layout');
    };
  }, []);
  return null;
}
