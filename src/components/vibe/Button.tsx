import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  disabled,
  children,
  ...props
}) => {
  // Base classes enforce:
  // 1. Perfect centering: inline-flex items-center justify-center leading-none
  // 2. Korean button single-line: whitespace-nowrap
  // 3. Minimum touch target: min-h-[44px] min-w-[44px]
  // 4. Symmetric border standard (never asymmetric borders)
  const baseClasses =
    "inline-flex items-center justify-center leading-none whitespace-nowrap font-medium transition-colors select-none focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-lg border";

  const sizeClasses: Record<"sm" | "md" | "lg", string> = {
    sm: "min-h-[44px] min-w-[44px] px-3 py-2 text-xs gap-1.5",
    md: "min-h-[44px] min-w-[44px] px-4 py-2.5 text-sm gap-2",
    lg: "min-h-[48px] min-w-[48px] px-6 py-3 text-base gap-2.5",
  };

  const variantClasses: Record<"primary" | "secondary" | "outline" | "ghost" | "danger", string> = {
    primary:
      "border-transparent bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 focus:ring-indigo-500 shadow-sm",
    secondary:
      "border-zinc-200 dark:border-zinc-800 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
    outline:
      "border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900",
    ghost:
      "border-transparent bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800",
    danger:
      "border-transparent bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 shadow-sm",
  };

  const combinedClasses = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim();

  return (
    <button
      className={combinedClasses}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center justify-center leading-none animate-spin mr-2">
          <i className="fi fi-rr-spinner text-base leading-none" />
        </span>
      ) : null}
      <span className="inline-flex items-center justify-center leading-none">
        {children}
      </span>
    </button>
  );
};

Button.displayName = "Button";
