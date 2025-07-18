
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { defineDotprompt } from 'genkit/dotprompt';
import { z } from 'zod';
import path from 'path';

// Construct the path to the prompts directory
const promptsPath = path.join(process.cwd(), 'src', 'ai', 'prompts');

defineDotprompt(
  {
    name: 'prompt/diagnose-plant',
    model: 'googleai/gemini-1.5-flash',
    input: {
      schema: z.object({
        photoDataUri: z.string(),
        description: z.string(),
      }),
    },
    output: {
      format: 'json',
      schema: z.object({
        isPlant: z.boolean(),
        commonName: z.string(),
        latinName: z.string(),
        isHealthy: z.boolean(),
        diagnosis: z.string(),
      }),
    },
    config: {
      temperature: 0.2,
    },
  },
  path.join(promptsPath, 'diagnose-plant.prompt')
);

// Define the global `ai` object.
// This can be used to register other Genkit objects.
export const ai = genkit({
  plugins: [googleAI()],
});
