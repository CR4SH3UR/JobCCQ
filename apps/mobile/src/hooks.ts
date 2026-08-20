/**
 * Petits hooks React réutilisés par les écrans.
 */
import { useEffect, useState } from "react";

/** Retourne `value`, mais mis à jour seulement après `delay` ms d'inactivité. */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
