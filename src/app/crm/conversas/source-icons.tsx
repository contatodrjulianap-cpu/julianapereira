type SourceKey =
  | "instagram"
  | "google"
  | "tiktok"
  | "quiz"
  | "indicacao"
  | "organico"
  | "whatsapp";

function detectSource(raw: string | null): SourceKey {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("insta")) return "instagram";
  if (s.includes("google")) return "google";
  if (s.includes("tiktok") || s.includes("tt")) return "tiktok";
  if (s.includes("quiz")) return "quiz";
  if (s.includes("indica")) return "indicacao";
  if (s.includes("organ") || s.includes("seo")) return "organico";
  return "whatsapp";
}

export function SourceBadge({ source }: { source: string | null }) {
  const key = detectSource(source);
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center w-[22px] h-[22px] rounded-md overflow-hidden"
      title={key}
      aria-label={`Origem: ${key}`}
    >
      <Icon kind={key} />
    </span>
  );
}

function Icon({ kind }: { kind: SourceKey }) {
  switch (kind) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <defs>
            <radialGradient id="ig-grad" cx="0.3" cy="1.05" r="1.2">
              <stop offset="0" stopColor="#f9ce34" />
              <stop offset="0.5" stopColor="#ee2a7b" />
              <stop offset="1" stopColor="#6228d7" />
            </radialGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
          <rect
            x="5.5"
            y="5.5"
            width="13"
            height="13"
            rx="3.5"
            fill="none"
            stroke="#fff"
            strokeWidth="1.6"
          />
          <circle
            cx="12"
            cy="12"
            r="3.2"
            fill="none"
            stroke="#fff"
            strokeWidth="1.6"
          />
          <circle cx="16.4" cy="7.6" r="0.9" fill="#fff" />
        </svg>
      );
    case "google":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <rect width="24" height="24" rx="6" fill="#fff" />
          <path
            d="M21.35 11.1H12v3.8h5.35c-.23 1.34-1.62 3.92-5.35 3.92a5.85 5.85 0 1 1 0-11.7 5.27 5.27 0 0 1 3.72 1.45L18.4 5.9A8.8 8.8 0 0 0 12 3.4 8.6 8.6 0 1 0 12 20.6c4.96 0 8.25-3.49 8.25-8.4 0-.57-.07-1.02-.16-1.45z"
            fill="#4285F4"
          />
          <path
            d="M3.4 7.3l3.13 2.3a5.85 5.85 0 0 1 5.47-4.1 5.27 5.27 0 0 1 3.72 1.45L18.4 4.3A8.8 8.8 0 0 0 12 1.8 8.6 8.6 0 0 0 3.4 7.3z"
            fill="#EA4335"
          />
          <path
            d="M12 20.6c2.34 0 4.3-.77 5.74-2.1l-2.8-2.16a5.27 5.27 0 0 1-2.94.8 5.86 5.86 0 0 1-5.51-3.91l-3.1 2.39A8.6 8.6 0 0 0 12 20.6z"
            fill="#34A853"
          />
          <path
            d="M21.35 11.1H12v3.8h5.35a4.64 4.64 0 0 1-2.05 3.04l2.8 2.16a8.45 8.45 0 0 0 2.55-6.55c0-.57-.07-1.02-.16-1.45z"
            fill="#FBBC05"
          />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <rect width="24" height="24" rx="6" fill="#000" />
          <path
            d="M14.8 5h1.85a4.42 4.42 0 0 0 3.85 3.85v1.96a6.4 6.4 0 0 1-3.85-1.27v5.94a4.42 4.42 0 1 1-4.42-4.42c.18 0 .35.02.52.04v2.03a2.4 2.4 0 1 0 1.98 2.36V5z"
            fill="#25F4EE"
          />
          <path
            d="M14.05 5h1.85a4.42 4.42 0 0 0 3.85 3.85v1.96a6.4 6.4 0 0 1-3.85-1.27v5.94a4.42 4.42 0 1 1-4.42-4.42c.18 0 .35.02.52.04v2.03a2.4 2.4 0 1 0 1.98 2.36V5z"
            fill="#FE2C55"
            transform="translate(-0.5, 0.5)"
          />
          <path
            d="M14.4 5h1.85a4.42 4.42 0 0 0 3.85 3.85v1.96a6.4 6.4 0 0 1-3.85-1.27v5.94a4.42 4.42 0 1 1-4.42-4.42c.18 0 .35.02.52.04v2.03a2.4 2.4 0 1 0 1.98 2.36V5z"
            fill="#fff"
          />
        </svg>
      );
    case "quiz":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <rect width="24" height="24" rx="6" fill="#F97316" />
          <path
            d="M9.5 8.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5c0 1.6-2.5 1.9-2.5 4"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="16.5" r="1.2" fill="#fff" />
        </svg>
      );
    case "indicacao":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <rect width="24" height="24" rx="6" fill="#EAB308" />
          <path
            d="M12 6.5l1.5 3.1 3.4.5-2.45 2.4.58 3.4L12 14.3l-3.03 1.6.58-3.4L7.1 10.1l3.4-.5L12 6.5z"
            fill="#fff"
          />
        </svg>
      );
    case "organico":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <rect width="24" height="24" rx="6" fill="#3B82F6" />
          <circle cx="12" cy="12" r="5.5" fill="none" stroke="#fff" strokeWidth="1.7" />
          <path
            d="M6.5 12h11M12 6.5c2 1.7 2.8 3.7 2.8 5.5s-.8 3.8-2.8 5.5c-2-1.7-2.8-3.7-2.8-5.5s.8-3.8 2.8-5.5z"
            fill="none"
            stroke="#fff"
            strokeWidth="1.4"
          />
        </svg>
      );
    case "whatsapp":
    default:
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <rect width="24" height="24" rx="6" fill="#25D366" />
          <path
            d="M16.6 13.6c-.25-.12-1.45-.71-1.67-.8-.22-.08-.38-.12-.55.12-.16.25-.62.8-.76.96-.14.16-.28.18-.52.06-.25-.12-1.04-.38-1.97-1.22-.73-.65-1.22-1.45-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.28.37-.42.12-.14.16-.25.25-.42.08-.16.04-.32-.02-.44-.06-.13-.55-1.33-.76-1.83-.2-.48-.4-.41-.55-.42l-.47-.01a.91.91 0 0 0-.66.31c-.22.25-.86.84-.86 2.05s.88 2.38 1 2.55c.13.16 1.74 2.65 4.21 3.72.59.25 1.05.41 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.45-.59 1.66-1.16.2-.57.2-1.06.14-1.16-.05-.1-.22-.16-.46-.28z"
            fill="#fff"
          />
        </svg>
      );
  }
}
