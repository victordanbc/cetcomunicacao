/**
 * Sessão do app. Hoje é mock fixo; depois troque por login / token / API.
 */
export type AppUser = {
  id: string;
  nome: string;
  /** Nome gravado nas movimentações como pessoa responsável */
  nomeResponsavelMovimentacao: string;
  role: "admin" | "operador" | "usuario";
};

export const USUARIO_LOGADO_MOCK: AppUser = {
  id: "admin-1",
  nome: "Admin",
  nomeResponsavelMovimentacao: "Admin",
  role: "admin"
};

export function getPessoaResponsavelLogada(): string {
  return USUARIO_LOGADO_MOCK.nomeResponsavelMovimentacao;
}
