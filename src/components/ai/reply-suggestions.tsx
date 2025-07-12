'use client';

import React, { useState, useTransition } from 'react';
import { Wand, Loader2, Smile, Frown, Meh, Sparkles } from 'lucide-react';
import { suggestReplies, SuggestRepliesOutput } from '@/ai/flows/suggest-replies';
import { Message } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


interface ReplySuggestionsProps {
  lastMessage: Message;
  onSuggestionClick: (suggestion: string) => void;
}

const sentimentIcons = {
  positive: <Smile className="h-4 w-4 text-green-500" />,
  negative: <Frown className="h-4 w-4 text-red-500" />,
  neutral: <Meh className="h-4 w-4 text-yellow-500" />,
};

export function ReplySuggestions({ lastMessage, onSuggestionClick }: ReplySuggestionsProps) {
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<SuggestRepliesOutput | null>(null);
  const { toast } = useToast();

  const handleSuggestReplies = () => {
    startTransition(async () => {
      try {
        const result = await suggestReplies({ message: lastMessage.text });
        setSuggestions(result);
      } catch (error) {
        console.error('Error getting suggestions:', error);
        toast({
          variant: 'destructive',
          title: 'Erro de IA',
          description: 'Não foi possível gerar sugestões de resposta.',
        });
      }
    });
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-4">
        <Button onClick={handleSuggestReplies} disabled={isPending} variant="outline" size="sm">
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand className="mr-2 h-4 w-4 text-accent" />
          )}
          Sugerir Respostas (IA)
        </Button>
        {suggestions && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="capitalize flex items-center gap-2">
                    {sentimentIcons[suggestions.sentiment.toLowerCase() as keyof typeof sentimentIcons]}
                    {suggestions.sentiment}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sentimento detectado pela IA</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {suggestions && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.suggestedReplies.map((reply, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => onSuggestionClick(reply)}
              className="bg-accent/10 hover:bg-accent/20 border-accent/20"
            >
              <Sparkles className="mr-2 h-3 w-3" />
              {reply}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
