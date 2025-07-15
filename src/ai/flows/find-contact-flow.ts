
'use server';

/**
 * @fileOverview Um agente de IA para encontrar contatos em uma lista de texto.
 *
 * - findContacts - Uma função que busca contatos em uma lista com base em um termo.
 * - FindContactsInput - O tipo de entrada para a função findContacts.
 * - FindContactsOutput - O tipo de retorno para a função findContacts.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const FindContactsInputSchema = z.object({
  contactList: z.string().describe('Uma string de texto contendo uma lista de nomes e números de telefone/IDs de contatos.'),
  searchTerm: z.string().describe('O nome ou termo a ser buscado na lista de contatos.'),
});
export type FindContactsInput = z.infer<typeof FindContactsInputSchema>;

const FindContactsOutputSchema = z.object({
  contacts: z.array(z.object({
    name: z.string().describe('O nome do contato encontrado.'),
    id: z.string().describe('O ID do contato (número de telefone, etc.). O ID deve estar no formato esperado, ex: 5511999998888@c.us'),
  })).describe('Uma lista de contatos que correspondem ao termo de busca.'),
});
export type FindContactsOutput = z.infer<typeof FindContactsOutputSchema>;

export async function findContacts(input: FindContactsInput): Promise<FindContactsOutput> {
  return findContactFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findContactPrompt',
  input: { schema: FindContactsInputSchema },
  output: { schema: FindContactsOutputSchema },
  prompt: `Você é um assistente de IA especialista em processar texto e extrair informações de contato.
Sua tarefa é analisar a lista de contatos fornecida e encontrar todas as entradas que correspondem ao termo de busca.

Instruções:
1.  Analise a 'contactList' abaixo. Ela pode estar em vários formatos (ex: "Nome (numero)", "Nome: numero", "numero Nome").
2.  Busque por todas as entradas que contenham o 'searchTerm'. A busca deve ser flexível (casos diferentes, nomes parciais).
3.  Para cada correspondência, extraia o nome completo do contato e seu ID (geralmente um número de telefone).
4.  Formate o ID para o padrão de chat, se necessário. Por exemplo, se encontrar um número como (11) 99999-8888, normalize-o para 5511999998888@c.us. Assuma o código do Brasil (55) se não for especificado. Remova todos os caracteres não numéricos antes de adicionar o sufixo '@c.us'.
5.  Retorne os resultados como um array de objetos no formato especificado em 'output.schema'. Se nenhuma correspondência for encontrada, retorne um array vazio.

Lista de Contatos:
---
{{{contactList}}}
---

Termo de Busca: "{{searchTerm}}"
`,
});

const findContactFlow = ai.defineFlow(
  {
    name: 'findContactFlow',
    inputSchema: FindContactsInputSchema,
    outputSchema: FindContactsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
