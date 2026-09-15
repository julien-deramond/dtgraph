export interface ButtonProps {
  label: string;
}

/** A trivial example component — the point of this example is the `dtgraph` story parameter below, not this button. */
export function Button({ label }: ButtonProps) {
  return (
    <button
      style={{
        background: '#3b82f6',
        color: '#ffffff',
        border: 'none',
        borderRadius: 4,
        padding: '0.5rem 1rem',
        fontFamily: 'sans-serif',
      }}
    >
      {label}
    </button>
  );
}
