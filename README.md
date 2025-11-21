# Plaksha Course Matcher

An intelligent web application that analyzes academic transcripts against Plaksha University's curriculum using advanced AI techniques. Upload your transcript and course of study documents to receive comprehensive course matching analysis, curriculum gap identification, and personalized academic recommendations.

---

## 📋 Overview

The Plaksha Course Matcher helps students and academic advisors:
- **Match completed courses** to Plaksha University curriculum requirements
- **Identify curriculum gaps** for transfer students and credit assessments  
- **Analyze course equivalencies** using multi-layer AI matching algorithms
- **Generate detailed reports** with actionable recommendations
- **Filter by academic performance** with grade-aware analysis

---

## ✨ Key Features

### Dual PDF Processing
- Upload both academic transcript and course of study documents
- Advanced PDF text extraction with column preservation
- Automatic course code and credit detection
- Multi-format grade parsing (letter grades, percentages, GPA)

### AI-Powered Analysis
- **Hybrid Matching Algorithm** combining:
  - Vector embeddings (40%) - semantic understanding
  - TF-IDF analysis (30%) - keyword matching
  - Semantic AI (30%) - contextual similarity
- Real-time vector search using Azure OpenAI embeddings
- Intelligent caching reduces API calls by 60-80%

### Grade-Aware Filtering
- Set minimum grade thresholds (A+ to F)
- Visual indicators for course performance
- Automatic filtering of below-threshold courses
- Support for various grading systems

### Curriculum Gap Analysis
- Identifies missing core requirements
- Prioritizes gaps by academic level
- Assesses difficulty of future courses
- Provides personalized recommendations

### Professional Reporting
- Comprehensive PDF report generation
- Detailed match breakdowns with similarity scores
- Visual progress indicators and statistics
- Export functionality for academic records

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React 18 + TypeScript + Vite                        │  │
│  │  - DualPDFUploader Component                         │  │
│  │  - DualAnalysisResults Component                     │  │
│  │  - Tailwind CSS Styling                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                CONVEX BACKEND (Serverless)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Database Schema                                      │  │
│  │  - dualTranscripts (uploads & analysis)              │  │
│  │  - plakshaCourses (curriculum with embeddings)       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Backend Functions                                    │  │
│  │  - dualAnalysis.ts (matching logic)                  │  │
│  │  - dualTranscripts.ts (file management)              │  │
│  │  - analysis.ts (Gemini integration)                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                    ↕                    ↕
┌──────────────────────────┐  ┌──────────────────────────┐
│   Azure OpenAI API       │  │  Google Gemini AI        │
│   - GPT-4 Chat           │  │  - Document Extraction   │
│   - Vector Embeddings    │  │  - Course Parsing        │
│   - Semantic Analysis    │  │  - Credit Detection      │
└──────────────────────────┘  └──────────────────────────┘
```

### Tech Stack

**Frontend**
- React 18 with TypeScript for type safety
- Vite for fast development and optimized builds
- Tailwind CSS for modern, responsive styling
- PDF.js for client-side PDF text extraction
- Sonner for elegant toast notifications

**Backend (Convex)**
- Serverless database with real-time sync
- Vector search for semantic similarity
- File storage for PDF documents
- Authentication via Convex Auth

**AI Services**
- **Azure OpenAI**: GPT-4 for semantic analysis, text-embedding-3-large (3072-dim vectors)
- **Google Gemini 2.5 Flash**: Document parsing and course extraction

---

## 🔄 How It Works

### Step-by-Step Process

```
1. UPLOAD
   User uploads transcript + course of study PDFs
   ↓
2. TEXT EXTRACTION  
   PDF.js extracts text preserving column layout
   ↓
3. AI EXTRACTION (Gemini)
   Identifies courses, grades, credits, codes
   ↓
4. GRADE FILTERING
   Filters courses below threshold
   ↓
5. HYBRID MATCHING
   ┌─────────────────────────────────────┐
   │  Vector Search (40%)                │
   │  - Semantic embeddings              │
   │  - Convex vector index              │
   ├─────────────────────────────────────┤
   │  TF-IDF Analysis (30%)              │
   │  - Keyword matching                 │
   │  - Term importance                  │
   ├─────────────────────────────────────┤
   │  Semantic AI (30%)                  │
   │  - GPT-4 contextual analysis        │
   │  - Learning outcome comparison      │
   └─────────────────────────────────────┘
   ↓
6. GAP ANALYSIS
   Identifies missing curriculum requirements
   ↓
7. REPORT GENERATION
   Creates detailed PDF with recommendations
```

### Matching Algorithm

The system uses a **three-tier hybrid approach** for optimal accuracy:

**Tier 1: Vector Embeddings (40%)**
- 3072-dimensional semantic vectors via Azure OpenAI
- Captures deep contextual meaning
- Fast pre-filtering with vector search

**Tier 2: TF-IDF (30%)**  
- Term frequency-inverse document frequency
- Excellent for technical terminology
- Pre-filtering threshold: 0.15

**Tier 3: Semantic AI (30%)**
- GPT-4 powered similarity assessment
- Understands learning objectives
- Intelligent caching for performance

**Final Score**: `0.4 × vector + 0.3 × tfidf + 0.3 × semantic`

---

## 📚 Documentation

For detailed guides, please refer to:
- **[USER_MANUAL.md](USER_MANUAL.md)** - Complete user guide with step-by-step instructions
- **[TECHNICAL_IMPLEMENTATION.md](TECHNICAL_IMPLEMENTATION.md)** - Technical architecture and implementation details

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Course

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Environment Variables

```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-large
OPENAI_API_VERSION=2025-01-01-preview

# Google Gemini Configuration
GOOGLE_API_KEY=your_gemini_api_key
```

### Development

```bash
# Start development servers (frontend + backend)
npm run dev

# Build for production
npm run build

# Update PDF.js worker (if needed)
npm run update-pdf-worker
```

### Deployment

The application is deployed on Convex with automatic CI/CD:
- **Dashboard**: [healthy-puma-366](https://dashboard.convex.dev/d/healthy-puma-366)
- **Auto Schema Migrations**: Database schema updates automatically
- **Real-time Sync**: Changes propagate instantly to all clients

---

## 🎯 Use Cases

**For Students:**
- Evaluate transfer credits and course equivalencies
- Identify missing core curriculum requirements
- Plan academic path to meet graduation requirements
- Prepare stronger applications with detailed analysis

**For Academic Advisors:**
- Quick assessment of student academic backgrounds
- Data-driven credit transfer recommendations
- Identify knowledge gaps for targeted support
- Generate comprehensive evaluation reports

---

## 📄 License

MIT License - See LICENSE file for details.

---

## 🙏 Acknowledgments

- **Plaksha University** - Curriculum data and academic guidance
- **Convex** - Serverless platform and real-time infrastructure
- **Azure OpenAI** - Advanced AI capabilities
- **Google Gemini** - Document understanding and extraction

---

**Need Help?** Check out the [User Manual](USER_MANUAL.md) for step-by-step instructions or [Technical Implementation](TECHNICAL_IMPLEMENTATION.md) for development details.
