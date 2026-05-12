// Server-only loader (importa supabase/server que tem next/headers).
// Não importar de client components — use integration-config.ts pra types/schema.
import { createServiceClient } from "@/lib/supabase/server";
import {
  DEFAULT_INTEGRATION_CONFIG,
  IntegrationConfigSchema,
  type IntegrationConfig,
} from "./integration-config";

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("integration_config")
      .select("config")
      .eq("id", "current")
      .maybeSingle();

    if (error) {
      console.error("getIntegrationConfig db error", error);
      return DEFAULT_INTEGRATION_CONFIG;
    }
    if (!data?.config || Object.keys(data.config as object).length === 0) {
      return DEFAULT_INTEGRATION_CONFIG;
    }
    const parsed = IntegrationConfigSchema.safeParse(data.config);
    if (!parsed.success) {
      console.error("integration_config invalid, fallback", parsed.error.issues);
      return DEFAULT_INTEGRATION_CONFIG;
    }
    return parsed.data;
  } catch (e) {
    console.error("getIntegrationConfig threw", e);
    return DEFAULT_INTEGRATION_CONFIG;
  }
}
