export type ImageModelAccessLevel = "anonymous" | "registered";

export const IMAGE_MODELS = [
  {
    id: "openai/gpt-image-1-mini",
    name: "GPT Image 1 Mini",
    badge: ["image", "openai"] as readonly string[],
    accessLevel: "registered" as ImageModelAccessLevel,
  },
  {
    id: "google/gemini-3.1-flash-lite-image",
    name: "Gemini 3.1 Flash Lite Image",
    badge: ["image", "google"] as readonly string[],
    accessLevel: "registered" as ImageModelAccessLevel,
  },
  {
    id: "black-forest-labs/flux.2-klein-4b",
    name: "FLUX.2 Klein 4B",
    badge: ["image", "flux"] as readonly string[],
    accessLevel: "registered" as ImageModelAccessLevel,
  },
] as const;

export type ImageModelId = typeof IMAGE_MODELS[number]["id"];
