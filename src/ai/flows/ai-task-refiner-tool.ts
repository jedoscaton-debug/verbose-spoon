'use server';
/**
 * @fileOverview An AI agent that refines a complex task into actionable sub-tasks.
 *
 * - refineTask - A function that handles the task refinement process.
 * - AiTaskRefinerInput - The input type for the refineTask function.
 * - AiTaskRefinerOutput - The return type for the refineTask function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiTaskRefinerInputSchema = z.object({
  taskDescription: z.string().describe('The description of the complex task to be refined.'),
  projectContext: z
    .string()
    .optional()
    .describe('Optional context about the project to help refine the task.'),
});
export type AiTaskRefinerInput = z.infer<typeof AiTaskRefinerInputSchema>;

const AiTaskRefinerOutputSchema = z.object({
  subTasks: z.array(z.string()).describe('A list of actionable sub-tasks derived from the complex task.'),
});
export type AiTaskRefinerOutput = z.infer<typeof AiTaskRefinerOutputSchema>;

export async function refineTask(input: AiTaskRefinerInput): Promise<AiTaskRefinerOutput> {
  return aiTaskRefinerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiTaskRefinerPrompt',
  input: {schema: AiTaskRefinerInputSchema},
  output: {schema: AiTaskRefinerOutputSchema},
  prompt: `You are an expert project manager and assistant.

Your goal is to break down a given complex task into a list of smaller, actionable sub-tasks.
Each sub-task should be clear, concise, and manageable.

Complex Task: {{{taskDescription}}}
{{#if projectContext}}
Project Context: {{{projectContext}}}
{{/if}}

Provide the sub-tasks in a JSON array format as specified by the output schema.
`,
});

const aiTaskRefinerFlow = ai.defineFlow(
  {
    name: 'aiTaskRefinerFlow',
    inputSchema: AiTaskRefinerInputSchema,
    outputSchema: AiTaskRefinerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
