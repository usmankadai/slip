import { DevHarness } from './dev/DevHarness.tsx';

/**
 * Placeholder shell. No screen is built until its low-fidelity flow exists
 * (docs/spec/design.md). Until then the developer harness is the whole app.
 */
export function App() {
  return (
    <main>
      <h1>Slip</h1>
      <p>Schedule update review. The import screen is not built yet.</p>
      <DevHarness />
    </main>
  );
}
