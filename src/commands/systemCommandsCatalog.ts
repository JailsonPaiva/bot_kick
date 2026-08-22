/**
 * Catálogo de comandos padrão integrados ao bot.
 */

export interface SystemCommandDefinition {
  trigger: string;
  description: string;
  permission: string;
  cooldown?: number;
  category: "engajamento" | "pontos" | "jogos" | "utilitario";
  /** Resposta padrão editável (quando aplicável). Use {user}, {count}, {date}, {uptime}. */
  defaultResponse?: string;
}

export const SYSTEM_COMMANDS_CATALOG: SystemCommandDefinition[] = [
  {
    trigger: "pontos",
    description: "Exibe o saldo de pontos de fidelidade do viewer",
    permission: "everyone",
    cooldown: 10,
    category: "pontos",
  },
  {
    trigger: "top",
    description: "Mostra o top 5 de viewers por pontos no canal",
    permission: "everyone",
    cooldown: 15,
    category: "pontos",
  },
  {
    trigger: "dar",
    description: "Transfere pontos para outro viewer — uso: !dar @usuario quantidade",
    permission: "everyone",
    cooldown: 30,
    category: "pontos",
  },
  {
    trigger: "rank",
    description: "Ranking de jogadores e estatísticas — !rank, !rank me, !rank @usuario",
    permission: "everyone",
    cooldown: 15,
    category: "jogos",
  },
  {
    trigger: "ttt",
    description: "Jogo da Velha entre viewers — join, play, status, web, cancel",
    permission: "everyone",
    cooldown: 60,
    category: "jogos",
  },
  {
    trigger: "sorteio",
    description: "Gerencia sorteios — criar, status ou encerrar (mod)",
    permission: "moderator",
    category: "engajamento",
  },
  {
    trigger: "entrar",
    description: "Entra no sorteio aberto no canal",
    permission: "everyone",
    cooldown: 5,
    category: "engajamento",
  },
  {
    trigger: "reroll",
    description: "Sorteia novamente o vencedor de um giveaway (mod)",
    permission: "moderator",
    category: "engajamento",
  },
  {
    trigger: "poll",
    description: "Cria ou gerencia enquetes ao vivo (mod)",
    permission: "moderator",
    category: "engajamento",
  },
  {
    trigger: "enquete",
    description: "Alias de !poll para criar enquete com comando curto (mod)",
    permission: "moderator",
    category: "engajamento",
  },
  {
    trigger: "votar",
    description: "Registra voto na enquete ativa — !votar <número>",
    permission: "everyone",
    cooldown: 5,
    category: "engajamento",
  },
  {
    trigger: "ping",
    description: "Verifica se o bot está respondendo",
    permission: "everyone",
    cooldown: 5,
    category: "utilitario",
    defaultResponse: "@{user} pong! 🏓",
  },
];

export function getSystemCommandDefinition(trigger: string): SystemCommandDefinition | undefined {
  return SYSTEM_COMMANDS_CATALOG.find((c) => c.trigger === trigger.toLowerCase());
}

export function isKnownSystemCommand(trigger: string): boolean {
  return SYSTEM_COMMANDS_CATALOG.some((c) => c.trigger === trigger.toLowerCase());
}
