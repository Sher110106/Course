# AWS Setup for Amazon Textract

This project now uses Amazon Textract for superior OCR accuracy instead of local Tesseract processing.

## Required AWS Services

1. **Amazon Textract** - For OCR and text extraction from PDFs and images
2. **Amazon S3** - For file storage (optional, can also use local files)

## Setup Instructions

### 1. Create AWS Account
If you don't have an AWS account, create one at [aws.amazon.com](https://aws.amazon.com)

### 2. Create IAM User
1. Go to AWS IAM Console
2. Create a new user with programmatic access
3. Attach the following policies:
   - `AmazonTextractFullAccess`
   - `AmazonS3FullAccess` (if using S3)

### 3. Get Credentials
1. After creating the user, download the CSV file with:
   - Access Key ID
   - Secret Access Key

### 4. Configure Environment Variables (server-side only)
Set these environment variables on the server/runtime where Convex runs (do NOT expose in client build):

```bash
# Required
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# Required for PDFs (asynchronous processing)
AWS_TEXTRACT_BUCKET=your_s3_bucket_for_textract_async
```

Do not use VITE_* variables for AWS credentials. Keep secrets server-only.

### 5. Install Dependencies
The required AWS SDK packages are already installed:
- `@aws-sdk/client-textract`
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`

## Features

### Simple Text Detection
- Fast processing with basic OCR capabilities
- Good for simple documents with clear text

### Advanced Features
- **TABLES**: Extracts tabular data with structure preservation
- **FORMS**: Identifies key-value pairs and form fields
- Better accuracy but slower processing

## Usage

1. Go to the "🧪 Testing with Amazon Textract" tab
2. Click "Test AWS" to verify credentials and S3 bucket access
3. Choose between simple or advanced features
4. Upload your transcript and course of study PDFs
5. The system will process them using Amazon Textract (PDFs are processed asynchronously)
6. View confidence scores and processing metrics

## Benefits Over Local Tesseract

- **Higher Accuracy**: 95%+ vs 85% for complex documents
- **Better Table Handling**: Preserves table structure
- **Form Recognition**: Identifies key-value pairs
- **Scalability**: No local processing limitations
- **Consistency**: Same results across different environments

## Cost Considerations

- **Simple Text Detection**: ~$0.0015 per page
- **Advanced Features**: ~$0.005 per page
- **Typical Transcript**: 2-5 pages = $0.003-$0.025 per analysis

## Security Notes

- Never commit your env files to version control
- Prefer IAM roles or secure secret stores (e.g., AWS Secrets Manager) in production
- Use least-privilege IAM policies. Required permissions:
  - Textract: AnalyzeDocument, DetectDocumentText, StartDocumentAnalysis, GetDocumentAnalysis, StartDocumentTextDetection, GetDocumentTextDetection
  - S3 (your AWS_TEXTRACT_BUCKET): PutObject, GetObject, DeleteObject

