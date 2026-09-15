export function BrandLogo({ variant = 'main' }: { variant?: 'main' | 'reversed' }) {
  return (
    <span className={`brand-logo brand-logo-${variant}`} role="img" aria-label="스팟잇">
      <img
        className="brand-symbol"
        src={variant === 'reversed' ? '/logo-reversed.svg' : '/logo.svg'}
        alt=""
        width={variant === 'reversed' ? 606 : 1024}
        height={variant === 'reversed' ? 793 : 1024}
      />
      <img className="brand-wordmark" src="/brand-wordmark.png" alt="" width="1668" height="529" />
    </span>
  )
}
