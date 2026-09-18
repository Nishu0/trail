export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 7h6V3h6v6h6V5h8v6h-4v6h-6v6h-4v6H9V19H3V7Z"
        fill="currentColor"
      />
      <path d="M9 13h6v6H9zM19 11h6v6h-6z" fill="var(--mark-cutout,#fff)" />
    </svg>
  );
}
