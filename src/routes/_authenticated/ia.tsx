import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, User, Bot, Lightbulb } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { iaChat } from "@/lib/ia.functions";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ia")({ component: IA });

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Quais acessos órfãos existem hoje?",
  "Liste os sistemas sem responsável.",
  "Gere um resumo executivo do ProAccess.",
  "Sugira acessos padrão para o cargo Analista Fiscal.",
  "Quais pendências críticas estão em aberto?",
];

function IA() {
  const chat = useServerFn(iaChat);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou a IA do ProAccess. Posso responder perguntas, encontrar inconsistências, sugerir acessos e muito mais. Como posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const res = await chat({
        data: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      setMsgs([...next, { role: "assistant", content: res.content }]);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-accent/10 p-2">
          <Sparkles className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Assistente IA</h1>
          <p className="text-xs text-muted-foreground">Powered by Lovable AI</p>
        </div>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {loading && <div className="text-sm text-muted-foreground">Pensando...</div>}
          <div ref={endRef} />
        </CardContent>
      </Card>

      {msgs.length <= 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lightbulb className="h-4 w-4" /> Sugestões
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {SUGESTOES.map((s) => (
              <Button key={s} size="sm" variant="outline" onClick={() => send(s)}>
                {s}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo à IA..."
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()} className="gap-2">
          <Send className="h-4 w-4" /> Enviar
        </Button>
      </form>
    </div>
  );
}
