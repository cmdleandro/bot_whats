
'use server';

/**
 * @fileOverview Um agente de IA para encontrar contatos em uma lista armazenada no Redis.
 *
 * - findContacts - Uma função que busca contatos com base em um termo.
 * - FindContactsInput - O tipo de entrada para a função findContacts.
 * - FindContactsOutput - O tipo de retorno para a função findContacts.
 */

import { ai } from '@/ai/genkit';
import { getStoredContacts } from '@/lib/redis';
import { z } from 'zod';

const FindContactsInputSchema = z.object({
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

// O schema para o prompt precisa incluir a lista de contatos que virá do Redis.
const InternalPromptInputSchema = z.object({
    contactList: z.string().describe('Uma string de texto contendo uma lista de nomes e números de telefone/IDs de contatos.'),
    searchTerm: z.string().describe('O nome ou termo a ser buscado na lista de contatos.'),
});


const prompt = ai.definePrompt({
  name: 'findContactPrompt',
  input: { schema: InternalPromptInputSchema },
  output: { schema: FindContactsOutputSchema },
  prompt: `Você é um assistente de IA especialista em processar texto e extrair informações de contato.
Sua tarefa é analisar a lista de contatos fornecida e encontrar todas as entradas que correspondem ao termo de busca.

Instruções:
1.  Analise a 'contactList' abaixo. Ela é uma lista de contatos no formato "Nome (ID)".
2.  Busque por todas as entradas que contenham o 'searchTerm'. A busca deve ser flexível e sem diferenciar maiúsculas/minúsculas.
3.  Para cada correspondência, extraia o nome completo e o ID do contato.
4.  Retorne os resultados como um array de objetos no formato especificado em 'output.schema'. Se nenhuma correspondência for encontrada, retorne um array vazio.

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
  async ({ searchTerm }) => {
    // 1. Buscar os contatos do Redis
    const storedContacts = await getStoredContacts();
    if (storedContacts.length === 0) {
        return { contacts: [] };
    }

    // 2. Formatar a lista de contatos para o prompt
    const contactListString = storedContacts
        .map(c => `${c.name} (${c.id})`)
        .join('\n');

    // 3. Chamar o prompt com a lista formatada e o termo de busca
    const { output } = await prompt({
        contactList: contactListString,
        searchTerm: searchTerm,
    });
    
    return output!;
  }
);
