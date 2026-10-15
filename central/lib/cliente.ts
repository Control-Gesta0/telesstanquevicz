/** Conteúdo do cliente. A estrutura da Central é a do padrão v5; só isto muda de um cliente para outro. */
export const CLIENTE = {
  nome: 'Teles & Stanquevicz',
  nomeCompleto: 'Teles & Stanquevicz Advogados',
  agente: 'Stela',
  kommoUrl: 'https://telesstanquevicz.kommo.com',
  versao: 'CENTRAL V5',
}

export const linkLead = (id: number) => `${CLIENTE.kommoUrl}/leads/detail/${id}`
