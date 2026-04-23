export function Button({
  children,
  variant = "primary",
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button className={`button ${variant}`} onClick={onClick} type="button" disabled={disabled}>
      {children}
    </button>
  );
}
