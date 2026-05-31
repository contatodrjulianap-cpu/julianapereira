import type { Variant } from "@/lib/quiz-archetypes";

/**
 * Caso-âncora por variant: a MESMA paciente abre o funil (história curta +
 * antes/depois na capa) e fecha no fim (vídeo VTurb antes do WhatsApp). Isso
 * cria um loop aberto — a abertura promete o vídeo, a pessoa completa o quiz
 * pra ver, e chega no WhatsApp quente.
 *
 * Embed VTurb v4 (pega no code que a plataforma gera):
 *   <vturb-smartplayer id="vid-<VIDEO_ID>"></vturb-smartplayer>
 *   <script src="https://scripts.converteai.net/<ACCOUNT_ID>/players/<VIDEO_ID>/v4/player.js">
 */
export type VturbVideo = {
  accountId: string;
  videoId: string;
  /** segundos até liberar o CTA "Continuar" (0 = libera imediatamente) */
  revealCtaAfterSec: number;
};

export type AnchorCase = {
  video: VturbVideo | null;
  /** Parágrafos curtos da história da abertura (caso real do vídeo). */
  storyParas: string[];
  /** Imagem antes/depois da capa (sobrepõe a foto estática). */
  antesDepoisImage?: string;
};

const ANCHOR: Record<Variant, AnchorCase> = {
  porcelana: {
    video: {
      accountId: "e7be16c3-5efe-4812-88b2-4b8f2dd62fe1",
      videoId: "6a1c9bf9b2de51ecca01a3d6",
      revealCtaAfterSec: 5,
    },
    // Caso real do vídeo: troca de porcelana por porcelana. Lentes antigas (de
    // outro profissional) mal adaptadas — dava pra ver o dente por baixo,
    // acumulava alimento, inflamava a gengiva; um lado menor que o outro.
    storyParas: [
      "Ela já tinha lentes de porcelana. Mas não foram feitas aqui.",
      "As antigas nunca encaixaram direito: dava pra ver o dente por baixo, acumulava comida e a gengiva vivia inflamada. E um lado do sorriso era visivelmente menor que o outro.",
      "Quase desistiu de mexer de novo, com medo de gastar e se arrepender outra vez. Até procurar a Dra. Juliana pra refazer tudo, com planejamento digital e caracterização feita peça por peça.",
      "No final dessas perguntas, te mostro o vídeo do antes e depois dela.",
    ],
    // Antes/depois real do post DYo3SZdkXc1 (@drajuliana.pereira, 22/05):
    // porcelanas antigas mal adaptadas (cima) × feitas pela Ju (baixo).
    antesDepoisImage: "/quiz/case-porcelana-antesdepois.jpg",
  },
  resina: {
    video: {
      accountId: "e7be16c3-5efe-4812-88b2-4b8f2dd62fe1",
      videoId: "6a1c9e650be01eeda6f3b616",
      revealCtaAfterSec: 5,
    },
    // Caso real do vídeo: troca de resinas feitas por outro profissional. As
    // antigas ficaram brancas demais, artificiais — de longe dava pra ver que
    // o sorriso não era natural. A Ju refez resina por resina, natural; a
    // paciente aprovou na hora ("agora fica muito natural, tô feliz").
    storyParas: [
      "Ela também já tinha feito as resinas. Mas não foram feitas aqui.",
      "Ficaram brancas demais, artificiais. De longe, dava pra ver que aquele sorriso não era natural — e ela não se sentia bem com ele.",
      "Procurou a Dra. Juliana pra refazer, resina por resina, dessa vez pensada pra parecer de verdade. Quando viu o resultado, aprovou na hora.",
      "No final dessas perguntas, te mostro o vídeo do antes e depois dela.",
    ],
    // Antes/depois real do post DY7z3C9GIzD (@drajuliana.pereira, 29/05):
    // "RETRABALHO — troca de resinas feitas por outro profissional".
    antesDepoisImage: "/quiz/case-resina-antesdepois.jpg",
  },
};

export function anchorCaseFor(variant: Variant): AnchorCase {
  return ANCHOR[variant];
}

export function antesDepoisVideoFor(variant: Variant): VturbVideo | null {
  return ANCHOR[variant].video;
}
