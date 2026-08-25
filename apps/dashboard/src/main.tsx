import { RouterProvider } from '@tanstack/react-router';
import ReactDOM from 'react-dom/client';
import { getRouter } from './router';

const router = getRouter();

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('#app is missing from index.html');
}

ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
