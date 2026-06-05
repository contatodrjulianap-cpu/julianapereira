// Elementos decorativos da marca Sakura: flor de cerejeira, galho e camada de
// pétalas caindo. SVG inline pra herdar cor (currentColor) e escalar sem perda.
// Tudo server-component-safe (sem hooks, sem estado).

export function SakuraFlower({ className }: { className?: string }) {
  // Flor de 5 pétalas com o entalhe característico da cerejeira.
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g fill="currentColor">
        {[0, 72, 144, 216, 288].map((deg) => (
          <path
            key={deg}
            transform={`rotate(${deg} 50 50)`}
            d="M50 50 C42 38 42 20 50 8 C58 20 58 38 50 50 Z"
            opacity="0.92"
          />
        ))}
      </g>
      <circle cx="50" cy="50" r="6" fill="#A88452" />
    </svg>
  );
}

export function SakuraBranch({ className }: { className?: string }) {
  // Galho orgânico minimalista com três florzinhas — assinatura horizontal.
  return (
    <svg viewBox="0 0 320 60" className={className} aria-hidden="true" fill="none">
      <path
        d="M2 40 C 70 30, 140 34, 210 22 C 250 16, 280 14, 312 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M150 30 l14 -10 M210 22 l10 -12 M250 18 l8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <g fill="currentColor">
        <FlowerDot cx={168} cy={16} />
        <FlowerDot cx={224} cy={8} />
        <FlowerDot cx={262} cy={28} />
      </g>
    </svg>
  );
}

function FlowerDot({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx - 9} ${cy - 9}) scale(0.18)`}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <path
          key={deg}
          transform={`rotate(${deg} 50 50)`}
          d="M50 50 C42 38 42 20 50 8 C58 20 58 38 50 50 Z"
          opacity="0.9"
        />
      ))}
    </g>
  );
}

// Camada de pétalas caindo — CSS puro (keyframes em globals.css), some com
// prefers-reduced-motion. Posições/tempos fixos (sem Math.random) pra SSR estável.
const PETALS = [
  { left: "6%", delay: "0s", dur: "11s", scale: 0.8 },
  { left: "18%", delay: "3s", dur: "14s", scale: 1.1 },
  { left: "31%", delay: "6s", dur: "10s", scale: 0.7 },
  { left: "44%", delay: "1.5s", dur: "13s", scale: 1 },
  { left: "57%", delay: "4.5s", dur: "12s", scale: 0.9 },
  { left: "69%", delay: "8s", dur: "15s", scale: 1.2 },
  { left: "82%", delay: "2.5s", dur: "11s", scale: 0.8 },
  { left: "93%", delay: "5.5s", dur: "13s", scale: 1 },
];

export function PetalLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="sakura-petal"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.dur,
            transform: `scale(${p.scale})`,
          }}
        />
      ))}
    </div>
  );
}
