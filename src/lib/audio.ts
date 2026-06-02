import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

/**
 * Transcodifica qualquer áudio (webm/opus do Chrome, m4a/aac do iPhone, etc.)
 * pra OGG/Opus mono 48kHz — o formato nativo de nota de voz (PTT) do WhatsApp.
 *
 * Por que: a Z-API só entrega áudio com duração quando o input JÁ é ogg/opus.
 * webm e m4a chegam como 0:00 no destinatário. ffmpeg resolve transcodificando.
 *
 * Usa arquivos temporários (mp4/m4a precisam de input seekable; pipe não serve).
 * inExt ajuda o ffmpeg a escolher o demuxer certo.
 */
export async function transcodeToOpusOgg(
  input: Buffer,
  inExt: string,
): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary indisponível");

  const dir = await mkdtemp(join(tmpdir(), "wa-audio-"));
  const inPath = join(dir, `in-${randomUUID()}.${inExt || "bin"}`);
  const outPath = join(dir, `out-${randomUUID()}.ogg`);
  try {
    await writeFile(inPath, input);
    await runFfmpeg([
      "-v", "error",
      "-i", inPath,
      "-c:a", "libopus",
      "-b:a", "32k",
      "-ar", "48000",
      "-ac", "1",
      "-f", "ogg",
      "-y", outPath,
    ]);
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}
