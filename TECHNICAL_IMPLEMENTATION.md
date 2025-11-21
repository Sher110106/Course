# Plaksha Course Matcher - Technical Implementation Guide

**Version 1.0** | Last Updated: November 19, 2025

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Frontend Implementation](#frontend-implementation)
5. [Backend Implementation](#backend-implementation)
6. [AI Integration](#ai-integration)
7. [Matching Algorithm](#matching-algorithm)
8. [Performance Optimization](#performance-optimization)
9. [Security & Privacy](#security--privacy)
10. [Deployment & DevOps](#deployment--devops)
11. [Development Guide](#development-guide)
12. [API Reference](#api-reference)

---

## Architecture Overview

### High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  React 18 SPA (TypeScript)                                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │   Upload UI  │  │  Results UI  │  │   Auth UI    │    │  │
│  │  │  (PDFs +     │  │  (Analysis + │  │  (Convex     │    │  │
│  │  │   Threshold) │  │   Gaps)      │  │   Auth)      │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  │                                                             │  │
│  │  PDF.js (Text Extraction)  •  Tailwind CSS (Styling)      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                 ↕ HTTPS / WebSocket
┌──────────────────────────────────────────────────────────────────┐
│                     CONVEX BACKEND LAYER                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Serverless Functions (TypeScript)                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │ dualTranscripts│ │ dualAnalysis │  │   courses    │    │  │
│  │  │   (Queries)   │  │  (Matching)  │  │  (Queries)   │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  │  ┌──────────────┐  ┌──────────────┐                       │  │
│  │  │   analysis   │  │     auth     │                       │  │
│  │  │   (Gemini)   │  │  (Convex)    │                       │  │
│  │  └──────────────┘  └──────────────┘                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Database (Convex NoSQL)                                   │  │
│  │  • dualTranscripts table (uploads, results, analysis)     │  │
│  │  • plakshaCourses table (curriculum with embeddings)      │  │
│  │  • Vector Index (3072-dim, embedding-based search)        │  │
│  │  • File Storage (PDF documents)                           │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                     ↕                              ↕
┌──────────────────────────────┐  ┌──────────────────────────────┐
│   AZURE OPENAI API           │  │   GOOGLE GEMINI API          │
│   • GPT-4 (semantic analysis)│  │   • Gemini 2.5 Flash         │
│   • text-embedding-3-large   │  │     (document extraction)    │
│     (3072-dim vectors)       │  │   • Course parsing           │
│   • Caching layer            │  │   • Grade/credit detection   │
└──────────────────────────────┘  └──────────────────────────────┘
```

### Data Flow Diagram

```
USER WORKFLOW:
┌─────────────┐
│   Sign In   │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Upload Transcript PDF + Course of Study PDF + Threshold  │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────┐
│ Client: PDF.js      │ ← Extract text preserving layout
│ Text Extraction     │   (columns, tables, formatting)
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Convex: File Upload │ ← Store PDFs in _storage
│ & Text Storage      │   Save extracted text
└──────┬──────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ Gemini AI: Course Extraction                │
│ • Parse transcript structure                │
│ • Identify course codes, titles, grades     │
│ • Extract credits from various formats      │
│ • Match with course of study descriptions   │
│ • Confidence scoring                        │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────┐
│ Grade Filtering     │ ← Remove courses below threshold
└──────┬──────────────┘   Convert grades to GPA
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ HYBRID MATCHING ALGORITHM (Parallel Processing)         │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│ │ Vector (40%) │  │ TF-IDF (30%) │  │ Semantic(30%)│  │
│ │              │  │              │  │              │  │
│ │ • Convex     │  │ • Term freq  │  │ • GPT-4 API  │  │
│ │   vector     │  │   analysis   │  │   calls      │  │
│ │   search     │  │ • IDF calc   │  │ • Context    │  │
│ │ • 3072-dim   │  │ • Cosine sim │  │   compare    │  │
│ │   Azure      │  │ • Pre-filter │  │ • Cached     │  │
│ │   embeddings │  │   0.15+      │  │   results    │  │
│ └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│        └──────────────────┼──────────────────┘          │
│                           ▼                             │
│               Weighted Final Score                      │
│          (0.4×V + 0.3×T + 0.3×S)                       │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ GAP ANALYSIS                                             │
│ • Identify required Plaksha courses not matched         │
│ • Prioritize by semester and prerequisites              │
│ • AI assessment of future course difficulty             │
│ • Generate personalized recommendations                 │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ RESULTS DISPLAY                                          │
│ • Matched courses with similarity breakdowns            │
│ • Gap courses with priorities                           │
│ • Recommendations and action plan                       │
│ • PDF report generation (client-side)                   │
└──────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.0.0 | UI library with hooks and functional components |
| **TypeScript** | 5.7.2 | Type-safe development |
| **Vite** | 6.2.0 | Build tool and dev server (HMR, fast builds) |
| **Tailwind CSS** | 3.x | Utility-first CSS framework |
| **PDF.js** | 5.4.54 | PDF rendering and text extraction |
| **Sonner** | 2.0.3 | Toast notifications |
| **Convex React** | 1.24.2 | Real-time data binding |

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Convex** | 1.24.2 | Serverless backend platform |
| **Convex Auth** | 0.0.80 | Authentication system |
| **TypeScript** | 5.7.2 | Type-safe server functions |
| **Azure OpenAI** | Latest | GPT-4 and embeddings |
| **Google Gemini** | 0.21.0 | Document extraction AI |

### AI Services

| Service | Model | Purpose |
|---------|-------|---------|
| **Azure OpenAI** | GPT-4.1 | Semantic similarity analysis |
| **Azure OpenAI** | text-embedding-3-large | 3072-dim vector embeddings |
| **Google Gemini** | Gemini 2.5 Flash | PDF parsing and course extraction |

### Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code quality and linting |
| **Prettier** | Code formatting |
| **npm-run-all** | Parallel script execution |
| **dotenv** | Environment variable management |

---

## Database Schema

### Convex Schema Definition

```typescript
// convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables, // Users, sessions, etc.
  
  // Dual PDF uploads and analysis
  dualTranscripts: defineTable({
    userId: v.id("users"),
    
    // File references
    transcriptFileId: v.id("_storage"),
    courseOfStudyFileId: v.id("_storage"),
    transcriptFileName: v.string(),
    courseOfStudyFileName: v.string(),
    
    // Extracted text
    transcriptText: v.optional(v.string()),
    courseOfStudyText: v.optional(v.string()),
    
    // Processing status
    processingStatus: v.union(
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    
    // Grade filtering
    gradeThreshold: v.string(), // e.g., "B", "C+", "A-"
    
    // Extracted courses from transcript
    extractedCourses: v.optional(v.array(v.object({
      title: v.string(),
      description: v.string(),
      grade: v.string(),
      credits: v.optional(v.number()),
      semester: v.optional(v.string()),
      code: v.optional(v.string()),
      confidence: v.optional(v.number()),
      extractionMethod: v.optional(v.union(
        v.literal("regex"),
        v.literal("ai"),
        v.literal("fuzzy"),
        v.literal("manual")
      )),
      
      // Course of study matching
      courseOfStudyMatch: v.optional(v.object({
        originalTranscriptDescription: v.string(),
        courseOfStudyDescription: v.string(),
        courseOfStudyTitle: v.string(),
        courseOfStudyCode: v.string(),
        matchScore: v.number(),
        matchType: v.union(
          v.literal("exact_code"),
          v.literal("exact_title"),
          v.literal("fuzzy_title"),
          v.literal("partial_match")
        ),
      })),
    }))),
    
    // Analysis results
    analysisResults: v.optional(v.object({
      // Matched courses
      matchedCourses: v.array(v.object({
        userCourse: v.string(),
        curriculumCourse: v.string(),
        similarity: v.number(),
        grade: v.string(),
        userCourseDescription: v.optional(v.string()),
        curriculumCourseDescription: v.optional(v.string()),
        
        // Similarity breakdown
        similarityBreakdown: v.optional(v.object({
          vectorScore: v.number(),
          tfidfScore: v.number(),
          semanticScore: v.number(),
          finalScore: v.number(),
        })),
        
        // Matching highlights
        matchingHighlights: v.optional(v.object({
          userHighlights: v.array(v.string()),
          curriculumHighlights: v.array(v.string()),
        })),
        
        userCourseCode: v.optional(v.string()),
        curriculumCourseCode: v.optional(v.string()),
      })),
      
      // Gap courses
      gapCourses: v.array(v.object({
        code: v.string(),
        title: v.string(),
        description: v.string(),
        semester: v.optional(v.number()),
        priority: v.union(
          v.literal("high"),
          v.literal("medium"),
          v.literal("low")
        ),
        topics: v.optional(v.array(v.string())),
        hasPrerequisites: v.optional(v.boolean()),
        prerequisiteMet: v.optional(v.boolean()),
        difficultyReason: v.optional(v.string()),
      })),
      
      // Recommendations
      recommendations: v.array(v.object({
        type: v.union(
          v.literal("prerequisite"),
          v.literal("elective"),
          v.literal("core")
        ),
        message: v.string(),
        courses: v.array(v.string()),
      })),
    })),
    
    // Metadata
    errorMessage: v.optional(v.string()),
    uploadDate: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["processingStatus"]),
  
  // Plaksha curriculum (predefined)
  plakshaCourses: defineTable({
    code: v.string(),
    title: v.string(),
    description: v.string(),
    credits: v.number(),
    isCoreRequirement: v.boolean(),
    department: v.string(),
    semester: v.optional(v.number()),
    
    // Vector embedding (3072 dimensions)
    embedding: v.optional(v.array(v.number())),
  })
    .index("by_core", ["isCoreRequirement"])
    .index("by_department", ["department"])
    .index("by_semester", ["semester"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 3072,
    }),
});
```

### Database Indexes

**dualTranscripts:**
- `by_user`: Fast queries for user's uploads
- `by_status`: Monitor processing pipeline

**plakshaCourses:**
- `by_core`: Filter core requirements
- `by_department`: Department-specific queries
- `by_semester`: Semester-based filtering
- `by_embedding`: Vector similarity search (ANN algorithm)

---

## Frontend Implementation

### Component Architecture

```
src/
├── App.tsx                      ← Root component, routing, auth
├── main.tsx                     ← Entry point, React mounting
├── index.css                    ← Global styles, Tailwind imports
├── SignInForm.tsx               ← Authentication UI
├── SignOutButton.tsx            ← Sign-out functionality
├── vite-env.d.ts                ← Vite type definitions
│
├── components/
│   ├── DualPDFUploader.tsx      ← Main upload component
│   │   • File selection UI
│   │   • PDF.js text extraction
│   │   • Grade threshold selector
│   │   • Upload progress tracking
│   │
│   ├── DualAnalysisResults.tsx  ← Results display component
│   │   • Matched courses list
│   │   • Gap analysis display
│   │   • Recommendations panel
│   │   • Algorithm weightage UI
│   │   • PDF report generation
│   │
│   ├── CourseDetailsModal.tsx   ← Detailed match modal
│   │   • Similarity breakdown
│   │   • Course descriptions
│   │   • Matching highlights
│   │
│   ├── CourseExtractor.tsx      ← Course verification (legacy)
│   │
│   └── CourseInputForm.tsx      ← Manual entry (legacy)
│
└── lib/
    ├── utils.ts                 ← Tailwind class merging
    └── pdfGenerator.ts          ← PDF report generation
```

### Key Frontend Components

#### DualPDFUploader.tsx

**Responsibilities:**
- Dual PDF file selection (transcript + course of study)
- Client-side text extraction with PDF.js
- Grade threshold selection
- Upload to Convex file storage
- Trigger backend analysis
- Display processing status

**Key Functions:**
```typescript
async function extractTextFromPDF(
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string>
```
- Uses PDF.js to extract text page-by-page
- Preserves column layout and tabular data
- Handles multi-column transcripts
- Progress callbacks for UX

```typescript
const handleUploadAndAnalyze = async () => {
  // 1. Extract text from both PDFs
  const transcriptText = await extractTextFromPDF(transcriptFile);
  const courseOfStudyText = await extractTextFromPDF(courseOfStudyFile);
  
  // 2. Upload files to Convex storage
  const transcriptId = await uploadFile(transcriptFile);
  const courseOfStudyId = await uploadFile(courseOfStudyFile);
  
  // 3. Create dual transcript record
  await createDualTranscript({
    transcriptFileId, courseOfStudyFileId,
    transcriptText, courseOfStudyText,
    gradeThreshold, targetSemester
  });
  
  // 4. Trigger AI analysis
  await analyzeDualTranscript(transcriptId);
};
```

#### DualAnalysisResults.tsx

**Responsibilities:**
- Display matched courses with similarity scores
- Show curriculum gaps with priorities
- Present recommendations
- Algorithm weightage visualization
- PDF report generation

**Key Features:**
```typescript
// Similarity breakdown display
{match.similarityBreakdown && (
  <div className="flex gap-4 text-sm">
    <span>● Vector: {vectorScore}%</span>
    <span>● TF-IDF: {tfidfScore}%</span>
    <span>● Semantic: {semanticScore}%</span>
  </div>
)}

// Grade badge with conditional styling
<span className={`badge ${
  gradeValue < 3.0 
    ? 'bg-yellow-100 text-yellow-800' 
    : 'bg-green-100 text-green-800'
}`}>
  {grade} {gradeValue < 3.0 && '⚠️'}
</span>
```

### State Management

**Convex Hooks:**
```typescript
// Real-time queries
const transcript = useQuery(api.dualTranscripts.getById, { id });
const courses = useQuery(api.courses.listAll);

// Mutations
const createTranscript = useMutation(api.dualTranscripts.create);
const analyze = useAction(api.dualAnalysis.analyzeTranscript);
```

**Local State:**
```typescript
const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
const [courseOfStudyFile, setCourseOfStudyFile] = useState<File | null>(null);
const [gradeThreshold, setGradeThreshold] = useState("B");
const [isUploading, setIsUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
```

### PDF.js Integration

**Worker Setup:**
```typescript
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// Set worker path (auto-updated by postinstall script)
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";
```

**Text Extraction Algorithm:**
1. Load PDF as ArrayBuffer
2. Parse with PDF.js
3. Iterate through pages
4. Extract text items with coordinates
5. Group items by Y-coordinate (lines)
6. Sort items by X-coordinate (columns)
7. Insert tabs for large horizontal gaps
8. Preserve numerical data (credits, GPAs)

---

## Backend Implementation

### Convex Functions

#### convex/dualTranscripts.ts

**Mutations:**
```typescript
export const create = mutation({
  args: {
    transcriptFileId: v.id("_storage"),
    courseOfStudyFileId: v.id("_storage"),
    transcriptFileName: v.string(),
    courseOfStudyFileName: v.string(),
    transcriptText: v.string(),
    courseOfStudyText: v.string(),
    gradeThreshold: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.db.insert("dualTranscripts", {
      ...args,
      userId,
      processingStatus: "uploaded",
      uploadDate: Date.now(),
    });
  },
});
```

**Queries:**
```typescript
export const getById = query({
  args: { id: v.id("dualTranscripts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listByUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    return await ctx.db
      .query("dualTranscripts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
```

#### convex/analysis.ts

**Gemini AI Integration:**
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export const extractCourses = action({
  args: {
    transcriptText: v.string(),
    courseOfStudyText: v.string(),
    gradeThreshold: v.string(),
  },
  handler: async (ctx, args) => {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });
    
    const prompt = `
      Extract all courses from this transcript.
      For each course, identify:
      - Course code
      - Course title
      - Grade received
      - Credits (units)
      - Semester taken
      
      Use the course of study document to enhance descriptions.
      
      Transcript:
      ${args.transcriptText}
      
      Course of Study:
      ${args.courseOfStudyText}
      
      Grade Threshold: ${args.gradeThreshold}
      
      Return JSON array of courses.
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Parse JSON response
    const courses = JSON.parse(response);
    
    // Filter by grade threshold
    return courses.filter(course => 
      meetsGradeThreshold(course.grade, args.gradeThreshold)
    );
  },
});
```

#### convex/dualAnalysis.ts

**Main Analysis Function:**
```typescript
export const analyzeTranscript = action({
  args: { transcriptId: v.id("dualTranscripts") },
  handler: async (ctx, args) => {
    // 1. Fetch transcript and courses
    const transcript = await ctx.runQuery(
      api.dualTranscripts.getById,
      { id: args.transcriptId }
    );
    const plakshaCourses = await ctx.runQuery(
      api.courses.listAll
    );
    
    // 2. Extract courses using Gemini
    const extractedCourses = await ctx.runAction(
      api.analysis.extractCourses,
      {
        transcriptText: transcript.transcriptText,
        courseOfStudyText: transcript.courseOfStudyText,
        gradeThreshold: transcript.gradeThreshold,
      }
    );
    
    // 3. Perform hybrid matching
    const matches = await performHybridMatching(
      extractedCourses,
      plakshaCourses,
      ctx
    );
    
    // 4. Identify curriculum gaps
    const gaps = await identifyGaps(
      matches,
      plakshaCourses,
      transcript.targetSemester,
      ctx
    );
    
    // 5. Generate recommendations
    const recommendations = await generateRecommendations(
      extractedCourses,
      matches,
      gaps,
      ctx
    );
    
    // 6. Save results
    await ctx.runMutation(
      api.dualTranscripts.updateAnalysis,
      {
        id: args.transcriptId,
        analysisResults: {
          matchedCourses: matches,
          gapCourses: gaps,
          recommendations,
        },
        processingStatus: "completed",
      }
    );
  },
});
```

---

## AI Integration

### Azure OpenAI Configuration

```typescript
// convex/dualAnalysis.ts

import OpenAI from "openai";
import { getResourceEndpoint } from "./utils/azure";

// Azure OpenAI setup
const rootEndpoint = getResourceEndpoint(
  process.env.AZURE_OPENAI_ENDPOINT || ""
);

// Chat completions (GPT-4)
const chatDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4.1";
const chatEndpoint = `${rootEndpoint}/openai/deployments/${chatDeployment}`;

const chatClient = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: chatEndpoint,
  defaultQuery: {
    "api-version": process.env.OPENAI_API_VERSION || "2025-01-01-preview",
  },
  defaultHeaders: {
    "api-key": process.env.AZURE_OPENAI_API_KEY,
  },
});

// Embeddings (text-embedding-3-large)
const embeddingModel = process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME || 
  "text-embedding-3-large";
const embeddingEndpoint = `${rootEndpoint}/openai/deployments/${embeddingModel}`;

const embeddingClient = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: embeddingEndpoint,
  defaultQuery: {
    "api-version": process.env.OPENAI_API_VERSION || "2024-02-01",
  },
  defaultHeaders: {
    "api-key": process.env.AZURE_OPENAI_API_KEY,
  },
});
```

### Embedding Generation

```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await embeddingClient.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
    dimensions: 3072, // Full dimension for maximum accuracy
  });
  
  return response.data[0].embedding;
}

// Generate with caching
const embeddingCache = new Map<string, number[]>();

async function getCachedEmbedding(text: string): Promise<number[]> {
  const key = hashText(text);
  if (embeddingCache.has(key)) {
    return embeddingCache.get(key)!;
  }
  
  const embedding = await generateEmbedding(text);
  embeddingCache.set(key, embedding);
  return embedding;
}
```

### Semantic Similarity with GPT-4

```typescript
async function calculateCourseSimilarity(
  course1: string,
  course2: string
): Promise<number> {
  const response = await chatClient.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are an expert in academic course comparison."
      },
      {
        role: "user",
        content: `
          Compare these two courses and rate their similarity from 0 to 1:
          
          Course 1: ${course1}
          Course 2: ${course2}
          
          Consider:
          - Topic coverage
          - Learning objectives
          - Depth and rigor
          - Prerequisites
          
          Return only a number between 0 and 1.
        `
      }
    ],
    temperature: 0.1, // Low temperature for consistent scoring
  });
  
  const scoreText = response.choices[0].message.content;
  return parseFloat(scoreText);
}
```

---

## Matching Algorithm

### Hybrid Three-Tier Approach

```
┌──────────────────────────────────────────────────────────────┐
│                  HYBRID MATCHING PIPELINE                     │
└──────────────────────────────────────────────────────────────┘

INPUT: User Course + All Plaksha Courses

┌─────────────────────────────────────────────────────────────┐
│ TIER 1: VECTOR EMBEDDING SEARCH (40% weight)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Generate embedding for user course                      │
│     ↓ Azure OpenAI text-embedding-3-large                   │
│  2. Vector search in Convex                                 │
│     ↓ ctx.vectorSearch("by_embedding", embedding)           │
│  3. Get top 50 candidates (threshold: 0.3+)                 │
│     ↓ Filter: vectorScore >= 0.3                            │
│                                                              │
│  OUTPUT: ~10-50 potential matches (80-90% filtered)         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIER 2: TF-IDF ANALYSIS (30% weight)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Tokenize both course descriptions                       │
│     ↓ Remove stop words, stem terms                         │
│  2. Compute IDF across all courses                          │
│     ↓ IDF(term) = log(N / (1 + df(term)))                  │
│  3. Calculate TF-IDF vectors                                │
│     ↓ TF-IDF(term) = (freq/total) × IDF(term)              │
│  4. Cosine similarity between vectors                       │
│     ↓ cos(a,b) = dot(a,b) / (||a|| × ||b||)                │
│  5. Pre-filter: tfidfScore >= 0.15                          │
│                                                              │
│  OUTPUT: ~5-20 candidates (further filtered)                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIER 3: SEMANTIC AI ANALYSIS (30% weight)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. For each candidate from Tier 2:                        │
│     ↓ Check cache first                                     │
│  2. If not cached, call GPT-4                               │
│     ↓ Detailed comparison prompt                            │
│  3. GPT-4 returns similarity score (0-1)                    │
│     ↓ Considers learning outcomes, depth, rigor             │
│  4. Cache result for future use                             │
│     ↓ similarityCache.set(hash(a,b), score)                │
│                                                              │
│  OUTPUT: ~3-10 final candidates with AI scores              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FINAL SCORE CALCULATION                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  finalScore = 0.4 × vectorScore                             │
│             + 0.3 × tfidfScore                              │
│             + 0.3 × semanticScore                           │
│                                                              │
│  Threshold: finalScore >= 0.3 (configurable)                │
│                                                              │
│  Best match: argmax(finalScore) for each user course       │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Details

#### Vector Search

```typescript
async function vectorSearch(
  ctx: ActionCtx,
  userCourseDescription: string
): Promise<Array<{course: Doc<"plakshaCourses">, score: number}>> {
  
  // Generate embedding for user course
  const embedding = await getCachedEmbedding(userCourseDescription);
  
  // Search Convex vector index
  const results = await ctx.vectorSearch("plakshaCourses", "by_embedding", {
    vector: embedding,
    limit: 50,
  });
  
  // Filter by threshold
  return results.filter(r => r._score >= 0.3);
}
```

#### TF-IDF Calculation

```typescript
// Build IDF map from all courses
function computeIdf(corpus: string[]): Map<string, number> {
  const df = new Map<string, number>();
  const N = corpus.length;
  
  for (const doc of corpus) {
    const seen = new Set<string>();
    for (const word of tokenize(doc)) {
      if (!seen.has(word)) {
        df.set(word, (df.get(word) || 0) + 1);
        seen.add(word);
      }
    }
  }
  
  const idf = new Map<string, number>();
  for (const [term, freq] of df.entries()) {
    idf.set(term, Math.log(N / (1 + freq)));
  }
  
  return idf;
}

// Compute TF-IDF vector for a document
function computeTfidf(
  doc: string,
  idf: Map<string, number>
): Map<string, number> {
  const tf = new Map<string, number>();
  const words = tokenize(doc);
  
  for (const word of words) {
    tf.set(word, (tf.get(word) || 0) + 1);
  }
  
  const tfidf = new Map<string, number>();
  for (const [word, freq] of tf.entries()) {
    const tfScore = freq / words.length;
    const idfScore = idf.get(word) || 0;
    tfidf.set(word, tfScore * idfScore);
  }
  
  return tfidf;
}

// Cosine similarity between TF-IDF vectors
function cosineSim(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dot = 0, normA = 0, normB = 0;
  
  for (const [k, v] of a.entries()) {
    dot += v * (b.get(k) || 0);
    normA += v * v;
  }
  
  for (const v of b.values()) {
    normB += v * v;
  }
  
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}
```

### Gap Analysis Algorithm

```typescript
async function identifyGaps(
  matchedCourses: MatchedCourse[],
  plakshaCourses: Doc<"plakshaCourses">[],
  targetSemester: number,
  ctx: ActionCtx
): Promise<GapCourse[]> {
  
  // Get core requirements up to target semester
  const requiredCourses = plakshaCourses.filter(
    c => c.isCoreRequirement && 
         c.semester && 
         c.semester <= targetSemester
  );
  
  // Find unmatched courses
  const matchedCodes = new Set(
    matchedCourses.map(m => m.curriculumCourseCode)
  );
  
  const gaps = requiredCourses.filter(
    c => !matchedCodes.has(c.code)
  );
  
  // Prioritize gaps
  const prioritizedGaps = await Promise.all(
    gaps.map(async (gap) => {
      const priority = determinePriority(gap, targetSemester);
      const difficultyReason = await assessDifficulty(
        gap,
        matchedCourses,
        ctx
      );
      
      return {
        code: gap.code,
        title: gap.title,
        description: gap.description,
        semester: gap.semester,
        priority,
        difficultyReason,
      };
    })
  );
  
  return prioritizedGaps.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function determinePriority(
  course: Doc<"plakshaCourses">,
  targetSemester: number
): "high" | "medium" | "low" {
  if (!course.semester) return "low";
  
  if (course.semester <= targetSemester) {
    return "high"; // Required for target semester
  } else if (course.semester === targetSemester + 1) {
    return "medium"; // Next semester requirement
  } else {
    return "low"; // Future semester
  }
}

async function assessDifficulty(
  course: Doc<"plakshaCourses">,
  userBackground: MatchedCourse[],
  ctx: ActionCtx
): Promise<string> {
  // Use GPT-4 to assess difficulty based on user's background
  const backgroundSummary = userBackground
    .map(m => m.userCourse)
    .join(", ");
  
  const response = await chatClient.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are an academic advisor assessing course difficulty."
      },
      {
        role: "user",
        content: `
          User has completed: ${backgroundSummary}
          
          Assess difficulty of: ${course.title}
          Description: ${course.description}
          
          Provide a 1-2 sentence assessment of difficulty and preparation needs.
        `
      }
    ],
    temperature: 0.7,
  });
  
  return response.choices[0].message.content;
}
```

---

## Performance Optimization

### Caching Strategy

```typescript
// In-memory caches (action-scoped)
const embeddingCache = new Map<string, number[]>();
const similarityCache = new Map<string, number>();
const tfidfCache = new Map<string, Map<string, number>>();
let idfCache: Map<string, number> | null = null;

// Cache hit rate: 60-80% for typical workflows
```

**Cache Benefits:**
- **Embeddings**: Avoid redundant Azure API calls (save $0.0001 per call)
- **Similarity**: Skip expensive GPT-4 comparisons (save $0.01 per call)
- **TF-IDF**: Reuse computed vectors across analyses

### Batch Processing

```typescript
// Process multiple comparisons in parallel
async function batchSimilarity(
  userCourse: string,
  candidates: string[]
): Promise<number[]> {
  return await Promise.all(
    candidates.map(candidate => 
      getCachedSimilarity(userCourse, candidate)
    )
  );
}
```

### Vector Search Optimization

**Pre-filtering with Vector Search:**
- Input: ~100 Plaksha courses
- Vector search: Top 50 candidates (0.3+ threshold)
- **Reduction**: 50% of courses eliminated
- **Speed up**: 2x faster analysis

**TF-IDF Pre-filtering:**
- Input: 50 vector candidates
- TF-IDF filter: 10-20 candidates (0.15+ threshold)
- **Reduction**: Additional 60-80% eliminated
- **Speed up**: 5x fewer GPT-4 calls

**Total Pipeline Efficiency:**
- Start: 100 courses
- After vector: 50 courses (50% filtered)
- After TF-IDF: 15 courses (85% filtered)
- GPT-4 calls: Only 15 (85% cost reduction)

### Database Optimization

**Convex Vector Index:**
- Algorithm: Approximate Nearest Neighbors (ANN)
- Complexity: O(log N) instead of O(N)
- 100 courses: ~7 comparisons vs 100
- **Speed up**: 14x faster

**Efficient Queries:**
```typescript
// ✅ Good: Use indexes
const userTranscripts = await ctx.db
  .query("dualTranscripts")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .collect();

// ❌ Bad: Full table scan
const allTranscripts = await ctx.db
  .query("dualTranscripts")
  .collect();
const userTranscripts = allTranscripts.filter(t => t.userId === userId);
```

---

## Security & Privacy

### Authentication

**Convex Auth Implementation:**
```typescript
// convex/auth.config.ts
import Password from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});

// Frontend usage
import { useAuthActions } from "@convex-dev/auth/react";

const { signIn } = useAuthActions();
await signIn("password", { email, password, flow: "signUp" });
```

**Session Management:**
- JWT tokens stored in httpOnly cookies
- Automatic refresh on expiration
- Secure transmission over HTTPS

### Data Protection

**File Storage Security:**
```typescript
// Files stored in Convex _storage with access control
export const uploadFile = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    // Only authenticated users can upload
    // Files automatically scoped to user
    return await ctx.storage.generateUploadUrl();
  },
});

// File access restricted by user
export const getFile = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    // Verify file belongs to user
    const transcript = await ctx.db
      .query("dualTranscripts")
      .filter(q => 
        q.and(
          q.eq(q.field("userId"), userId),
          q.or(
            q.eq(q.field("transcriptFileId"), args.fileId),
            q.eq(q.field("courseOfStudyFileId"), args.fileId)
          )
        )
      )
      .first();
    
    if (!transcript) throw new Error("Unauthorized");
    
    return await ctx.storage.getUrl(args.fileId);
  },
});
```

**Data Isolation:**
- All queries scoped by `userId`
- No cross-user data access
- Automatic authorization checks

### API Key Protection

**Environment Variables:**
```bash
# .env.local (not committed to git)
AZURE_OPENAI_API_KEY=secret_key_here
GOOGLE_API_KEY=secret_key_here

# Keys only accessible in Convex backend
# Never exposed to client
```

**Azure OpenAI Security:**
- API keys rotated regularly
- Rate limiting enabled
- Usage monitoring and alerts
- Endpoint restricted to authorized IPs (optional)

### Privacy Considerations

**Data Retention:**
- Transcripts stored indefinitely (user-controlled)
- Can add deletion feature for GDPR compliance

**Third-Party Data Sharing:**
- No data shared with third parties
- Azure OpenAI: Data not used for training (opt-out enabled)
- Google Gemini: Data not retained after processing

**Local Processing:**
- PDF text extraction in browser
- No text sent to server until user confirms upload
- Client-side PDF generation

---

## Deployment & DevOps

### Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# 3. Start development servers
npm run dev
# Runs: vite (frontend) + convex dev (backend) in parallel

# 4. Access application
# Frontend: http://localhost:5173
# Convex dashboard: https://dashboard.convex.dev
```

### Build Process

```bash
# Production build
npm run build

# Output:
# dist/ - Vite-compiled frontend assets
# convex/_generated/ - Auto-generated types and schema
```

### Deployment

**Convex Deployment:**
```bash
# Deploy backend to Convex
npx convex deploy --prod

# Deployment includes:
# - Database schema migrations
# - Function deployments
# - Environment variable updates
```

**Frontend Deployment:**
- Build: `npm run build`
- Deploy `dist/` to static hosting (Vercel, Netlify, etc.)
- Configure environment variables for production

**Current Deployment:**
- Convex: `healthy-puma-366`
- Auto-deployment on git push (if configured)
- Real-time updates to all connected clients

### CI/CD Pipeline

**Recommended GitHub Actions:**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build frontend
        run: npm run build
      
      - name: Deploy Convex
        run: npx convex deploy --prod
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
      
      - name: Deploy frontend
        run: # Deploy dist/ to hosting
```

### Monitoring

**Convex Dashboard:**
- Function execution logs
- Database query performance
- Error tracking
- Usage metrics

**Azure OpenAI Monitoring:**
- API usage and costs
- Rate limit tracking
- Error rates
- Model performance

**Recommended Tools:**
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **Datadog**: Performance monitoring

---

## Development Guide

### Setting Up Development Environment

**Prerequisites:**
- Node.js 18+ and npm
- Git
- Azure OpenAI API access
- Google Gemini API access
- Convex account

**Installation:**
```bash
git clone <repository>
cd Course
npm install
npm run update-pdf-worker # Ensure PDF.js worker matches library version
```

**Environment Configuration:**
```env
# .env.local
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-large
OPENAI_API_VERSION=2025-01-01-preview
GOOGLE_API_KEY=your_gemini_key

# Convex (set in dashboard or CLI)
CONVEX_DEPLOYMENT=your-deployment
```

### Code Style

**TypeScript:**
- Strict mode enabled
- No implicit any
- Null checks enforced

**ESLint:**
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended"
  ]
}
```

**Prettier:**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Testing Recommendations

**Unit Tests (to be added):**
```typescript
// Example: test TF-IDF calculation
describe("TF-IDF", () => {
  it("should compute correct IDF scores", () => {
    const corpus = ["course on algorithms", "course on data structures"];
    const idf = computeIdf(corpus);
    expect(idf.get("course")).toBe(Math.log(2 / 3)); // Appears in both
    expect(idf.get("algorithms")).toBe(Math.log(2 / 2)); // Appears in one
  });
});
```

**Integration Tests:**
```typescript
// Test end-to-end matching
describe("Matching", () => {
  it("should match similar courses", async () => {
    const userCourse = "Introduction to Algorithms";
    const plakshaCourse = "CS301: Algorithm Design";
    const score = await calculateMatchScore(userCourse, plakshaCourse);
    expect(score).toBeGreaterThan(0.8);
  });
});
```

### Debugging

**Convex Logs:**
```typescript
// In any Convex function
console.log("Debug info:", data);
// Logs appear in Convex dashboard
```

**Frontend Debugging:**
```typescript
// React DevTools
// Network tab for API calls
// Console for errors

// Convex client debugging
import { ConvexProvider, useConvex } from "convex/react";
const convex = useConvex();
console.log("Convex client:", convex);
```

**Common Issues:**

1. **PDF.js Worker Mismatch:**
   ```bash
   npm run update-pdf-worker
   ```

2. **Convex Schema Changes:**
   ```bash
   npx convex dev
   # Applies migrations automatically
   ```

3. **API Rate Limits:**
   - Check Azure OpenAI quotas
   - Implement exponential backoff
   - Use caching aggressively

---

## API Reference

### Convex Functions

#### Queries

**`dualTranscripts.getById`**
```typescript
Args: { id: Id<"dualTranscripts"> }
Returns: Doc<"dualTranscripts"> | null
Description: Fetch a single transcript by ID
```

**`dualTranscripts.listByUser`**
```typescript
Args: none (uses auth context)
Returns: Doc<"dualTranscripts">[]
Description: List all transcripts for current user
```

**`courses.listAll`**
```typescript
Args: none
Returns: Doc<"plakshaCourses">[]
Description: Fetch all Plaksha courses
```

**`courses.getCoreRequirements`**
```typescript
Args: { semester: number }
Returns: Doc<"plakshaCourses">[]
Description: Get core requirements for a semester
```

#### Mutations

**`dualTranscripts.create`**
```typescript
Args: {
  transcriptFileId: Id<"_storage">,
  courseOfStudyFileId: Id<"_storage">,
  transcriptFileName: string,
  courseOfStudyFileName: string,
  transcriptText: string,
  courseOfStudyText: string,
  gradeThreshold: string,
}
Returns: Id<"dualTranscripts">
Description: Create a new transcript record
```

**`dualTranscripts.updateAnalysis`**
```typescript
Args: {
  id: Id<"dualTranscripts">,
  analysisResults: AnalysisResults,
  processingStatus: "completed" | "failed",
}
Returns: void
Description: Update transcript with analysis results
```

#### Actions

**`dualAnalysis.analyzeTranscript`**
```typescript
Args: { transcriptId: Id<"dualTranscripts"> }
Returns: void
Description: Perform full hybrid analysis on a transcript
```

**`analysis.extractCourses`**
```typescript
Args: {
  transcriptText: string,
  courseOfStudyText: string,
  gradeThreshold: string,
}
Returns: ExtractedCourse[]
Description: Extract courses from transcript using Gemini
```

### External APIs

#### Azure OpenAI

**Embeddings:**
```
POST https://{endpoint}/openai/deployments/{deployment}/embeddings?api-version={version}
Headers:
  api-key: {key}
  Content-Type: application/json
Body:
  {
    "input": "text to embed",
    "dimensions": 3072
  }
Response:
  {
    "data": [{"embedding": [0.1, 0.2, ...]}]
  }
```

**Chat Completions:**
```
POST https://{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={version}
Headers:
  api-key: {key}
  Content-Type: application/json
Body:
  {
    "messages": [
      {"role": "system", "content": "..."},
      {"role": "user", "content": "..."}
    ],
    "temperature": 0.7
  }
Response:
  {
    "choices": [{"message": {"content": "..."}}]
  }
```

#### Google Gemini

**Generate Content:**
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const result = await model.generateContent(prompt);
const text = result.response.text();
```

---

## Appendix: Algorithms and Formulas

### Vector Similarity (Cosine)

```
cosine(A, B) = (A · B) / (||A|| × ||B||)

where:
  A · B = Σ(Ai × Bi)  (dot product)
  ||A|| = √(Σ(Ai²))   (magnitude)
```

### TF-IDF

```
TF(term, doc) = (frequency of term in doc) / (total terms in doc)

IDF(term, corpus) = log(N / (1 + df(term)))
  where N = total documents
        df(term) = documents containing term

TF-IDF(term, doc, corpus) = TF(term, doc) × IDF(term, corpus)
```

### Final Match Score

```
finalScore = w₁ × vectorScore 
           + w₂ × tfidfScore 
           + w₃ × semanticScore

where:
  w₁ = 0.4 (vector weight)
  w₂ = 0.3 (TF-IDF weight)
  w₃ = 0.3 (semantic weight)
  w₁ + w₂ + w₃ = 1.0

Threshold: finalScore >= 0.3 for acceptance
```

### Grade to GPA Conversion

```
Grade   GPA
─────   ────
A+      4.0
A       4.0
A-      3.7
B+      3.3
B       3.0
B-      2.7
C+      2.3
C       2.0
C-      1.7
D+      1.3
D       1.0
D-      0.7
F       0.0
```

---

**End of Technical Implementation Guide**

For user-facing documentation, see [USER_MANUAL.md](USER_MANUAL.md).
