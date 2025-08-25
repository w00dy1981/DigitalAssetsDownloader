import React from 'react';

export interface FormGroupProps {
  label?: string;
  htmlFor?: string;
  helpText?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * FormGroup - A reusable wrapper component for form fields
 *
 * Provides consistent structure for form elements with:
 * - Optional label with htmlFor association
 * - Form control wrapper
 * - Optional help text
 * - Custom CSS class support
 *
 * @param label - Optional label text
 * @param htmlFor - ID of the form control this label is for
 * @param helpText - Optional help text shown below the form control
 * @param children - The form control element(s)
 * @param className - Additional CSS classes to apply to the form-group
 */
export const FormGroup: React.FC<FormGroupProps> = ({
  label,
  htmlFor,
  helpText,
  children,
  className = '',
}) => {
  return (
    <div className={`form-group${className ? ` ${className}` : ''}`}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {helpText && <small className="text-muted">{helpText}</small>}
    </div>
  );
};
