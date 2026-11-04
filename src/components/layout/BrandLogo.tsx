export function BrandLogo({ variant = 'main' }: { variant?: 'main' | 'reversed' }) {
  return (
    <span className={`brand-logo brand-logo-${variant}`} role="img" aria-label="피노리">
      <img className="brand-wordmark" src="/logo-wordmark.png" alt="" width="1010" height="256" />
    </span>
  )
}
