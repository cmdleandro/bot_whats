
'use server';

/**
 * @fileOverview Um agente de IA para processar arquivos de contatos nos formatos CSV e VCF.
 * 
 * - processContactsFile - Processa o conteúdo de um arquivo e extrai contatos.
 * - ProcessContactsFileInput - O tipo de entrada para a função.
 * - ProcessContactsFileOutput - O tipo de retorno da função.
 */

import { ai } from '@/ai/genkit';
import * as genkit from 'genkit';
import { z } from 'zod';

const ProcessContactsFileInputSchema = z.object({
  fileContent: z.string().describe('O conteúdo completo de um arquivo de contatos, que pode ser no formato CSV (Google Contacts) ou VCF (vCard).'),
});
export type ProcessContactsFileInput = z.infer<typeof ProcessContactsFileInputSchema>;

const ProcessContactsFileOutputSchema = z.object({
  contacts: z.array(z.object({
    name: z.string().describe('O nome completo do contato.'),
    id: z.string().describe('O ID do contato (número de telefone), normalizado para o formato 5511999998888@c.us.'),
  })).describe('Uma lista de contatos extraídos do arquivo.'),
});
export type ProcessContactsFileOutput = z.infer<typeof ProcessContactsFileOutputSchema>;

export async function processContactsFile(input: ProcessContactsFileInput): Promise<ProcessContactsFileOutput> {
  return processContactsFileFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processContactsFilePrompt',
  input: { schema: ProcessContactsFileInputSchema },
  output: { schema: ProcessContactsFileOutputSchema },
  prompt: `Você é um especialista em processamento de dados e sua tarefa é analisar o conteúdo de um arquivo de contatos e extrair todos os contatos válidos com nome e telefone. O arquivo pode ser no formato CSV do Google Contacts ou VCF (vCard).

Instruções Gerais:
1.  Primeiro, identifique o formato do arquivo (CSV ou VCF) com base no 'fileContent' abaixo.
2.  Com base no formato, siga as instruções específicas para extrair os contatos.
3.  Ignore contatos que não possuam nome E um número de telefone válidos.
4.  Normalize TODOS os números de telefone para o formato de chat:
    a. Remova todos os caracteres não numéricos (espaços, hífens, parênteses, etc.).
    b. Se o número não começar com o código do país '55' (Brasil), adicione-o.
    c. Adicione o sufixo '@c.us' no final.
    d. Exemplo: '+55 (11) 99999-8888' se torna '5511999998888@c.us'.
5.  Retorne uma lista de todos os contatos encontrados no formato especificado em 'output.schema'. Se o arquivo estiver vazio ou não contiver contatos válidos, retorne um array vazio.

Instruções para formato CSV (Google Contacts):
- O nome do contato geralmente está na coluna 'Name'.
- O número de telefone geralmente está na coluna 'Phone 1 - Value'.

Instruções para formato VCF (vCard):
- Cada contato começa com 'BEGIN:VCARD' e termina com 'END:VCARD'.
- O nome do contato geralmente está no campo 'FN' (Full Name).
- O número de telefone está no campo 'TEL'. Um contato pode ter vários campos 'TEL', use o primeiro que encontrar.

Conteúdo do Arquivo:
---
{{{fileContent}}}
---
`,
});

const processContactsFileFlow = ai.defineFlow(
  {
    name: 'processContactsFileFlow',
    inputSchema: ProcessContactsFileInputSchema,
    outputSchema: ProcessContactsFileOutputSchema,
    retry: genkit.backoff({
      maxRetries: 3,
      delay: 2000,
      multiplier: 2,
    }),
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
