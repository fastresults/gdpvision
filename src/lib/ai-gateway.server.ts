// Server-only Lovable AI Gateway provider (OpenAI-compatible).
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(
  apiKey: string,
  options?: { structuredOutputs?: boolean },
) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
    includeUsage: true,
    // OpenAI structured output needs strict json_schema; without this the SDK
    // sends json_object and the provider rejects the request.
    supportsStructuredOutputs: options?.structuredOutputs ?? false,
  });
}

