import { createRoot } from 'react-dom/client';
import { applyAction, newGame } from './core/state';
import { cards } from './content/cards';

function App() {
  const { state } = applyAction(newGame('dev'), { type: 'gainEmbers', amount: 3 });
  return (
    <main>
      <h1>Emberward</h1>
      <p>{cards.length} cards loaded. Embers: {state.embers}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
