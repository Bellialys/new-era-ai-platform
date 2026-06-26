export const IMAGE_MODELS = [
  { id: "openai/dall-e-3", name: "DALL-E 3", badge: ["image", "openai"], accessLevel: "registered" },
  { id: "openai/dall-e-2", name: "DALL-E 2", badge: ["image", "openai"], accessLevel: "registered" },
  { id: "stabilityai/stable-diffusion-xl-base-1.0", name: "Stable Diffusion XL", badge: ["image", "free"], accessLevel: "anonymous" },
] as const;

export type ImageModelId = typeof IMAGE_MODELS[number]["id"];
