import { GoogleGenerativeAI } from "@google/generative-ai";

// Extracted API key for clarity - ensure this is your actual key
const API_KEY = 'AIzaSyCCCHh_fFM_QwDXuyosvORR9Y5t42pEDPU';
// Using a single versatile model for all functions
const MODEL_NAME = "gemini-2.5-pro-preview-05-06";

const ai = new GoogleGenerativeAI(API_KEY);
// Initialize the shared model instance once
const model = ai.getGenerativeModel({ model: MODEL_NAME });

// Initialize a single chat session when the module loads
// You can initialize with a history if needed, e.g., { history: [] }
const chat = model.startChat({ 
  history: [] // Start with an empty history for now
});

/**
 * Sends a prompt to the ongoing Gemini chat session.
 * @param {string} prompt - The prompt to send.
 * @returns {Promise<Object>} The parsed response from Gemini.
 */
export async function askGemini(prompt) {
  try {
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return {
      content: response.text(),
      raw: response
    };
  } catch (error) {
    console.error('Error sending message to Gemini chat:', error);
    throw error;
  }
}

/**
 * Sends a prompt to Gemini expecting a JSON response from the ongoing chat.
 * @param {string} prompt - The prompt to send.
 * @param {Object} jsonSchema - Expected schema of the JSON response.
 * @returns {Promise<Object>} Parsed JSON response.
 */
export async function askGeminiForJson(prompt, jsonSchema) {
  try {
    const jsonPrompt = `${prompt}\n\nPlease format your response as a valid JSON object following this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
    
    const result = await chat.sendMessage(jsonPrompt);
    const response = await result.response;
    const responseText = response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }

    try {
      const parsedJson = JSON.parse(jsonMatch[0]);
      return parsedJson;
    } catch (parseError) {
      throw new Error(`Failed to parse JSON response: ${parseError.message}`);
    }
  } catch (error) {
    console.error('Error in JSON request to Gemini chat:', error);
    throw error;
  }
}

/**
 * Sends a prompt with an image to the ongoing Gemini chat session.
 * @param {string} imageData - Base64 encoded image data.
 * @param {string} prompt - The prompt to send.
 * @returns {Promise<Object>} The parsed response.
 */
export async function askGeminiWithImage(imageData, prompt) {
  try {
    const base64Data = imageData.includes('base64,') ? imageData.split('base64,')[1] : imageData;
    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg", // Assuming jpeg, adjust if dynamic type is needed
        data: base64Data
      }
    };
    
    const result = await chat.sendMessage([prompt, imagePart]);
    const response = await result.response;
    return {
      content: response.text(),
      raw: response
    };
  } catch (error) {
    console.error('Error sending image message to Gemini chat:', error);
    throw error;
  }
}

/**
 * Sends a prompt with one or more files to the ongoing Gemini chat session.
 * @param {string} prompt - The prompt to send.
 * @param {Array<{mimeType: string, data: string}>} filesToAttach - An array of file objects.
 * @returns {Promise<Object>} The parsed response.
 */
export async function askGeminiWithFiles(prompt, filesToAttach = []) {
  try {
    const contentParts = [prompt];
    for (const file of filesToAttach) {
      const base64Data = file.data.includes('base64,') ? file.data.split('base64,')[1] : file.data;
      contentParts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: base64Data
        }
      });
    }
    
    const result = await chat.sendMessage(contentParts);
    const response = await result.response;
    return {
      content: response.text(),
      raw: response
    };
  } catch (error) {
    console.error(`Error sending multi-file message to Gemini chat:`, error);
    throw error;
  }
}

// Example usage (conceptual, actual calls are in your components):
/*
async function runExamples() {
  // Simple text prompt
  // const response = await askGemini("What is the capital of France?");
  // console.log("Text Prompt Response:", response.content);

  // JSON response with schema
  // const jsonResponse = await askGeminiForJson(
  //   "List three European capitals and their countries",
  //   {
  //     capitals: [
  //       { city: "string", country: "string" },
  //       { city: "string", country: "string" },
  //       { city: "string", country: "string" }
  //     ]
  //   }
  // );
  // console.log("JSON Response:", jsonResponse);

  // Note: For image and file examples, you'd need actual base64 data.
  // const mockImageBase64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // 1x1 transparent gif
  // const imageResponse = await askGeminiWithImage(mockImageBase64, "Describe this placeholder image");
  // console.log("Image Prompt Response:", imageResponse.content);

  // const mockPdfBase64 = "JVBERi0xLjQKJ..."; // A very short, invalid PDF base64 string for structure
  // const fileResponse = await askGeminiWithFiles("Summarize this document",
  //   [{ mimeType: "application/pdf", data: mockPdfBase64 }]
  // );
  // console.log("File Prompt Response:", fileResponse.content);
}

// runExamples();
*/