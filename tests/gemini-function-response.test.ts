import { describe, it, expect } from "vitest";
import {
  buildGeminiFunctionResponsePart,
  sanitizeGeminiContents,
  GeminiContent,
} from "../server/_core/llm";

describe("Gemini Function Response Fixes", () => {
  it("should safely build functionResponse part with non-empty name", () => {
    const part = buildGeminiFunctionResponsePart("getWeather", { temperature: "25C" });
    expect(part).toEqual({
      functionResponse: {
        name: "getWeather",
        response: { temperature: "25C" },
      },
    });
  });

  it("should fallback to default_function if name is empty or whitespace", () => {
    const part1 = buildGeminiFunctionResponsePart("", { result: "ok" });
    expect((part1 as any).functionResponse.name).toBe("default_function");

    const part2 = buildGeminiFunctionResponsePart("   ", { result: "ok" });
    expect((part2 as any).functionResponse.name).toBe("default_function");
  });

  it("should sanitize Gemini contents array when functionResponse.name is missing or empty", () => {
    const brokenContents: GeminiContent[] = [
      {
        role: "user",
        parts: [{ text: "查詢天氣" }],
      },
      {
        role: "model",
        parts: [
          {
            functionCall: {
              name: "checkWeather",
              args: { location: "Taipei" },
            },
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: "", // Empty name causing GenerateContentRequest error
              response: { result: "Sunny" },
            },
          } as any,
        ],
      },
    ];

    const sanitized = sanitizeGeminiContents(brokenContents);

    // The empty functionResponse.name should be restored to "checkWeather"
    const fixedPart = (sanitized[2].parts?.[0] as any).functionResponse;
    expect(fixedPart.name).toBe("checkWeather");
    expect(fixedPart.name).not.toBe("");
  });
});
