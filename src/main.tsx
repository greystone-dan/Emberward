import { createRoot } from 'react-dom/client';
import { cards } from './content/cards';
import { installDebugApi } from './ui/debug';

function App() {
  return (
    <main data-testid="app">
      <h1>Emberward</h1>
      <p>{cards.length} cards loaded.</p>
    </main>
  );
}

installDebugApi();
createRoot(document.getElementById('root')!).render(<App />);
