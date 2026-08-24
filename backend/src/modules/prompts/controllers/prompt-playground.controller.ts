import { Request, Response } from "express";

import {
  createOrUpdatePromptTemplate,
  deletePromptTemplate,
  getPromptTemplates,
} from "../services/prompt-template.service";

export async function getPrompts(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const prompts = await getPromptTemplates(userId);
    return res.json({ success: true, prompts });
  } catch (error: any) {
    console.error("getPrompts error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function createOrUpdatePrompt(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const prompt = await createOrUpdatePromptTemplate(userId, req.body);
    return res.json({ success: true, prompt });
  } catch (error: any) {
    console.error("createOrUpdatePrompt error:", error);
    return res
      .status(error?.statusCode || 500)
      .json({ success: false, error: error.message });
  }
}

export async function deletePrompt(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;
    const result = await deletePromptTemplate(userId, String(id));
    if (!result) {
      return res
        .status(404)
        .json({ success: false, error: "Prompt template not found" });
    }
    return res.json({ success: true });
  } catch (error: any) {
    console.error("deletePrompt error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
