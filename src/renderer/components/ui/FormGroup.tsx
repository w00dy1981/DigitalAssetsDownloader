import React from 'react';

interface FormGroupProps {
  label?: string;
  htmlFor?: string;
  helpText?: string;
  children: React.ReactNode;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  label,
  htmlFor,
  helpText,
  children,
}) => {
  return (
    <div className="form-group">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {helpText && <small className="text-muted">{helpText}</small>}
    </div>
  );
};
