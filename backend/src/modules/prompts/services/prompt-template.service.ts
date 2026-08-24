import { AiPromptTemplate } from "../../../models/ai-prompt.model";

export function extractVariables(template: string, systemPrompt?: string): string[] {
  const regex = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g;
  const variables = new Set<string>();
  let match;
  if (template) {
    while ((match = regex.exec(template)) !== null) {
      variables.add(match[1]);
    }
  }
  if (systemPrompt) {
    while ((match = regex.exec(systemPrompt)) !== null) {
      variables.add(match[1]);
    }
  }
  return Array.from(variables);
}

export async function getPromptTemplates(userId: string) {
  return AiPromptTemplate.find({ userId }).sort({ updatedAt: -1 });
}

export async function createOrUpdatePromptTemplate(userId: string, body: any) {
  const {
    id,
    name,
    description,
    template,
    systemPrompt,
    provider,
    model,
    endpoint,
    temperature,
    maxTokens,
    tags,
  } = body;

  if (!name || !template) {
    const error: any = new Error("name and template are required");
    error.statusCode = 400;
    throw error;
  }

  const variables = extractVariables(template, systemPrompt);
  const newVersionData = {
    version: 1,
    template,
    systemPrompt: systemPrompt || "",
    provider: provider || "openai",
    model: model || "gpt-4o",
    endpoint: typeof endpoint === "string" ? endpoint.trim() : "",
    temperature: typeof temperature === "number" ? temperature : 0.7,
    maxTokens: typeof maxTokens === "number" ? maxTokens : 256,
    createdAt: new Date(),
  };

  let promptTemplate = null;
  if (id && id !== "new" && /^[0-9a-fA-F]{24}$/.test(id)) {
    promptTemplate = await AiPromptTemplate.findOne({ _id: id, userId });
  }
  if (!promptTemplate) {
    promptTemplate = await AiPromptTemplate.findOne({ userId, name });
  }

  if (promptTemplate) {
    newVersionData.version = promptTemplate.versions.length + 1;
    promptTemplate.versions.push(newVersionData);
    promptTemplate.activeVersion = newVersionData.version;
    promptTemplate.variables = variables;
    if (name !== undefined) promptTemplate.name = name;
    if (description !== undefined) promptTemplate.description = description;
    if (tags !== undefined) promptTemplate.tags = tags;
    await promptTemplate.save();
    return promptTemplate;
  }

  return AiPromptTemplate.create({
    userId,
    name,
    description: description || "",
    variables,
    versions: [newVersionData],
    activeVersion: 1,
    tags: tags || [],
  });
}

export async function deletePromptTemplate(userId: string, id: string) {
  return AiPromptTemplate.findOneAndDelete({ _id: id, userId });
}
