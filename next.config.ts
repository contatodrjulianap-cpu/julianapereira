import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static expõe o caminho de um binário nativo; mantém fora do bundle
  // e garante que o binário viaje junto na função de /api/zapi/send-media
  // (transcode de áudio pra ogg/opus antes de mandar pra Z-API).
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/zapi/send-media": ["node_modules/ffmpeg-static/**"],
  },
};

export default nextConfig;
