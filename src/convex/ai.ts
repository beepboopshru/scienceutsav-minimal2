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
    const assignments: Array<any> = await ctx.runQuery(api.assignments.list);
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
        model: "anthropic/claude-3-haiku",
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