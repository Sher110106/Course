"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand, StartDocumentTextDetectionCommand, GetDocumentTextDetectionCommand } from "@aws-sdk/client-textract";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AWS_CONFIG, validateAWSConfig, logAWSConfigStatus } from "./config";
import { internal } from "./_generated/api";

// Initialize AWS clients lazily to avoid environment variable issues during module loading
let textractClient: TextractClient | null = null;
let s3Client: S3Client | null = null;

// Validate AWS credentials and initialize clients when needed
function getAWSClients() {
  if (textractClient && s3Client) {
    return { textractClient, s3Client };
  }

  // Log configuration status
  logAWSConfigStatus();

  // Validate configuration
  const config = validateAWSConfig();

  console.log(`[AWS] Initializing clients for region: ${config.region}`);

  textractClient = new TextractClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    maxAttempts: 3, // Add retry mechanism
  });

  s3Client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    maxAttempts: 3, // Add retry mechanism
  });

  console.log(`[AWS] Successfully initialized clients for region: ${config.region}`);
  return { textractClient, s3Client };
}

function bufferLooksLikePdf(buffer: Buffer): boolean {
  if (buffer.byteLength < 4) return false;
  // %PDF signature
  return buffer.slice(0, 4).toString() === "%PDF";
}

async function uploadToTextractBucketFromUrl(s3Client: S3Client, sourceUrl: string, bucket: string): Promise<{ bucket: string; key: string }>
{
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file for S3 upload: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  const isPdf = (response.headers.get('content-type') || '').toLowerCase().includes('pdf') || bufferLooksLikePdf(buf);
  const key = `textract/${Date.now()}-${Math.random().toString(36).slice(2)}${isPdf ? '.pdf' : ''}`;
  await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(arrayBuffer) }));
  return { bucket, key };
}

async function runAsyncTextractAnalysis(textractClient: TextractClient, document: { bucket: string; key: string }, features: string[]): Promise<any[]> {
  const start = await textractClient.send(new StartDocumentAnalysisCommand({
    DocumentLocation: { S3Object: { Bucket: document.bucket, Name: document.key } },
    FeatureTypes: features as any,
  }));
  const jobId = start.JobId;
  if (!jobId) throw new Error("Failed to start Textract analysis job");
  // Poll for completion with timeout + backoff
  let status = "IN_PROGRESS";
  const deadline = Date.now() + 5 * 60_000; // 5 minutes
  let delayMs = 1500;
  while (status === "IN_PROGRESS") {
    if (Date.now() > deadline) throw new Error("Textract analysis job timed out");
    await new Promise(r => setTimeout(r, delayMs));
    delayMs = Math.min(Math.floor(delayMs * 1.5), 8000);
    const res = await textractClient.send(new GetDocumentAnalysisCommand({ JobId: jobId }));
    status = res.JobStatus || "FAILED";
    if (status === "SUCCEEDED") {
      const blocks: any[] = [];
      let nextToken: string | undefined = res.NextToken;
      if (res.Blocks) blocks.push(...res.Blocks);
      while (nextToken) {
        const page = await textractClient.send(new GetDocumentAnalysisCommand({ JobId: jobId, NextToken: nextToken }));
        if (page.Blocks) blocks.push(...page.Blocks);
        nextToken = page.NextToken;
      }
      return blocks;
    }
    if (status === "FAILED" || status === "PARTIAL_SUCCESS") {
      throw new Error(`Textract analysis job did not succeed: ${status}`);
    }
  }
  throw new Error("Textract analysis job did not complete");
}

async function runAsyncTextractDetection(textractClient: TextractClient, document: { bucket: string; key: string }): Promise<any[]> {
  const start = await textractClient.send(new StartDocumentTextDetectionCommand({
    DocumentLocation: { S3Object: { Bucket: document.bucket, Name: document.key } },
  }));
  const jobId = start.JobId;
  if (!jobId) throw new Error("Failed to start Textract text detection job");
  let status = "IN_PROGRESS";
  const deadline = Date.now() + 5 * 60_000; // 5 minutes
  let delayMs = 1500;
  while (status === "IN_PROGRESS") {
    if (Date.now() > deadline) throw new Error("Textract text detection job timed out");
    await new Promise(r => setTimeout(r, delayMs));
    delayMs = Math.min(Math.floor(delayMs * 1.5), 8000);
    const res = await textractClient.send(new GetDocumentTextDetectionCommand({ JobId: jobId }));
    status = res.JobStatus || "FAILED";
    if (status === "SUCCEEDED") {
      const blocks: any[] = [];
      let nextToken: string | undefined = res.NextToken;
      if (res.Blocks) blocks.push(...res.Blocks);
      while (nextToken) {
        const page = await textractClient.send(new GetDocumentTextDetectionCommand({ JobId: jobId, NextToken: nextToken }));
        if (page.Blocks) blocks.push(...page.Blocks);
        nextToken = page.NextToken;
      }
      return blocks;
    }
    if (status === "FAILED" || status === "PARTIAL_SUCCESS") {
      throw new Error(`Textract text detection job did not succeed: ${status}`);
    }
  }
  throw new Error("Textract text detection job did not complete");
}

export interface TextractResult {
  text: string;
  confidence: number;
  blocks: Array<{
    BlockType?: string;
    Text?: string;
    Confidence?: number;
    [key: string]: any;
  }>;
  error?: string;
}

/**
 * Extract text from a PDF or image using Amazon Textract
 */
export const extractTextWithTextract = internalAction({
  args: {
    fileUrl: v.string(),
    features: v.optional(v.array(v.string())),
  },
  returns: v.object({
    text: v.string(),
    confidence: v.number(),
    blocks: v.array(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<TextractResult> => {
    try {
      console.log(`[Textract] Starting text extraction for: ${args.fileUrl}`);
      
      // Get AWS clients (this will validate credentials and initialize if needed)
      const { textractClient, s3Client } = getAWSClients();
      
      const features = args.features || ["TABLES", "FORMS"];
      
      // Determine if this is an S3 URL or Convex storage URL
      let documentBytes: Buffer;
      let contentType: string | undefined;
      if (args.fileUrl.startsWith('s3://')) {
        const s3Url = new URL(args.fileUrl);
        const bucket = s3Url.hostname;
        const key = s3Url.pathname.substring(1);
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const response = await s3Client.send(command);
        if (!response.Body) {
          throw new Error("Empty response body from S3");
        }
        contentType = response.ContentType;
        documentBytes = Buffer.from(await response.Body.transformToByteArray());
      } else {
        const response = await fetch(args.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        contentType = response.headers.get("content-type") || undefined;
        documentBytes = Buffer.from(await response.arrayBuffer());
      }

      let blocks: any[] = [];
      const config = validateAWSConfig();
      const looksLikePdf = (contentType?.toLowerCase().includes('pdf')) || bufferLooksLikePdf(documentBytes);
      const useAsync = looksLikePdf || (documentBytes && documentBytes.length > 4.5 * 1024 * 1024);
      if (useAsync) {
        if (!config.textractBucket) {
          throw new Error("AWS_TEXTRACT_BUCKET is not configured for asynchronous Textract processing");
        }
        // Upload to configured bucket if source is not s3, else reuse existing key
        let location: { bucket: string; key: string };
        if (args.fileUrl.startsWith('s3://')) {
          const s3Url = new URL(args.fileUrl);
          location = { bucket: s3Url.hostname, key: s3Url.pathname.substring(1) };
        } else {
          location = await uploadToTextractBucketFromUrl(s3Client, args.fileUrl, config.textractBucket);
        }
        try {
          blocks = await runAsyncTextractAnalysis(textractClient, location, features);
        } finally {
          // Clean up if we uploaded the object
          if (!args.fileUrl.startsWith('s3://') && location.bucket === config.textractBucket) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: location.bucket, Key: location.key }));
          }
        }
      } else {
        const command = new AnalyzeDocumentCommand({
          Document: {
            Bytes: documentBytes,
          },
          FeatureTypes: features as any,
        });
        const result = await textractClient.send(command);
        if (!result.Blocks) {
          throw new Error("No blocks returned from Textract");
        }
        blocks = result.Blocks;
      }

      // Extract text from blocks
      const textBlocks = blocks.filter(block => block.BlockType === 'LINE');
      const extractedText = textBlocks
        .map(block => block.Text)
        .filter(text => text)
        .join('\n');

      // Calculate average confidence
      const confidences = textBlocks
        .map(block => block.Confidence || 0)
        .filter(conf => conf > 0);
      
      const averageConfidence = confidences.length > 0 
        ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length 
        : 0;

      console.log(`[Textract] Extraction complete. Text length: ${extractedText.length}, Confidence: ${averageConfidence.toFixed(2)}%`);

      return {
        text: extractedText,
        confidence: averageConfidence,
        blocks,
      };

    } catch (error) {
      console.error("[Textract] Error during text extraction:", error);
      return {
        text: "",
        confidence: 0,
        blocks: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Extract text using simple DetectDocumentText (faster, less features)
 */
export const detectDocumentText = internalAction({
  args: {
    fileUrl: v.string(),
  },
  returns: v.object({
    text: v.string(),
    confidence: v.number(),
    blocks: v.array(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<TextractResult> => {
    try {
      console.log(`[Textract] Starting simple text detection for: ${args.fileUrl}`);
      
      // Get AWS clients (this will validate credentials and initialize if needed)
      const { textractClient, s3Client } = getAWSClients();
      
      let blocks: any[] = [];
      const config = validateAWSConfig();
      // Ensure PDFs go async
      let contentType: string | undefined;
      let documentBytes: Buffer | undefined;
      if (args.fileUrl.startsWith('s3://')) {
        const s3Url = new URL(args.fileUrl);
        const bucket = s3Url.hostname;
        const key = s3Url.pathname.substring(1);
        const getRes = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        contentType = getRes.ContentType;
        if (getRes.Body) {
          documentBytes = Buffer.from(await getRes.Body.transformToByteArray());
        }
      } else {
        const response = await fetch(args.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        contentType = response.headers.get("content-type") || undefined;
        documentBytes = Buffer.from(await response.arrayBuffer());
      }
      const looksLikePdf = (contentType?.toLowerCase().includes('pdf')) || (documentBytes ? bufferLooksLikePdf(documentBytes) : false);
      const useAsync = looksLikePdf;
      if (useAsync) {
        if (!config.textractBucket) {
          throw new Error("AWS_TEXTRACT_BUCKET is not configured for asynchronous Textract processing");
        }
        let location: { bucket: string; key: string };
        if (args.fileUrl.startsWith('s3://')) {
          const s3Url = new URL(args.fileUrl);
          location = { bucket: s3Url.hostname, key: s3Url.pathname.substring(1) };
        } else {
          location = await uploadToTextractBucketFromUrl(s3Client, args.fileUrl, config.textractBucket);
        }
        try {
          blocks = await runAsyncTextractDetection(textractClient, location);
        } finally {
          if (!args.fileUrl.startsWith('s3://') && location.bucket === config.textractBucket) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: location.bucket, Key: location.key }));
          }
        }
      } else {
        if (!documentBytes) throw new Error("Failed to load document bytes");
        const command = new DetectDocumentTextCommand({
          Document: {
            Bytes: documentBytes,
          },
        });
        const result = await textractClient.send(command);
        if (!result.Blocks) {
          throw new Error("No blocks returned from Textract");
        }
        blocks = result.Blocks;
      }

      const textBlocks = blocks.filter(block => block.BlockType === 'LINE');
      const extractedText = textBlocks
        .map(block => block.Text)
        .filter(text => text)
        .join('\n');

      const confidences = textBlocks
        .map(block => block.Confidence || 0)
        .filter(conf => conf > 0);
      
      const averageConfidence = confidences.length > 0 
        ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length 
        : 0;

      console.log(`[Textract] Simple detection complete. Text length: ${extractedText.length}, Confidence: ${averageConfidence.toFixed(2)}%`);

      return {
        text: extractedText,
        confidence: averageConfidence,
        blocks,
      };

    } catch (error) {
      console.error("[Textract] Error during simple text detection:", error);
      return {
        text: "",
        confidence: 0,
        blocks: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Get a signed URL for S3 operations
 */
export const getSignedS3Url = internalAction({
  args: {
    bucket: v.string(),
    key: v.string(),
    expiresIn: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const expiresIn = args.expiresIn || 3600;
    const { s3Client } = getAWSClients();
    const command = new GetObjectCommand({ Bucket: args.bucket, Key: args.key });
    return await getSignedUrl(s3Client, command, { expiresIn });
  },
});

/**
 * Test AWS credentials and connectivity
 */
export const testAWSCredentials = internalAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    region: v.optional(v.string()),
    envVars: v.object({
      awsRegion: v.boolean(),
      awsAccessKey: v.boolean(),
      awsSecretKey: v.boolean(),
      textractBucket: v.boolean(),
      convexDeployment: v.boolean(),
    }),
    s3WriteTest: v.optional(v.object({
      bucket: v.string(),
      ok: v.boolean(),
      message: v.string(),
    })),
  }),
  handler: async (_ctx, _args) => {
    try {
      console.log(`[AWS] Testing credentials and connectivity...`);
      
      // Check environment variables
      const envVars = {
        awsRegion: !!process.env.AWS_REGION,
        awsAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        awsSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        textractBucket: !!process.env.AWS_TEXTRACT_BUCKET,
        convexDeployment: !!process.env.CONVEX_DEPLOYMENT,
      };

      console.log(`[AWS] Environment variables status:`, envVars);

      // Get AWS clients (this will validate credentials and initialize if needed)
      const { textractClient, s3Client } = getAWSClients();
      const config = validateAWSConfig();

      // Try to make a simple API call to test credentials
      const command = new DetectDocumentTextCommand({
        Document: {
          Bytes: Buffer.from("test"), // Minimal test document
        },
      });

      // This will fail with InvalidParameterValue, but that means credentials are working
      try {
        await textractClient.send(command);
      } catch (error: any) {
        const name = error?.name || error?.Code || error?.__type;
        const isExpected = name === 'InvalidParameterValue' || name === 'ValidationException' || name === 'UnsupportedDocumentException';
        if (isExpected) {
          // This is expected - it means credentials are valid but document is invalid/unsupported
          console.log(`[AWS] Credentials test successful - got expected validation error (${name})`);
        } else {
          throw error;
        }
      }
      // Optional: test S3 write/delete to the configured bucket (small object)
      let s3WriteTest: { bucket: string; ok: boolean; message: string } | undefined = undefined;
      if (config.textractBucket) {
        const key = `healthchecks/textract-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
        try {
          await s3Client.send(new PutObjectCommand({ Bucket: config.textractBucket, Key: key, Body: "ok" }));
          await s3Client.send(new DeleteObjectCommand({ Bucket: config.textractBucket, Key: key }));
          s3WriteTest = { bucket: config.textractBucket, ok: true, message: "S3 write/delete succeeded" };
        } catch (e: any) {
          s3WriteTest = { bucket: config.textractBucket, ok: false, message: e?.message ?? "S3 test failed" };
        }
      }

      return {
        success: true,
        message: "AWS credentials are valid and working",
        region: AWS_CONFIG.region,
        envVars,
        s3WriteTest,
      };

    } catch (error) {
      console.error("[AWS] Credentials test failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        region: AWS_CONFIG.region,
        envVars: {
          awsRegion: !!process.env.AWS_REGION,
          awsAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          awsSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
          textractBucket: !!process.env.AWS_TEXTRACT_BUCKET,
          convexDeployment: !!process.env.CONVEX_DEPLOYMENT,
        },
      };
    }
  },
});

// Public action to trigger the credentials test from the client safely
export const testAWSCredentialsPublic = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    region: v.optional(v.string()),
    envVars: v.object({
      awsRegion: v.boolean(),
      awsAccessKey: v.boolean(),
      awsSecretKey: v.boolean(),
      textractBucket: v.boolean(),
      convexDeployment: v.boolean(),
    }),
    s3WriteTest: v.optional(v.object({
      bucket: v.string(),
      ok: v.boolean(),
      message: v.string(),
    })),
  }),
  handler: async (ctx): Promise<{
    success: boolean;
    message: string;
    region?: string;
    envVars: {
      awsRegion: boolean;
      awsAccessKey: boolean;
      awsSecretKey: boolean;
      textractBucket: boolean;
      convexDeployment: boolean;
    };
    s3WriteTest?: { bucket: string; ok: boolean; message: string };
  }> => {
    const res: {
      success: boolean;
      message: string;
      region?: string;
      envVars: {
        awsRegion: boolean;
        awsAccessKey: boolean;
        awsSecretKey: boolean;
        textractBucket: boolean;
        convexDeployment: boolean;
      };
      s3WriteTest?: { bucket: string; ok: boolean; message: string };
    } = await ctx.runAction(internal.awsTextract.testAWSCredentials, {});
    return res;
  },
});
