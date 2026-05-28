// Playbook comercial · Clínica Sakura (Dra. Juliana Pereira)
// Fonte canônica: 2-Areas/empresas/dd-mm/clientes/juliana/intel/playbook-vendas-v2.md
// v2 baseado em auditoria de 8 conversas reais (26/05/2026)

export const SOBRE_SAKURA = {
  resumo:
    'A Clínica Sakura é referência em lentes em resina e porcelana com a Dra. Juliana Pereira. Foco: planejamento individual, naturalidade, durabilidade. Atendimento na Av. Paulista, 1159, 8º andar (prédio do Itaú).',
  publico: [
    'Maioria mulher, 28-50 anos, classe B/A',
    'Quer transformar o sorriso mas tem medo de "ficar fake"',
    'Já viu valores na internet de R$3-4k em outras clínicas (cético)',
    'Procura PRESERVAÇÃO do dente natural (não "raspar tudo")',
  ],
  diferenciais: [
    'Planejamento digital do sorriso ANTES de qualquer procedimento',
    'Filosofia conservadora: só indica lente quando é o melhor caminho. Muitos casos resolve com resina + clareamento',
    'Material com garantia de durabilidade (porcelana E.max, resina nanohíbrida)',
    'Acompanhamento da Dra. Bárbara Nive do planejamento até a entrega',
  ],
  tickets: {
    resina: 'R$5k–10k (entrada de gama)',
    porcelana: 'R$15k–30k (high-ticket)',
  },
  endereco: 'Av. Paulista, 1159 – Jardim Paulista – SP · CEP 01311-200 · Conj. 803 – 8º andar (prédio do Itaú, entrada pelo lateral)',
};

// Sequência canônica — os 6 blocos do playbook
export type Bloco = {
  id: string;
  emoji: string;
  titulo: string;
  quando: string;
  o_que_fazer: string;
  mensagens: { titulo: string; texto: string; nota?: string }[];
  regra?: string;
};

export const SEQUENCIA: Bloco[] = [
  {
    id: 'b0',
    emoji: '👋',
    titulo: 'Bloco 0 · Abertura',
    quando: 'Quando lead novo do quiz chega. ALVO: tocar em ≤15 minutos.',
    o_que_fazer:
      'Identidade fixa em 3 bolhas separadas (1 frase por mensagem). Termina convidando pra falar sobre lentes na variante que ela escolheu (porcelana ou resina).',
    mensagens: [
      {
        titulo: 'Saudação + identidade',
        texto: 'Oi {primeiro_nome}, tudo bem?\n\nMe chamo Bárbara, sou a dentista responsável pelos planejamentos aqui na clínica 👩🏼‍⚕️',
        nota: 'Sempre IGUAL. Acabou "faço parte da equipe". Sem variação. Sem typo no nome da Dra. Juliana.',
      },
      {
        titulo: 'Convite (porcelana)',
        texto: 'Você gostaria de saber mais sobre nossas lentes em porcelana?',
      },
      {
        titulo: 'Convite (resina)',
        texto: 'Você gostaria de saber mais sobre nossas lentes em resina?',
      },
    ],
    regra: 'PRONTA do quiz: tocar em ≤15 minutos. Cada minuto além disso = lead esfriando.',
  },
  {
    id: 'b1',
    emoji: '🔍',
    titulo: 'Bloco 1 · Investigação (SPIN)',
    quando: 'Depois da abertura, antes de QUALQUER fala sobre preço ou tratamento.',
    o_que_fazer:
      'Mínimo 2 perguntas antes de qualquer preço. Sem investigação, qualquer valor é caro. Mistura S (situação), P (problema) e I (implicação).',
    mensagens: [
      {
        titulo: 'S · Já tem resina?',
        texto: '{primeiro_nome}, você já tem alguma resina ou restauração nesses dentinhos hoje?',
      },
      {
        titulo: 'S · Já procurou antes?',
        texto: 'Já procurou esse tratamento antes em alguma outra clínica?',
        nota: 'Útil pra descobrir se já viu concorrente barato — antecipa objeção de preço.',
      },
      {
        titulo: 'P · O que te preocupa?',
        texto: 'O que mais te preocupa em relação ao tratamento?',
        nota: 'Pergunta-ouro que Barbara já usa. Abre a conversa pra dor real.',
      },
      {
        titulo: 'P · O que te incomoda?',
        texto: 'O que mais te incomoda no seu sorriso hoje?',
      },
      {
        titulo: 'I · Há quanto tempo?',
        texto: 'Há quanto tempo você sente isso?',
        nota: 'Mede urgência interna do lead.',
      },
      {
        titulo: 'I · Imagina daqui 6 meses?',
        texto: 'Se nada mudar, daqui 6 meses como você imagina que vai estar se sentindo?',
        nota: 'Implicação forte — cria urgência sem agressividade.',
      },
      {
        titulo: 'Plantio · caso real',
        texto: 'Atendi outro dia uma paciente parecida com você, que tinha esse mesmo desconforto. Ela fez o tratamento e o resultado ficou exatamente como ela queria. Posso te mandar uma foto depois se quiser ver 🌸',
        nota: 'Constrói autoridade da Ju + você sem soar pitch. Trocar "outro dia" por contexto real quando der.',
      },
    ],
    regra: 'Mínimo 2 perguntas SPIN antes de falar preço.',
  },
  {
    id: 'b2',
    emoji: '💰',
    titulo: 'Bloco 2 · Passagem de preço',
    quando:
      'Quando lead pediu valor explicitamente E você já fez ≥2 perguntas SPIN E a variante (porcelana/resina) está definida.',
    o_que_fazer:
      'Estrutura em 3 bolhas: framing de valor ANTES do número → ancoragem com número → pacto presuntivo. Silêncio depois.',
    mensagens: [
      {
        titulo: 'Bolha 1 · Framing antes do número',
        texto: '{primeiro_nome}, o planejamento que a gente faz aqui não é só "colar facetinha" 🌸\n\nA gente desenha o sorriso pra cada formato de rosto, alinha cor com sua pele, e usa material com garantia de durabilidade.',
        nota: 'Justifica o valor ANTES de mostrar. Se mandar número sem framing, qualquer valor parece caro.',
      },
      {
        titulo: 'Bolha 2 · Número + condições',
        texto: 'O investimento completo no planejamento de [X] dentes em [porcelana/resina] fica em R$ [valor cheio].\n\nÀ vista a gente consegue R$ [valor desconto].\n\nParcelamos em até 12x no cartão, ou entrada + boleto.',
        nota: 'Editar os [X], [variante] e valores antes de mandar. Sempre oferece à vista + parcelado pra dar opção.',
      },
      {
        titulo: 'Bolha 3 · Pacto presuntivo',
        texto: 'O que você acha? 🤗',
        nota: 'PARE AQUI. Não emende com nova mensagem. Espere o lead responder. (Primeiro a falar perde.)',
      },
    ],
    regra: 'Mandou as 3 bolhas → silêncio. Não passar preço quando caso é complexo (precisa raio-X, oclusão, avaliação física).',
  },
  {
    id: 'b3',
    emoji: '🔑',
    titulo: 'Bloco 3 · Objeção de preço (M1 → M2 ponte)',
    quando: 'Quando lead diz "tá caro", "fora da minha realidade", "vi mais barato em outro lugar".',
    o_que_fazer:
      'M1 valida emocionalmente. PORÉM nunca para no M1 sozinho — sempre emenda M2 (isolamento) em ≤60s. Se não souber se é financeiro ou medo, vai chutar no escuro.',
    mensagens: [
      {
        titulo: 'M1 · Validação emocional',
        texto: 'Entendo, {primeiro_nome} 🌸\nEssa decisão envolve planejamento emocional e financeiro mesmo.',
        nota: 'Você JÁ usa isso. O problema é parar aqui. Sempre seguir pra M2 abaixo.',
      },
      {
        titulo: 'M2 · PONTE / isolamento ⚠️ CRÍTICA',
        texto: 'Posso te perguntar uma coisa rapidinho, pra eu te ajudar do jeito certo?\n\nO que te impede hoje é especificamente o valor agora, ou é algo no tratamento em si (medo, dúvida sobre o resultado, tempo)?',
        nota: 'A peça mais importante do playbook v2. Sem essa pergunta, você responde no escuro. Aqui descobre se é A (financeiro), B (medo), C (tempo) ou D (mistura).',
      },
      {
        titulo: 'Ramo A · É financeiro',
        texto: 'Faz sentido. Posso te mostrar 2 caminhos:\n\n1. Parcelamento em até 12x no cartão, fica em R$ [12x]/mês. Cabe no seu orçamento mensal?\n\n2. Se cartão não é opção, posso te apresentar a variante em resina, que entrega resultado parecido com investimento menor.\n\nQual desses faz mais sentido pra você agora?',
      },
      {
        titulo: 'Ramo B · É medo / dúvida',
        texto: 'Que bom que você falou. É exatamente isso que eu planejo aqui antes de qualquer coisa.\n\nMe conta: o que especificamente te dá receio?\nÉ a dor? A aparência ficar artificial? Já viu alguém que ficou ruim?',
      },
      {
        titulo: 'Ramo C · É tempo / momento',
        texto: 'Entendi. O planejamento dura [X] sessões em [Y] semanas.\n\nSe a gente começasse em [data D+30/D+45], te encaixaria melhor?',
      },
    ],
    regra: 'Proibido parar no M1 sozinho. Se lead sumiu após "Entendo", conta como erro de execução.',
  },
  {
    id: 'b4',
    emoji: '🎯',
    titulo: 'Bloco 4 · Pacto Final (anti-sumiço)',
    quando: 'Quando lead diz "vou pensar", "vou me organizar", "vou ver com meu marido", "depois te chamo".',
    o_que_fazer:
      'Toda fala de adiamento exige (a) Pacto Final com escala 0-10 E (b) follow_up_at agendado no CRM. Encerrar com "fico à disposição" sem agendar = falha de processo.',
    mensagens: [
      {
        titulo: 'Pergunta 0-10 ⚠️ CRÍTICA',
        texto: 'Combinado, {primeiro_nome}. Só pra eu te respeitar e não ficar te enchendo, deixa eu te perguntar:\n\nde 0 a 10, o quanto isso é prioridade pra você agora?',
        nota: 'Descobre se vale priorizar ou não. Sem isso você gasta energia em lead frio.',
      },
      {
        titulo: 'Resposta 8-10 (quente)',
        texto: 'Que bom! Então faz o seguinte: vou te procurar [quarta/quinta], te mando uma mensagem rápida pra gente fechar os próximos passos. Combinado?',
        nota: 'Agendar follow_up_at D+2 ou D+3 no CRM.',
      },
      {
        titulo: 'Resposta 5-7 (morno)',
        texto: 'Entendi. O que precisaria acontecer pra ser um 9 ou 10?\n\n(Tô perguntando porque às vezes a gente resolve no detalhe que tá faltando.)',
        nota: 'Volta pra B3 se aparecer objeção concreta. Senão agenda follow_up D+7.',
      },
      {
        titulo: 'Resposta 0-4 (frio / incubação)',
        texto: 'Sem problema, {primeiro_nome}. Posso te procurar daqui 1 mês então, sem pressão.\n\nSe antes disso bater a vontade, me chama 🌸',
        nota: 'Agendar follow_up_at D+30. Lead entra no ciclo de incubação longa (D+30 → D+45 → D+75 → D+90). Lead high-ticket odonto leva 2-3 meses pra decidir — não pressionar.',
      },
      {
        titulo: 'Decisor (cônjuge) presente',
        texto: 'Faz total sentido, {primeiro_nome}. Quer que a gente marque uma call rápida de 15min com vocês dois?\n\nAí eu explico tudo de uma vez e vocês decidem juntos, sem ruído de telefone-sem-fio.',
      },
    ],
    regra: 'Proibido encerrar com "fico à disposição" sem follow_up_at agendado. Status "proposal" sem follow_up = ALERTA.',
  },
  {
    id: 'b5',
    emoji: '✅',
    titulo: 'Bloco 5 · Fechamento técnico',
    quando: 'Lead falou "vamos fazer", "quero fechar", "manda o PIX", ou aceitou condição que você ofereceu.',
    o_que_fazer:
      'Sequência em ≤30min após o "sim". Não dá tempo do lead duvidar. Ordem importa: foto → pasta → apresentação reforçada → PIX → confirmação.',
    mensagens: [
      {
        titulo: 'Pedir foto',
        texto: 'Que bom, {primeiro_nome}! 🌸\n\nPra eu te montar a pasta certinha, me manda uma foto do seu sorriso atual?\n(pode ser selfie, com a boca um pouco aberta)',
      },
      {
        titulo: 'Apresentação Dra (autoridade)',
        texto: 'Recebido. Vou montar sua pasta agora.\n\nSou a Dra. Bárbara Nive, dentista responsável pelos planejamentos da clínica. Vou acompanhar você do planejamento até a entrega final. Prazer em começar com você 🤗',
        nota: 'Aqui (e SÓ aqui) vira "Dra. Bárbara". Antes era "Bárbara" pra ser quente — agora é momento de autoridade.',
      },
      {
        titulo: 'Confirma valor + condição',
        texto: 'Confirmando: planejamento completo em [porcelana/resina], [X] dentes, valor R$ [fechado], [à vista / 12x].\n\nTudo certo?',
      },
      {
        titulo: 'PIX entrada',
        texto: 'Pra eu reservar sua agenda e iniciar o planejamento, a entrada é R$ [valor] via PIX.\n\nPIX: [chave]\nBeneficiário: [Nome clínica]\n\nMe avisa quando enviar pra eu confirmar 🌸',
      },
      {
        titulo: 'Recebido + ancoragem',
        texto: 'Recebido! 🎉\n\nSua decisão de cuidar do seu sorriso é uma das melhores que você vai tomar esse ano.\n\nVou te mandar agora o link pra você escolher data e horário da primeira sessão.',
      },
    ],
    regra: 'Tudo isso em ≤30min após o "vamos fazer". A preguiça do lead é sua aliada.',
  },
];

// Cadência de follow-up
export type FollowUpToque = {
  dia: string;
  titulo: string;
  texto: string;
  nota?: string;
};

export const FOLLOWUP: FollowUpToque[] = [
  // --- CADÊNCIA CURTA: lead em decisão ativa (1-15 dias) ---
  {
    dia: 'D+1',
    titulo: 'Recap quente',
    texto: 'Oi {primeiro_nome}! Passando rapidinho pra ver se você tinha alguma dúvida sobre o que a gente conversou ontem 🌸\n\nTô aqui se quiser tirar qualquer coisa.',
    nota: 'Disparar 24h depois da última msg do lead se não respondeu.',
  },
  {
    dia: 'D+3',
    titulo: 'Caso real (prova social)',
    texto: '{primeiro_nome}, te mostrei essa paciente outro dia?\nEla tinha um caso bem parecido com o seu e ficou assim 👇\n\n[anexar foto antes/depois]\n\nTopa marcar uma conversa pra eu te explicar como faria o seu?',
    nota: 'Sempre com foto/vídeo. Sem mídia, esse toque cai chato.',
  },
  {
    dia: 'D+7',
    titulo: 'Urgência genuína (não fake)',
    texto: '{primeiro_nome}, tô fechando agenda de [mês].\nTenho [2/3] horários ainda em [semana Y].\n\nSe quiser garantir um deles, me avisa hoje que eu seguro pra você.',
    nota: 'Nunca inventar escassez. Só usar quando agenda REALMENTE tá fechando.',
  },
  {
    dia: 'D+15',
    titulo: 'Oferta condicional / variante',
    texto: '{primeiro_nome}, voltei aqui. Sei que da última vez o investimento ficou apertado.\n\nA gente abriu uma condição agora pra quem fechar essa semana: [desconto / parcelamento estendido / variante resina].\n\nCabe pra você dar uma olhada?',
  },

  // --- CADÊNCIA LONGA: ciclo real de decisão odonto high-ticket (1-3 meses) ---
  // Barbara confirmou: lead que diz "vou me organizar" leva 2-3 meses pra decidir.
  // Esses toques são pra incubação, não pra fechar urgência.
  {
    dia: 'D+30',
    titulo: 'Check-in 1 mês',
    texto: 'Oi {primeiro_nome}! Faz mais ou menos 1 mês desde a gente se falou.\n\nComo você tá em relação ao seu sorriso? Mudou algo no planejamento ou ainda tá considerando?\n\nTô por aqui sem pressão 🌸',
    nota: 'Tom: lembrança casual + abre porta sem cobrar. Lead high-ticket precisa de tempo, não de pressão.',
  },
  {
    dia: 'D+45',
    titulo: 'Caso novo + lembrança',
    texto: '{primeiro_nome}, lembrei de você essa semana porque atendemos uma paciente com perfil parecido 👇\n\n[anexar antes/depois ou vídeo curto]\n\nO resultado ficou exatamente no estilo que você comentou que queria. Se quiser ver mais detalhes ou conversar sobre o seu caso, é só me chamar 💜',
    nota: 'Toque com VALOR NOVO (não "alguma novidade?"). Sempre carregando um caso que conecta com a dor original dela.',
  },
  {
    dia: 'D+75',
    titulo: 'Janela financeira (gatilho real)',
    texto: 'Oi {primeiro_nome}! Tô passando porque [próximo 13º / fim do semestre / restituição IR / final de ano] é uma janela boa pra quem tá planejando o tratamento.\n\nVocê chegou a se planejar pra essa janela? Se quiser, posso reservar uma avaliação pra gente conversar com calma.',
    nota: 'Ancora em evento financeiro REAL do calendário (13º, restituição, férias) — funciona porque é genuíno, não pressão fake.',
  },
  {
    dia: 'D+90',
    titulo: 'Último toque + porta aberta',
    texto: '{primeiro_nome}, faz uns 3 meses que a gente conversou e quero ser direta:\n\nSe ainda fizer sentido, tô aqui — sem pressão, sem cobrança. Se não fizer mais, sem problema, só me avisa pra eu não te incomodar.\n\nFoi muito bom trocar com você 🙏',
    nota: 'ÚLTIMO toque ativo. Sem resposta após D+90: arquivar com tag "lost-ciclo-completo-90d". Se responder positivo, recomeçar do D+1.',
  },
];

// Sugestão de qual toque agendar baseado na nota 0-10 do Pacto Final (Bloco 4)
// — Barbara usa isso ao agendar follow_up_at depois de "vou pensar"
export const FOLLOWUP_NOTA_SUGGESTION = [
  { nota: '8-10', proximo: 'D+1 ou D+3', razao: 'Lead quente, decide nos próximos dias' },
  { nota: '5-7', proximo: 'D+7 a D+15', razao: 'Lead morno, precisa de 1-2 semanas pra maturar' },
  { nota: '3-4', proximo: 'D+30', razao: 'Lead em incubação, começa ciclo longo' },
  { nota: '0-2', proximo: 'D+45 ou D+90', razao: 'Lead frio, mantém contato sem pressionar' },
];

// Regras operacionais
export type Regra = { titulo: string; descricao: string; severidade: 'critica' | 'alta' | 'media' };

export const REGRAS: Regra[] = [
  {
    titulo: 'Identidade fixa',
    descricao: 'Sempre "Bárbara, dentista responsável pelos planejamentos aqui na clínica 👩🏼‍⚕️". Acabou "faço parte da equipe" ou variações. Dra. Bárbara só no Bloco 5 (fechamento).',
    severidade: 'critica',
  },
  {
    titulo: 'Tempo de resposta PRONTA',
    descricao: 'Lead PRONTO do quiz: tocar em ≤15min. Hoje varia 27min-14h, é tempo demais. A tela Status tem alerta vermelho de PRONTA aguardando.',
    severidade: 'critica',
  },
  {
    titulo: 'M1 nunca sem M2',
    descricao: 'Quando lead diz "tá caro", "Entendo, exige planejamento emocional e financeiro" SEM o M2 imediato é falha. M2 = "é o valor agora ou dúvida no tratamento?". Sem isolar, você responde no escuro.',
    severidade: 'critica',
  },
  {
    titulo: 'Pacto Final antes de aceitar adiamento',
    descricao: 'Lead diz "vou pensar/me organizar/falar com X" → OBRIGATÓRIO escala 0-10 + agendar follow_up_at no CRM. "Fico à disposição" sem data = falha de processo.',
    severidade: 'critica',
  },
  {
    titulo: 'Bolhas curtas',
    descricao: '1 frase por mensagem. Máximo 2 frases curtas. Quebrar mensagens longas em 3-4 bolhas pra criar ritmo natural de WhatsApp. Exceção: bloco de preço pode ter bolha de 3-4 linhas.',
    severidade: 'alta',
  },
  {
    titulo: 'Espelhar áudio',
    descricao: 'Lead mandou áudio → responder áudio. Áudio máx 60s. Mas NUNCA usar áudio pra passar PIX ou valor fechado (esses sempre em texto pra registro).',
    severidade: 'alta',
  },
  {
    titulo: 'Sem travessões longos',
    descricao: 'Travessão "—" é pegada de GPT. Trocar por vírgula, ponto, dois-pontos ou quebra de bolha. En-dash só em faixas numéricas (datas/horários).',
    severidade: 'media',
  },
  {
    titulo: 'Eliminar a palavra "não" em vendas',
    descricao: 'Reformular: "Não temos esse horário" → "O que tenho disponível é X". "Não dá pra parcelar em 18x" → "O parcelamento vai até 12x, ou à vista a gente faz uma condição melhor".',
    severidade: 'media',
  },
  {
    titulo: 'Venda fora do CRM',
    descricao: 'Fechou por ligação/presencial/IG? Anota NO MESMO DIA: nota no lead (3-5 linhas) + status=won + valor REAL (não R$15,50 quando era R$15k) + forma de pagamento.',
    severidade: 'critica',
  },
  {
    titulo: 'Todos os decisores presentes',
    descricao: 'Lead disse "vou falar com meu marido"? Convidar pra call de 15min com os dois. Evita ruído de telefone-sem-fio.',
    severidade: 'alta',
  },
  {
    titulo: 'Mínimo 8 follow-ups antes de "lost" — ciclo de 90 dias',
    descricao: 'Cadência curta (decisão ativa): D+1 → D+3 → D+7 → D+15. Cadência longa (incubação de 1-3 meses, ciclo real high-ticket odonto): D+30 → D+45 → D+75 → D+90. Só arquiva como lost depois desses 8 toques com VALOR NOVO em cada um. Lead high-ticket leva 2-3 meses pra decidir — desistir antes é dinheiro na mesa.',
    severidade: 'alta',
  },
];

// Métricas pra acompanhar
export type Metrica = { titulo: string; baseline: string; meta: string };

export const METRICAS: Metrica[] = [
  {
    titulo: 'Tempo médio de resposta a PRONTA do quiz',
    baseline: '27min - 14h',
    meta: '≤15min em ≥80% dos casos',
  },
  {
    titulo: '% leads com follow_up_at quando status=proposal',
    baseline: '~0% (Anny, Diego sem pacto)',
    meta: '≥90%',
  },
  {
    titulo: '% conversas com objeção preço que tiveram M2 (isolamento)',
    baseline: '0% (Káh parou no M1)',
    meta: '≥80%',
  },
  {
    titulo: '% WONs com conversa íntegra no CRM',
    baseline: '40% (2 de 5)',
    meta: '≥80%',
  },
  {
    titulo: 'Dupla-greeting (Gabi+Barbara no mesmo lead)',
    baseline: '1 em 8 observada (Nilson)',
    meta: '0',
  },
  {
    titulo: 'Ticket médio real (sem typo)',
    baseline: 'R$15,50 fantasma',
    meta: 'Valores conferidos',
  },
];

// POP — Procedimento Operacional Padrão (passo-a-passo com prints)
export type EtapaPOP = {
  n: number;
  titulo: string;
  o_que_voce_ve: string;
  passos: string[];
  print_desktop: string;
  print_mobile: string;
};

export const POP: EtapaPOP[] = [
  {
    n: 1,
    titulo: 'Como entrar no CRM',
    o_que_voce_ve: 'Tela de login com 2 campos (e-mail e senha) e o nome "CRM Sakura" no topo.',
    passos: [
      'Abrir clinicasakura.org/crm/login no celular, iPad ou computador.',
      'Entrar com seu e-mail (barbara@clinicasakura.org ou gabi@clinicasakura.org).',
      'Senha foi passada no privado pelo Lucas.',
      'Depois de entrar, você cai direto na aba 💬 Conversas — onde fica o WhatsApp dos leads.',
      'Deixar essa aba aberta o dia todo. Atualiza sozinha quando chega lead novo.',
    ],
    print_desktop: '/playbook/01-login-desktop.png',
    print_mobile: '/playbook/01-login-mobile.png',
  },
  {
    n: 2,
    titulo: 'Como abrir o dia: aba ✨ Status',
    o_que_voce_ve: 'Tela com cards coloridos no topo (Chamar hoje, Follow-ups vencidos, etc), listas embaixo com tarefas do dia e próximos 7 dias.',
    passos: [
      'Abrir TODO DIA DE MANHÃ a aba "✨ Status".',
      'Se aparecer um cartão VERMELHO no topo ("🔥 PRONTA aguardando atendimento") — atender essa(s) pessoa(s) PRIMEIRO. Cada minuto esfria.',
      'Depois vão os cartões: "Chamar hoje", "Follow-ups vencidos", "Próximos 3 dias", etc.',
      'Embaixo: lista "Tarefas hoje" (com badge âmbar pra vencidos) e "Próximos 7 dias" (agrupado por dia).',
      'Clica em cada item → abre a conversa daquela pessoa pra você responder.',
    ],
    print_desktop: '/playbook/02-status-desktop.png',
    print_mobile: '/playbook/02-status-mobile.png',
  },
  {
    n: 3,
    titulo: 'Como usar as mensagens prontas (Quick Replies ⚡)',
    o_que_voce_ve: 'No campo de mensagem da conversa, tem um ícone ⚡ amarelo. Clicando, abre uma lista de respostas prontas organizadas por bloco (B0, B1, B2, B3, B4, B5, FU).',
    passos: [
      'Dentro da conversa de um lead, no campo de digitar mensagem, toca no ⚡.',
      'Vai aparecer uma lista. As FAVORITAS (com ⭐) vêm no topo.',
      'A lista tá organizada pelo bloco da venda: B0=Abertura, B1=Investigação, B2=Preço, B3=Objeção, B4=Pacto Final, B5=Fechamento, FU=Follow-up.',
      'Clica em uma → a mensagem entra pré-preenchida no campo, com o nome da pessoa já interpolado ({primeiro_nome}).',
      'Editar o que tiver entre [colchetes] (ex: [X dentes], [chave PIX], [valor]).',
      'Revisar e enviar.',
    ],
    print_desktop: '/playbook/03-quick-replies-desktop.png',
    print_mobile: '/playbook/03-quick-replies-mobile.png',
  },
  {
    n: 4,
    titulo: 'Como agendar follow-up com tarefa',
    o_que_voce_ve: 'No bottom-sheet do lead (... ou ações), tem os botões "⏰ Lembrar amanhã" e "📅 Próximo contato". Os dois abrem um modal com campo de DATA e campo de TAREFA.',
    passos: [
      'Quando lead disser "vou pensar/me organizar/volto a falar", agendar follow-up SEMPRE.',
      'Toca nos "..." da conversa.',
      'Toca em "⏰ Lembrar amanhã" (rápido) OU "📅 Próximo contato" (escolhe a data).',
      'Aparece modal: campo de data + campo de TAREFA (textarea).',
      'No campo Tarefa escreve O QUE você precisa falar com a pessoa: "mandar foto antes/depois", "confirmar agenda quarta", "perguntar do orçamento".',
      'Salvar. A tarefa vai aparecer na sua aba ✨ Status no dia.',
    ],
    print_desktop: '/playbook/04-followup-desktop.png',
    print_mobile: '/playbook/04-followup-mobile.png',
  },
  {
    n: 5,
    titulo: 'Como marcar status do lead (swipe esquerda)',
    o_que_voce_ve: 'Na lista de conversas, ao arrastar o card de um lead pra ESQUERDA, aparecem 3 botões coloridos: ✅ Comprou · ❌ Perdido · 🚫 Desqualif.',
    passos: [
      'Na lista de Conversas, encontra o lead.',
      'Arrasta o card dele PRA ESQUERDA (com o dedo, no celular/iPad).',
      'Vão aparecer 3 botões: ✅ Comprou (fechou venda), ❌ Perdido (perdeu venda após tentativa), 🚫 Desqualif. (não era público, número errado, etc).',
      'IMPORTANTE: VENDA FECHADA FORA DO CRM (ligação, presencial)? Marcar Comprou AQUI MESMO + atualizar deal_value no modal.',
      'Se digitar valor < R$500 vai aparecer aviso "isso parece baixo, quis dizer R$X.000?".',
    ],
    print_desktop: '/playbook/05-swipe-desktop.png',
    print_mobile: '/playbook/05-swipe-mobile.png',
  },
  {
    n: 6,
    titulo: 'Como ver dados do lead (modal completo)',
    o_que_voce_ve: 'Clicando no card do lead (não arrastando), abre uma telinha completa com: foto, telefone, fonte, arquétipo (Pronto/Esperançoso/Cético), status, responsável, valor da venda, histórico de mensagens.',
    passos: [
      'Toca rápido no card do lead (sem arrastar).',
      'Abre telinha grande com TUDO sobre o lead.',
      'Em cima: badges com Origem, Arquétipo (🔥 Pronto / 🟡 Esperançoso / 📍 Cético), Status, Responsável.',
      'No meio: editar Status, Origem, Responsável, Próximo contato (data + tarefa), Valor da venda.',
      'Embaixo: histórico completo de mensagens + eventos do lead.',
      'Salvar quando terminar.',
    ],
    print_desktop: '/playbook/06-modal-desktop.png',
    print_mobile: '/playbook/06-modal-mobile.png',
  },
];

export const LINKS = {
  crm: 'https://clinicasakura.org/crm',
  status: 'https://clinicasakura.org/crm/status',
  conversas: 'https://clinicasakura.org/crm',
  quick_replies: 'https://clinicasakura.org/crm/voce/respostas-rapidas',
};
