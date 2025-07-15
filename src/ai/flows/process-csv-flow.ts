
'use server';

/**
 * @fileOverview Um agente de IA para processar arquivos CSV de contatos.
 * 
 * - processContactsCsv - Processa o conteúdo de um CSV e extrai contatos.
 * - ProcessContactsCsvInput - O tipo de entrada para a função.
 * - ProcessContactsCsvOutput - O tipo de retorno da função.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { StoredContact } from '@/lib/data';
import { backoff } from 'genkit';

const ProcessContactsCsvInputSchema = z.object({
  csvContent: z.string().describe('O conteúdo completo de um arquivo CSV exportado do Google Contacts.'),
});
export type ProcessContactsCsvInput = z.infer<typeof ProcessContactsCsvInputSchema>;

const ProcessContactsCsvOutputSchema = z.object({
  contacts: z.array(z.object({
    name: z.string().describe('O nome completo do contato.'),
    id: z.string().describe('O ID do contato (número de telefone), normalizado para o formato 5511999998888@c.us.'),
  })).describe('Uma lista de contatos extraídos do CSV.'),
});
export type ProcessContactsCsvOutput = z.infer<typeof ProcessContactsCsvOutputSchema>;

export async function processContactsCsv(input: ProcessContactsCsvInput): Promise<ProcessContactsCsvOutput> {
  return processContactsCsvFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processContactsCsvPrompt',
  input: { schema: ProcessContactsCsvInputSchema },
  output: { schema: ProcessContactsCsvOutputSchema },
  prompt: `Você é um especialista em processamento de dados e sua tarefa é analisar o conteúdo de um arquivo CSV do Google Contacts e extrair todos os contatos válidos com nome e telefone.

Instruções:
1.  Analise o 'csvContent' abaixo.
2.  Para cada linha, identifique o nome do contato (geralmente na coluna 'Name') e o número de telefone (geralmente na coluna 'Phone 1 - Value'). Ignore contatos sem nome ou sem número de telefone.
3.  Normalize o número de telefone para o formato de chat:
    a. Remova todos os caracteres não numéricos (espaços, hífens, parênteses, etc.).
    b. Se o número não começar com o código do país '55' (Brasil), adicione-o.
    c. Adicione o sufixo '@c.us' no final.
    d. Exemplo: '+55 (11) 99999-8888' se torna '5511999998888@c.us'.
4.  Retorne uma lista de todos os contatos encontrados no formato especificado em 'output.schema'. Se o CSV estiver vazio ou não contiver contatos válidos, retorne um array vazio.

Conteúdo CSV:
---
{{{csvContent}}}
---
`,
});

const processContactsCsvFlow = ai.defineFlow(
  {
    name: 'processContactsCsvFlow',
    inputSchema: ProcessContactsCsvInputSchema,
    outputSchema: ProcessContactsCsvOutputSchema,
    retry: backoff({
      maxRetries: 3, // Tenta até 3 vezes
      delay: 2000, // Começa com 2 segundos de atraso
      multiplier: 2, // Dobra o atraso a cada tentativa
    }),
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
