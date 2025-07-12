'use server';

/**
 * @fileOverview AI-powered suggested replies based on user sentiment.
 *
 * - suggestReplies - A function that generates suggested replies based on user sentiment.
 * - SuggestRepliesInput - The input type for the suggestReplies function.
 * - SuggestRepliesOutput - The return type for the suggestReplies function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestRepliesInputSchema = z.object({
  message: z.string().describe('The user message to analyze for sentiment.'),
});
export type SuggestRepliesInput = z.infer<typeof SuggestRepliesInputSchema>;

const SuggestRepliesOutputSchema = z.object({
  sentiment: z.string().describe('The sentiment of the user message (positive, negative, neutral).'),
  suggestedReplies: z.array(z.string()).describe('An array of suggested replies based on the sentiment.'),
});
export type SuggestRepliesOutput = z.infer<typeof SuggestRepliesOutputSchema>;

export async function suggestReplies(input: SuggestRepliesInput): Promise<SuggestRepliesOutput> {
  return suggestRepliesFlow(input);
}

const analyzeSentimentTool = ai.defineTool({
  name: 'analyzeSentiment',
  description: 'Analyzes the sentiment of a given text message.',
  inputSchema: z.object({
    text: z.string().describe('The text message to analyze.'),
  }),
  outputSchema: z.string().describe('The sentiment of the text (positive, negative, or neutral).'),
}, async (input) => {
  const { text } = input;
  // Simulate sentiment analysis (replace with actual sentiment analysis service call).
  if (text.includes('happy') || text.includes('good') || text.includes('great')) {
    return 'positive';
  } else if (text.includes('sad') || text.includes('bad') || text.includes('terrible')) {
    return 'negative';
  } else {
    return 'neutral';
  }
});

const prompt = ai.definePrompt({
  name: 'suggestRepliesPrompt',
  input: {schema: SuggestRepliesInputSchema},
  output: {schema: SuggestRepliesOutputSchema},
  tools: [analyzeSentimentTool],
  prompt: `You are a helpful assistant providing suggested replies based on user sentiment.

  Analyze the sentiment of the following message using the analyzeSentiment tool.  Then, based on that sentiment, suggest 3 possible replies that would be appropriate for an operator to use.

  Message: {{{message}}}

  The sentiment is: {{#tool_result 'analyzeSentiment'}}{{{this}}}{{/tool_result}}

  Here are suggested replies:
  1.
  2.
  3.`,
});

const suggestRepliesFlow = ai.defineFlow(
  {
    name: 'suggestRepliesFlow',
    inputSchema: SuggestRepliesInputSchema,
    outputSchema: SuggestRepliesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
