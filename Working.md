# Curriculum Gap Analysis Tool - Technical Documentation

## System Architecture

### Overview
The Curriculum Gap Analysis Tool is a full-stack web application built with React (frontend) and Convex (backend), featuring AI-powered semantic analysis for curriculum mapping. The system uses Azure OpenAI for embeddings and chat completions, with a sophisticated multi-layered matching algorithm.

### Technology Stack
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS
- **Backend:** Convex (serverless database and functions)
- **AI Services:** Azure OpenAI (GPT-4, text-embedding-3-large)
- **File Processing:** Tesseract.js (OCR), PDF.js (PDF parsing)
- **Authentication:** Convex Auth
- **File Storage:** Convex File Storage
- **Vector Search:** Convex Vector Search

## Core Components

### 1. Frontend Architecture

#### Application Structure
```
src/
├── App.tsx                 # Main application component
├── components/
│   ├── CurriculumAnalyzer.tsx    # Manual course entry interface
│   ├── PDFUploader.tsx          # PDF transcript processing
│   ├── AnalysisResults.tsx      # Results display component
│   ├── CourseInputForm.tsx      # Course input form
│   ├── SignInForm.tsx          # Authentication UI
│   └── SignOutButton.tsx       # Logout functionality
├── lib/
│   └── utils.ts               # Utility functions
└── main.tsx                  # Application entry point
```

#### Key Frontend Features
- **Tabbed Interface:** Seamless switching between manual entry and PDF upload
- **Real-time Updates:** Live data synchronization via Convex React hooks
- **Progress Indicators:** Visual feedback for long-running operations
- **Responsive Design:** Mobile-friendly interface with Tailwind CSS
- **Toast Notifications:** User feedback via Sonner toast library

### 2. Backend Architecture (Convex)

#### Database Schema
```typescript
// Core Tables
userCourses: {
  userId: Id<"users">,
  title: string,
  description: string,
  institution?: string,
  credits?: number
}

userTranscripts: {
  userId: Id<"users">,
  fileName: string,
  fileId: Id<"_storage">,
  extractedText?: string,
  parsedCourses?: Array<{
    title: string,
    description: string,
    credits?: number
  }>,
  processingStatus: "uploaded" | "processing" | "completed" | "failed",
  errorMessage?: string,
  uploadDate: number
}

plakshaCourses: {
  code: string,
  title: string,
  description: string,
  credits: number,
  isCoreRequirement: boolean,
  department: string,
  semester?: number,
  embedding?: number[]  // Vector embedding for similarity search
}

analysisResults: {
  userId: Id<"users">,
  transcriptId?: Id<"userTranscripts">,
  matchedCourses: Array<{
    userCourseId?: Id<"userCourses">,
    userCourseTitle: string,
    plakshaCourseCode: string,
    plakshaCourseTitle: string,
    similarity: number
  }>,
  gapCourses: Array<{
    code: string,
    title: string,
    department: string,
    semester: number
  }>,
  futureChallenges: Array<{
    code: string,
    title: string,
    department: string,
    semester: number,
    difficulty: string,
    reason: string
  }>,
  analysisDate: number,
  targetSemester: number,
  analysisType: "manual" | "transcript" | "transcript-manual" | "transcript-hybrid"
}
```

#### Database Indexes
- **Vector Index:** `plakshaCourses.by_embedding` for semantic similarity search
- **User Indexes:** Efficient querying by user ID
- **Status Indexes:** Filtering by processing status
- **Department/Semester Indexes:** Curriculum organization

## AI-Powered Analysis Engine

### 1. Semantic Matching Algorithm

#### Multi-Layer Approach
The system uses a sophisticated three-layer matching approach:

1. **Vector Embedding Search** (Primary)
   - Converts course descriptions to 3072-dimensional vectors
   - Uses Azure OpenAI's text-embedding-3-large model
   - Performs fast similarity search using Convex Vector Search
   - Threshold: 0.6+ similarity score

2. **TF-IDF Analysis** (Secondary)
   - Computes term frequency-inverse document frequency
   - Identifies key terms and their importance
   - Cosine similarity between TF-IDF vectors
   - Handles technical terminology matching

3. **Semantic AI Analysis** (Tertiary)
   - GPT-4 powered similarity assessment
   - Contextual understanding of course content
   - Evaluates learning objectives and outcomes
   - Provides detailed similarity scores (0-1 scale)

#### Hybrid Analysis Method
```typescript
// Weighted combination of all three methods
finalScore = 0.4 * vectorScore + 0.3 * tfidfScore + 0.3 * semanticScore
```

### 2. Course Processing Pipeline

#### Manual Entry Processing
1. **Input Validation:** Ensures course data completeness
2. **Embedding Generation:** Creates vector representations
3. **Similarity Calculation:** Compares against Plaksha curriculum
4. **Match Selection:** Identifies best matches above threshold
5. **Gap Analysis:** Identifies missing core requirements
6. **Future Prediction:** Assesses upcoming course difficulty

#### PDF Transcript Processing
1. **File Upload:** Secure file storage via Convex
2. **OCR Extraction:** Tesseract.js for text extraction
3. **Fallback Processing:** PDF.js for structured text
4. **Course Parsing:** AI-powered course identification
5. **Content Analysis:** Semantic understanding of course descriptions
6. **Batch Processing:** Efficient handling of multiple courses

### 3. Gap Analysis Logic

#### Core Requirement Identification
```typescript
// Get core requirements up to target semester
const coreRequirements = await getCoreRequirementsBySemester({
  maxSemester: targetSemester - 1
});

// Identify gaps
const gapCourses = coreRequirements.filter(course => 
  !matchedPlakshaCodes.has(course.code)
);
```

#### Future Course Difficulty Prediction
- **AI Assessment:** GPT-4 analyzes student background vs. course requirements
- **Difficulty Levels:** Easy, Moderate, Challenging, Very Challenging
- **Reasoning:** Detailed explanations for difficulty assessments
- **Prerequisites:** Considers prerequisite knowledge gaps

## PDF Processing System

### 1. OCR Pipeline

#### Tesseract.js Integration
```typescript
// Primary OCR processing
const { data: { text } } = await Tesseract.recognize(
  imageDataUrl, 
  "eng", 
  { logger: progressCallback }
);
```

#### Image Processing
1. **PDF Rendering:** Convert PDF pages to high-resolution images
2. **Scale Optimization:** 2x scaling for better OCR accuracy
3. **Canvas Processing:** Browser-based image manipulation
4. **Data URL Conversion:** Base64 encoding for OCR input

### 2. Fallback Mechanisms

#### PDF.js Text Extraction
- **Primary:** OCR for maximum accuracy
- **Fallback:** PDF.js for structured text extraction
- **Error Handling:** Graceful degradation on OCR failure
- **Quality Assessment:** Text validation and cleaning

### 3. Course Parsing Algorithm

#### Intelligent Course Detection
1. **Pattern Recognition:** Identifies course title patterns
2. **Credit Extraction:** Parses credit information
3. **Description Segmentation:** Separates course descriptions
4. **Quality Filtering:** Removes irrelevant text

## Performance Optimizations

### 1. Caching Strategy

#### Embedding Cache
```typescript
const embeddingCache = new Map<string, number[]>();
const similarityCache = new Map<string, number>();
const tfidfCache = new Map<string, Map<string, number>>();
```

#### Benefits
- **Reduced API Calls:** Minimizes Azure OpenAI requests
- **Faster Processing:** Cached embeddings for repeated courses
- **Cost Optimization:** Reduces API usage costs
- **Improved UX:** Faster analysis times

### 2. Batch Processing

#### Vector Search Optimization
- **Top-K Retrieval:** Limits vector search to top 10 candidates
- **Batch AI Calls:** Processes multiple comparisons simultaneously
- **Rate Limiting:** Prevents API throttling
- **Parallel Processing:** Concurrent embedding generation

### 3. Memory Management

#### Efficient Data Structures
- **Lazy Loading:** Load data only when needed
- **Pagination:** Handle large datasets efficiently
- **Garbage Collection:** Proper cleanup of temporary data
- **Memory Monitoring:** Track memory usage patterns

## Security Implementation

### 1. Authentication System

#### Convex Auth Integration
- **Password Authentication:** Secure user accounts
- **Anonymous Sessions:** Temporary guest access
- **Session Management:** Automatic token handling
- **User Isolation:** Data separation between users

### 2. Data Protection

#### File Upload Security
- **File Validation:** Type and size checking
- **Virus Scanning:** Malware detection (if configured)
- **Access Control:** User-specific file permissions
- **Secure Storage:** Encrypted file storage

### 3. API Security

#### Azure OpenAI Integration
- **API Key Management:** Secure credential storage
- **Request Validation:** Input sanitization
- **Rate Limiting:** Prevent abuse
- **Error Handling:** Secure error responses

## Error Handling and Resilience

### 1. Graceful Degradation

#### OCR Failure Handling
```typescript
// If OCR fails, fallback to PDF.js
if (!ocrText.trim()) {
  const fallbackText = await extractTextWithPDFjs(pdf);
  return fallbackText;
}
```

#### AI Service Failures
- **Retry Logic:** Automatic retry on transient failures
- **Fallback Methods:** Alternative processing paths
- **User Feedback:** Clear error messages
- **Partial Results:** Return available data when possible

### 2. Data Validation

#### Input Sanitization
- **Course Data:** Validate required fields
- **File Uploads:** Check file integrity
- **API Responses:** Validate AI service outputs
- **Database Operations:** Ensure data consistency

## Scalability Considerations

### 1. Database Optimization

#### Index Strategy
- **Vector Indexes:** Efficient similarity search
- **Composite Indexes:** Multi-field queries
- **Partial Indexes:** Filtered data access
- **Query Optimization:** Minimize database load

### 2. API Management

#### Azure OpenAI Optimization
- **Request Batching:** Group API calls
- **Caching Strategy:** Reduce redundant requests
- **Rate Limiting:** Respect API quotas
- **Cost Monitoring:** Track usage patterns

### 3. Performance Monitoring

#### Metrics Collection
- **Response Times:** Track analysis duration
- **Success Rates:** Monitor processing success
- **Error Rates:** Identify failure patterns
- **User Engagement:** Usage analytics

## Development Workflow

### 1. Local Development

#### Setup Process
```bash
# Install dependencies
npm install

# Start development servers
npm run dev  # Runs frontend and backend concurrently
```

#### Environment Configuration
```env
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-large
```

### 2. Testing Strategy

#### Unit Testing
- **Component Testing:** React component validation
- **Function Testing:** Convex function verification
- **AI Integration:** Mock API responses
- **Error Scenarios:** Failure case testing

#### Integration Testing
- **End-to-End:** Complete user workflows
- **API Integration:** Azure OpenAI connectivity
- **File Processing:** PDF upload and processing
- **Database Operations:** Data persistence testing

## Deployment Architecture

### 1. Convex Deployment

#### Production Environment
- **Database:** Convex cloud database
- **Functions:** Serverless function execution
- **File Storage:** Cloud file storage
- **Authentication:** Managed auth service

### 2. Frontend Deployment

#### Build Process
```bash
npm run build  # Creates optimized production build
```

#### Static Hosting
- **Vite Build:** Optimized bundle generation
- **CDN Distribution:** Global content delivery
- **HTTPS Enforcement:** Secure connections
- **Caching Strategy:** Browser and CDN caching

## Monitoring and Analytics

### 1. Performance Metrics

#### Key Performance Indicators
- **Analysis Time:** Average processing duration
- **Success Rate:** Percentage of successful analyses
- **User Engagement:** Session duration and interactions
- **Error Rates:** System failure frequency

### 2. User Analytics

#### Usage Patterns
- **Feature Usage:** Manual vs. PDF upload preference
- **Course Counts:** Average courses per analysis
- **Target Semesters:** Most common entry points
- **Analysis Methods:** Vector vs. Hybrid preference

## Future Enhancements

### 1. Planned Features

#### Advanced Analytics
- **Progress Tracking:** Longitudinal analysis over time
- **Comparative Analysis:** Compare multiple institutions
- **Predictive Modeling:** Course success prediction
- **Recommendation Engine:** Personalized course suggestions

#### Enhanced AI Capabilities
- **Multi-language Support:** International transcript processing
- **Advanced OCR:** Better handwriting recognition
- **Semantic Understanding:** Deeper course content analysis
- **Learning Path Optimization:** Optimal course sequencing

### 2. Technical Improvements

#### Performance Optimizations
- **Edge Computing:** Distributed processing
- **Advanced Caching:** Redis integration
- **Database Sharding:** Horizontal scaling
- **CDN Optimization:** Global performance

#### Security Enhancements
- **Advanced Encryption:** End-to-end encryption
- **Audit Logging:** Comprehensive activity tracking
- **Compliance Features:** GDPR/CCPA compliance
- **Penetration Testing:** Regular security assessments

## Conclusion

The Curriculum Gap Analysis Tool represents a sophisticated integration of modern web technologies, AI services, and educational data processing. The system's multi-layered approach to semantic matching, combined with robust error handling and performance optimizations, provides users with accurate and actionable curriculum analysis results.

The architecture's modular design allows for easy maintenance and future enhancements, while the comprehensive caching and optimization strategies ensure fast and reliable performance even under high load conditions.

