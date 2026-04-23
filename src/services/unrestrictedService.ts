/**
 * Service for unrestricted image generation.
 * Pulls from our custom Perchance proxy backend.
 */

export interface PerchanceParams {
  prompt: string;
  negativePrompt?: string;
  guidanceScale?: number;
  seed?: number;
  aspectRatio?: string;
}

export async function generateUnrestrictedImage(params: PerchanceParams): Promise<string> {
  try {
    const response = await fetch("/api/perchance/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) throw new Error("Server proxy failed");
    
    const data = await response.json();
    
    // Per tutorial Step 5: "Display the first result"
    if (data && data.length > 0) {
      return data[0]; 
    }
    
    throw new Error("No results returned");

  } catch (error) {
    console.error("Unrestricted generation error:", error);
    // Silent fallback to Pollinations with unique seed
    const seed = Math.floor(Math.random() * 1000000);
    return `https://pollinations.ai/p/${encodeURIComponent(prompt)}?seed=${seed}&nologo=true&enhance=true`;
  }
}
