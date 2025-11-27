"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import OpenAI from "openai";

export const chat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<{ success: boolean; response?: string; error?: string }> => {
    const apiKey: string | undefined = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured. Please add it in the backend environment variables.");
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://scienceutsav.app",
        "X-Title": "ScienceUtsav Management System",
      },
    });

    // Fetch current system data for context
    const kits: Array<any> = await ctx.runQuery(api.kits.list);
    const inventory: Array<any> = await ctx.runQuery(api.inventory.list);
    const assignments: Array<any> = await ctx.runQuery(api.assignments.list, {});
    const clients: Array<any> = await ctx.runQuery(api.clients.list);

    // Build system context
    const systemContext: string = `You are an AI assistant for the ScienceUtsav Management System. You have access to the following data:

KITS (${kits.length} total):
${kits.map((k: any) => `- ${k.name}: Stock ${k.stockCount}, Status: ${k.status || 'active'}`).join('\n')}

INVENTORY (${inventory.length} items):
${inventory.map((i: any) => `- ${i.name}: ${i.quantity} ${i.unit}, Type: ${i.type}`).join('\n')}

ASSIGNMENTS (${assignments.length} total):
${assignments.map((a: any) => `- Kit: ${a.kit?.name || 'Unknown'}, Client: ${a.client?.name || 'Unknown'}, Qty: ${a.quantity}, Status: ${a.status}`).join('\n')}

CLIENTS (${clients.length} total):
${clients.map((c: any) => `- ${c.name}${c.organization ? ` (${c.organization})` : ''}`).join('\n')}

Answer questions about kit availability, inventory levels, stock status, assignments, and general system information. Be concise and helpful.`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system" as const, content: systemContext },
      ...args.messages,
    ];

    try {
      const completion: any = await openai.chat.completions.create({
        model: "tngtech/deepseek-r1t2-chimera:free",
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      const response: string = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
      
      return { success: true, response };
    } catch (error: any) {
      console.error("OpenRouter API error:", error);
      
      if (error.status === 401) {
        return { 
          success: false, 
          error: "Invalid API key. Please check your OPENROUTER_API_KEY configuration." 
        };
      } else if (error.status === 429) {
        return { 
          success: false, 
          error: "Rate limit exceeded. Please try again in a moment." 
        };
      } else {
        return { 
          success: false, 
          error: `Failed to get AI response: ${error.message || 'Unknown error'}` 
        };
      }
    }
  },
});

export const parseKitFromSheet = action({
  args: { rawText: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; data?: string; error?: string }> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return { success: false, error: "AI configuration missing" };
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://scienceutsav.app",
        "X-Title": "ScienceUtsav Management System",
      },
    });

    // Fetch inventory for matching (limit to name and ID to save tokens)
    const inventory = await ctx.runQuery(api.inventory.list);
    // Take top 500 items or simplify to avoid token limits if list is huge
    // For now assuming it fits or we rely on fuzzy matching later. 
    // We'll send a simplified list.
    const inventoryContext = inventory
      .map((i: any) => `${i.name} (ID: ${i._id})`)
      .slice(0, 1000) // Safety limit
      .join("\n");

    const prompt = `
    You are a data extraction assistant for a science kit manufacturing system.
    I will provide raw text copied from a spreadsheet (Google Sheets/Excel).
    
    Your task is to extract structured kit data.
    
    The text usually contains columns like: "Sl No", "Item", "Details", "Qty", "Packing plan".
    
    INSTRUCTIONS:
    1. Identify the Kit Name if it appears in the header/first lines.
    2. Identify the Kit Category if mentioned (e.g., "Explorer", "Discoverer", "Grade 6", "Physics").
    3. Extract each component row. Combine "Item" and "Details" for the component name.
    4. Extract Quantity. Default to 1 if missing.
    5. Try to match the component to the provided INVENTORY LIST. If you find a high-confidence match, include the ID. Otherwise null.
    6. Analyze the "Packing plan" column (or similar grouping indicators like "Pouch", "Packet A", "1.1", "1.2"). 
       - "Pouch" or "Main Pouch" usually refers to the main sealed outer packaging. Map these to "pouches".
       - Numbered groups like "1.1", "1.2", "Packet A" refer to smaller internal packets. Map these to "packets".
       - Create a structured JSON object for packing.
    
    INVENTORY LIST:
    ${inventoryContext}
    
    RAW SHEET DATA:
    ${args.rawText}
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "name": "Extracted Kit Name",
      "category": "Extracted Category",
      "description": "Generated description based on items",
      "components": [
        {
          "name": "Item Name",
          "quantity": number,
          "unit": "pcs",
          "inventoryItemId": "id_or_null",
          "notes": "Any extra details from the row"
        }
      ],
      "packingRequirements": {
        "pouches": [
          { "name": "Main Pouch", "materials": [{ "name": "Item Name", "quantity": 1, "unit": "pcs" }] }
        ],
        "packets": [
          { "name": "Packet 1.1", "materials": [{ "name": "Item Name", "quantity": 1, "unit": "pcs" }] }
        ]
      }
    }
    `;

    try {
      const completion = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini", // Using a capable model for extraction
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) throw new Error("No response from AI");

      return { success: true, data: response };
    } catch (error: any) {
      console.error("AI Parse Error:", error);
      return { success: false, error: error.message };
    }
  },
});