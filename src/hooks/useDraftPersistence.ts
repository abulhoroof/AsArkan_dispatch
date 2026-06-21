import { useRef, useCallback, useEffect } from 'react';

export function useDraftPersistence<T>(key: string) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const loadDraft = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error(`Error reading draft "${key}":`, error);
      return null;
    }
  }, [key]);

  const saveDraft = useCallback((data: T) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (error) {
        console.error(`Error saving draft "${key}":`, error);
      }
    }, 500);
  }, [key]);

  const clearDraft = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    localStorage.removeItem(key);
  }, [key]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { loadDraft, saveDraft, clearDraft };
}

/** Remove all draft keys and form-open keys from localStorage (call on logout) */
export function clearAllDrafts() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('draft:') || key?.startsWith('form-open:')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
