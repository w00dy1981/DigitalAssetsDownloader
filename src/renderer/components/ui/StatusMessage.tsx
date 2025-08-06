import React from 'react';

interface StatusMessageProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  className?: string;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  message,
  type = 'info',
  className = '',
}) => {
  if (!message) return null;

  const typeClasses = {
    success: 'text-success',
    error: 'text-danger',
    info: 'text-info',
    warning: 'text-warning',
  };

  return (
    <div className={`status-message ${typeClasses[type]} ${className}`.trim()}>
      {message}
    </div>
  );
};
