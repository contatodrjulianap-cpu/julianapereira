"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  phone: z
    .string()
    .min(10, "Telefone inválido")
    .regex(/^\d+$/, "Apenas números (com DDD)"),
  goal: z.enum(["clarear", "lentes", "corrigir", "outro"]),
  budget: z.enum(["ate_5k", "5k_15k", "15k_30k", "30k_mais"]),
});

type FormData = z.infer<typeof Schema>;

export function QuizForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
  });

  async function onSubmit(values: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const phone = values.phone.startsWith("55") ? values.phone : `55${values.phone}`;
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, phone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao enviar");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-rose-900">Recebido! 💚</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-rose-700/80">
            A Dra. Juliana ou alguém da equipe vai te chamar no WhatsApp em até 24h
            úteis com a recomendação personalizada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Seu nome</Label>
            <Input id="name" placeholder="Ex: Maria Silva" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp (com DDD, só números)</Label>
            <Input
              id="phone"
              inputMode="numeric"
              placeholder="11999999999"
              {...form.register("phone")}
            />
            {form.formState.errors.phone && (
              <p className="text-xs text-red-600">{form.formState.errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>O que você quer melhorar no seu sorriso?</Label>
            <Select
              onValueChange={(v) => v && form.setValue("goal", v as FormData["goal"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clarear">Clarear os dentes</SelectItem>
                <SelectItem value="lentes">Lentes (resina ou porcelana)</SelectItem>
                <SelectItem value="corrigir">Corrigir formato/posição</SelectItem>
                <SelectItem value="outro">Outro / não sei ainda</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Investimento disponível</Label>
            <Select
              onValueChange={(v) => v && form.setValue("budget", v as FormData["budget"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ate_5k">Até R$ 5.000</SelectItem>
                <SelectItem value="5k_15k">R$ 5.000 a R$ 15.000</SelectItem>
                <SelectItem value="15k_30k">R$ 15.000 a R$ 30.000</SelectItem>
                <SelectItem value="30k_mais">Acima de R$ 30.000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Enviando..." : "Quero minha recomendação"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
