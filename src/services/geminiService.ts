import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: number;
  aspectRatio: string;
}

export async function generateImage(prompt: string, aspectRatio: string = "1:1"): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("No candidates received from AI model.");
    }

    if (candidate.finishReason === 'SAFETY') {
      throw new Error("Generation blocked by safety filters. Try a different prompt.");
    }

    for (const part of candidate.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    const textResponse = candidate.content?.parts?.find(p => p.text)?.text;
    throw new Error(textResponse || "No image data found in response");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

export async function editImage(base64Image: string, prompt: string): Promise<string> {
  try {
    let data = base64Image;
    let mimeType = "image/png";

    if (base64Image.includes(';base64,')) {
      const parts = base64Image.split(';base64,');
      mimeType = parts[0].split(':')[1] || "image/png";
      data = parts[1];
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("No candidates received from AI model.");
    }

    if (candidate.finishReason === 'SAFETY') {
      throw new Error("Edit blocked by safety filters. Try a different prompt.");
    }

    for (const part of candidate.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    const textResponse = candidate.content?.parts?.find(p => p.text)?.text;
    throw new Error(textResponse || "No image data found in response");
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
}
