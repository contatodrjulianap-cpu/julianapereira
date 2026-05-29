import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sakura CRM",
    short_name: "Sakura",
    description: "CRM da Clínica Sakura — atendimento WhatsApp + qualificação de leads",
    start_url: "/crm",
    display: "standalone",
    background_color: "#fffaf3",
    theme_color: "#b08a3e",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
