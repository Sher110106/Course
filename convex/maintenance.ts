import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import { getResourceEndpoint } from "./utils/azure";

// -----------------------
// Azure OpenAI config
// -----------------------
const rootEndpoint = getResourceEndpoint(process.env.AZURE_OPENAI_ENDPOINT || "");
const embeddingDeployment = process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME || "text-embedding-3-large";
const embeddingEndpoint = `${rootEndpoint}/openai/deployments/${embeddingDeployment}`;

const embeddingClient = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY || "dummy-key",
  baseURL: embeddingEndpoint,
  defaultQuery: { "api-version": process.env.OPENAI_API_VERSION || "2024-02-01" },
  defaultHeaders: {
    "api-key": process.env.AZURE_OPENAI_API_KEY || "dummy-key",
  },
});

async function generateEmbedding(text: string): Promise<number[]> {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Embedding input must be a non-empty string.");
  }
  const response = await embeddingClient.embeddings.create({
    model: embeddingDeployment,
    input: text,
  });
  if (!response.data?.[0]?.embedding) {
    throw new Error("Invalid response from OpenAI embeddings API");
  }
  return response.data[0].embedding;
}

// -----------------------
// Internal action: regenerateCourseEmbeddings
// -----------------------
export const regenerateCourseEmbeddings = internalAction({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.runQuery(api.courses.getPlakshaCourses);
    let updated = 0;

    for (const course of courses) {
      try {
        const embedding = await generateEmbedding(course.description);
        await ctx.runMutation(internal.seedData.updateCourseEmbedding, {
          courseId: course._id,
          embedding,
        });
        updated += 1;
      } catch (error) {
        console.error(`Failed to regenerate embedding for ${course.code}:`, error);
      }
    }

    return `Regenerated embeddings for ${updated} courses.`;
  },
}); 