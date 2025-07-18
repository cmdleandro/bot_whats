
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import path from 'path';

// Define the global `ai` object.
// This can be used to register other Genkit objects.
export const ai = genkit({
  plugins: [googleAI()],
});
