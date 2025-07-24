import { useState, useRef, useCallback } from 'react';

export const useStatusMessage = (initialValue: string = '') => {
  const [message, setMessage] = useState<string>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showMessage = useCallback((newMessage: string, duration: number = 2000) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setMessage(newMessage);
    timeoutRef.current = setTimeout(() => {
      setMessage('');
      timeoutRef.current = null;
    }, duration);
  }, []);

  const clearMessage = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setMessage('');
  }, []);

  return [message, showMessage, clearMessage] as const;
};