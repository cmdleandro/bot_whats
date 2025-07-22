
import { checkRedisConnection } from '@/actions/redis-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Server } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default async function StatusPage() {
  const status = await checkRedisConnection();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Server className="h-6 w-6" />
            <span>Status do Sistema</span>
          </CardTitle>
          <CardDescription>
            Verificação em tempo real dos serviços essenciais da aplicação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <span className="font-semibold">Conexão com Redis</span>
            </div>
            {status.connected ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Desconectado
              </Badge>
            )}
          </div>

          {status.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro na Conexão com Redis</AlertTitle>
              <AlertDescription>
                <p className="font-mono text-xs">{status.error}</p>
              </AlertDescription>
            </Alert>
          )}

          {status.connected && (
             <div>
                <h3 className="font-semibold mb-2 text-sm">Amostra de Chaves (`chat:*`)</h3>
                {status.sampleKeys && status.sampleKeys.length > 0 ? (
                    <div className="bg-muted p-3 rounded-md font-mono text-xs space-y-1">
                    {status.sampleKeys.map((key) => <p key={key}>{key}</p>)}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma chave com o padrão `chat:*` foi encontrada.</p>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
