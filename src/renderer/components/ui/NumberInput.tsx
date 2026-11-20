import React from 'react';

interface NumberInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
  suffix?: string;
  style?: React.CSSProperties;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  id,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  style,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.valueAsNumber);
  };

  return (
    <div className="number-input-wrapper">
      <input
        id={id}
        type="number"
        value={Number.isNaN(value) ? '' : value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        className="form-control number-input"
        style={style}
      />
      {suffix && <span className="input-suffix">{suffix}</span>}
    </div>
  );
};
