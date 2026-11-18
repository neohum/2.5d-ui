import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  id?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  id,
  className = "",
  disabled,
  ...props
}) => {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  // Enforces symmetric 1px border, 44px min height touch target, and high contrast
  const inputClasses = [
    "w-full min-h-[44px] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100",
    "bg-white dark:bg-zinc-900 rounded-lg",
    "border border-zinc-300 dark:border-zinc-700",
    "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
    "disabled:opacity-50 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed",
    error ? "border-red-500 focus:ring-red-500" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none break-keep"
        >
          {label}
        </label>
      ) : null}

      <input
        id={inputId}
        className={inputClasses}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        {...props}
      />

      {error ? (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400 break-keep">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-zinc-500 dark:text-zinc-400 break-keep">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

Input.displayName = "Input";
