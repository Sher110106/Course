// AWS Configuration for Convex functions
export const AWS_CONFIG = {
  region: process.env.AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  textractBucket: process.env.AWS_TEXTRACT_BUCKET,
};

// Validate configuration
export function validateAWSConfig() {
  if (!AWS_CONFIG.accessKeyId) {
    throw new Error("AWS_ACCESS_KEY_ID environment variable is not set");
  }
  if (!AWS_CONFIG.secretAccessKey) {
    throw new Error("AWS_SECRET_ACCESS_KEY environment variable is not set");
  }
  
  // Validate credential format
  if (AWS_CONFIG.accessKeyId.length < 20 || AWS_CONFIG.accessKeyId.length > 40) {
    throw new Error("AWS_ACCESS_KEY_ID appears to be invalid (should be 20-40 characters)");
  }
  if (AWS_CONFIG.secretAccessKey.length < 40) {
    throw new Error("AWS_SECRET_ACCESS_KEY appears to be invalid (should be at least 40 characters)");
  }

  // Return validated config with non-null types
  return {
    region: AWS_CONFIG.region,
    accessKeyId: AWS_CONFIG.accessKeyId,
    secretAccessKey: AWS_CONFIG.secretAccessKey,
    textractBucket: AWS_CONFIG.textractBucket,
  };
}

// Debug function to log configuration status
export function logAWSConfigStatus() {
  console.log(`[AWS Config] Status:`, {
    region: AWS_CONFIG.region,
    accessKeyId: AWS_CONFIG.accessKeyId ? `${AWS_CONFIG.accessKeyId.substring(0, 5)}...` : 'NOT SET',
    secretAccessKey: AWS_CONFIG.secretAccessKey ? `${AWS_CONFIG.secretAccessKey.substring(0, 5)}...` : 'NOT SET',
    textractBucket: AWS_CONFIG.textractBucket || 'NOT SET',
    envSource: {
      awsRegion: !!process.env.AWS_REGION,
      awsAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      awsSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      awsTextractBucket: !!process.env.AWS_TEXTRACT_BUCKET,
    }
  });
}
