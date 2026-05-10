"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type Lead = {
  id: string;
  name: string | null;
  phone: string;
  source: string | null;
  last_message_at: string | null;
  created_at: string;
  archetype: string | null;
  geo: string | null;
  case_type: string | null;
};

type Message = {
  id: string;
  lead_id: string;
  direction: "inbound" | "outbound";
  text: string;
  created_at: string;
};

export function CrmInbox({ initialLeads }: { initialLeads: Lead[] }) {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selected, setSelected] = useState<Lead | null>(initialLeads[0] ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollEnd = useRef<HTMLDivElement>(null);

  // Realtime: leads (insert/update)
  useEffect(() => {
    const ch = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLeads((prev) => [payload.new as Lead, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLeads((prev) =>
              prev.map((l) => (l.id === (payload.new as Lead).id ? (payload.new as Lead) : l)),
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase]);

  // Carrega mensagens do lead selecionado + realtime
  useEffect(() => {
    if (!selected) return;
    let active = true;
    supabase
      .from("messages")
      .select("id, lead_id, direction, text, created_at")
      .eq("lead_id", selected.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setMessages((data as Message[]) ?? []);
      });

    const ch = supabase
      .channel(`messages-${selected.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `lead_id=eq.${selected.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [selected, supabase]);

  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!selected || !draft.trim()) return;
    setSending(true);
    const res = await fetch("/api/zapi/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: selected.id, message: draft }),
    });
    setSending(false);
    if (res.ok) {
      setDraft("");
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Erro: ${data.error ?? "envio falhou"}`);
    }
  }

  return (
    <div className="grid grid-cols-[320px_1fr] flex-1 min-h-0">
      {/* Sidebar */}
      <aside className="border-r bg-white flex flex-col">
        <div className="p-3 border-b">
          <h2 className="text-sm font-semibold text-slate-700">Leads</h2>
        </div>
        <ScrollArea className="flex-1">
          {leads.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhum lead ainda.</p>
          ) : (
            <ul>
              {leads.map((lead) => (
                <li
                  key={lead.id}
                  className={`p-3 border-b cursor-pointer hover:bg-slate-100 ${
                    selected?.id === lead.id ? "bg-slate-200" : ""
                  }`}
                  onClick={() => setSelected(lead)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">
                      {lead.name ?? "—"}
                    </span>
                    {lead.source && (
                      <Badge variant="secondary" className="text-[10px]">
                        {lead.source}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{lead.phone}</div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* Conversation */}
      <section className="flex flex-col">
        {selected ? (
          <>
            <header className="p-4 border-b bg-white">
              <div className="font-semibold">{selected.name ?? selected.phone}</div>
              <div className="text-xs text-slate-500">
                {selected.phone}
                {selected.archetype && ` · ${selected.archetype}`}
                {selected.geo && ` · ${selected.geo}`}
                {selected.case_type && ` · caso: ${selected.case_type}`}
              </div>
            </header>

            <ScrollArea className="flex-1 p-4 bg-slate-100">
              <div className="space-y-2 max-w-2xl mx-auto">
                {messages.map((m) => (
                  <Card
                    key={m.id}
                    className={`p-3 max-w-md text-sm ${
                      m.direction === "outbound"
                        ? "ml-auto bg-emerald-100"
                        : "bg-white"
                    }`}
                  >
                    {m.text}
                    <div className="text-[10px] text-slate-400 mt-1">
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                    </div>
                  </Card>
                ))}
                <div ref={scrollEnd} />
              </div>
            </ScrollArea>

            <Separator />
            <div className="p-3 bg-white flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Mensagem..."
                disabled={sending}
              />
              <Button onClick={handleSend} disabled={sending || !draft.trim()}>
                {sending ? "..." : "Enviar"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Selecione um lead na sidebar
          </div>
        )}
      </section>
    </div>
  );
}
