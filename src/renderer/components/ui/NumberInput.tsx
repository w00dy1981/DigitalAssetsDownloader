import React from 'react';

interface NumberInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  style?: React.CSSProperties;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  id,
  value,
  onChange,
  min,
  max,
  suffix,
  style,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value) || 0;
    onChange(numValue);
  };

  return (
    <div className="number-input-wrapper">
      <input
        id={id}
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        className="form-control number-input"
        style={style}
      />
      {suffix && <span className="input-suffix">{suffix}</span>}
    </div>
  );
};
