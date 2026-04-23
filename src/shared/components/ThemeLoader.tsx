export function ThemeLoader({ label = "Loading" }: { label?: string }) {
  return (
    <span className="theme-loader" role="status" aria-label={label}>
      <span className="theme-loader-bar" />
      <span className="theme-loader-bar" />
      <span className="theme-loader-bar" />
    </span>
  );
}
