import { useEffect, useRef } from 'react';

// Server query objects may change on focus, reconnect or save. Only a new
// scoring context may hydrate editable state; locks still use live queries.
export function useScoreFormInitialization(scope: string | null, ready: boolean, initialize: () => void) {
  const initializedScope = useRef<string | null>(null);
  useEffect(() => {
    if (scope === null) {
      initializedScope.current = null;
      return;
    }
    if (!ready || initializedScope.current === scope) return;
    initializedScope.current = scope;
    initialize();
  }, [scope, ready, initialize]);
}