import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/ai/chat", async (req, res): Promise<void> => {
  const { message, apiKey, context } = req.body;

  if (!message || !apiKey) {
    res.status(400).json({ error: "message and apiKey are required" });
    return;
  }

  try {
    const systemPrompt = `You are a world-class personal fitness coach and nutritionist with deep knowledge of strength training, nutrition science, and recovery protocols. You have access to the user's fitness data and provide highly personalized, evidence-based advice.

When the user asks for a workout plan, provide specific exercises with sets, reps, and rest times.
When the user asks about nutrition, provide specific macro and calorie targets.
When the user asks for recipes, provide complete ingredient lists and macro breakdowns.
Always be encouraging, specific, and actionable.

User's current data context:
${JSON.stringify(context ?? {}, null, 2)}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      req.log.warn({ status: response.status, error }, "OpenAI API error");
      res.status(response.status).json({ error: "AI service error. Please check your API key." });
      return;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const aiResponse = data.choices[0]?.message?.content ?? "I couldn't generate a response.";

    let actionType: "message" | "create_workout" | "update_macros" | "generate_recipe" | null = null;
    if (message.toLowerCase().includes("workout plan") || message.toLowerCase().includes("create a plan")) {
      actionType = "create_workout";
    } else if (message.toLowerCase().includes("macro") || message.toLowerCase().includes("calorie")) {
      actionType = "update_macros";
    } else if (message.toLowerCase().includes("recipe") || message.toLowerCase().includes("meal")) {
      actionType = "generate_recipe";
    } else {
      actionType = "message";
    }

    res.json({
      response: aiResponse,
      actionType,
      actionData: null,
    });
  } catch (err) {
    req.log.error({ err }, "Error calling AI service");
    res.status(500).json({ error: "Failed to reach AI service. Please try again." });
  }
});

export default router;
