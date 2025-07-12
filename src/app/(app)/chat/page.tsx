import { MessageSquareText } from 'lucide-react';

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-muted/20 text-center">
      <MessageSquareText className="h-20 w-20 text-muted-foreground/50" />
      <h2 className="mt-4 text-2xl font-semibold text-muted-foreground">Bem-vindo ao ChatView</h2>
      <p className="mt-2 text-muted-foreground">
        Selecione um contato na lista à esquerda para começar a conversar.
      </p>
    </div>
  );
}
