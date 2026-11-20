import { useState, useRef, useCallback, useEffect } from 'react';

export function useStatusMessage() {
  const [message, setMessage] = useState('');
  const timeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timeout.current), []);

  const showMessage = useCallback((value: string, duration = 2000) => {
    clearTimeout(timeout.current);
    setMessage(value);
    timeout.current = setTimeout(() => setMessage(''), duration);
  }, []);

  return [message, showMessage] as const;
}
