import React from 'react';

interface FormSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  children,
  className = '',
}) => {
  return (
    <div className={`form-section ${className}`.trim()}>
      {title && <h4 className="section-title">{title}</h4>}
      {children}
    </div>
  );
};
