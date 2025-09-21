# Curriculum Gap Analysis Tool

A full-stack web application for mapping a student's completed courses (manual entry or PDF transcript upload) to Plaksha University's curriculum, identifying gaps, and providing actionable recommendations. Built with React, Convex, and AI-powered semantic analysis.

---

## 🚀 Recent Updates & Improvements

### Latest Features (v2.2.1) - Critical Logic Fixes
- **Fixed Vector Similarity:** Proper vector search implementation for curriculum courses (was using TF-IDF as proxy)
- **Standardized Similarity Weights:** Consistent 0.4/0.3/0.3 weighting across all analysis methods
- **Optimized TF-IDF Threshold:** Increased from 0.05 to 0.15 for better pre-filtering and cost reduction
- **Enhanced Grade Filtering:** Improved handling of missing grades and edge cases
- **Balanced Final Threshold:** Optimized from 0.25 to 0.3 for better accuracy vs. coverage

### Previous Features (v2.2.0) - Dual PDF Analysis
- **Dual PDF Analysis:** Upload both transcript and course of study documents for enhanced course matching
- **Grade-Aware Filtering:** Intelligent grade threshold filtering with support for various grade formats
- **Enhanced Credit Extraction:** Multi-method credit detection from PDFs with fallback mechanisms
- **Improved Curriculum Matching:** Fixed matching against Plaksha's actual curriculum (not self-matching)
- **Robust Error Handling:** Comprehensive error recovery and detailed debugging
- **Advanced JSON Processing:** Enhanced Gemini AI integration with better prompt engineering

### Previous Features (v2.1.0)
- **Enhanced PDF Processing:** Improved OCR and PDF text extraction with PDF.js; Tesseract.js optional
- **Hybrid Analysis Method:** New AI-powered analysis combining vector search, TF-IDF, and semantic matching
- **Advanced Caching:** Intelligent caching system for embeddings and similarity scores
- **Better Error Handling:** Graceful degradation and comprehensive error recovery
- **Performance Optimizations:** Batch processing and memory management improvements
- **Enhanced UI/UX:** Improved progress indicators and user feedback

### Technical Improvements
- **Multi-Layer AI Matching:** Three-tier approach (Vector + TF-IDF + Semantic) for better accuracy
- **Optimized Vector Search:** Efficient similarity search with configurable thresholds
- **Batch API Processing:** Reduced API calls and improved performance
- **Comprehensive Logging:** Detailed logging for debugging and monitoring
- **Memory Management:** Efficient data structures and garbage collection

---

## ✨ Features

### Core Functionality
- **Manual Course Entry:** Users can add, edit, and delete their completed courses with detailed descriptions
- **Single PDF Upload:** Upload academic transcripts (PDF) with automatic OCR text extraction
- **Dual PDF Analysis:** Upload both transcript and course of study documents for enhanced course matching
- **AI-Powered Curriculum Mapping:** Uses OpenAI embeddings to semantically match user courses to Plaksha's curriculum
- **Grade-Aware Analysis:** Intelligent filtering based on grade thresholds with support for various formats
- **Credit Extraction:** Multi-method credit detection from PDFs with comprehensive fallback mechanisms
- **Gap Analysis:** Identifies missing core requirements and predicts challenges in future semesters
- **Personalized Recommendations:** Offers guidance on bridging curriculum gaps and preparing for advanced courses
- **Authentication:** Supports password and anonymous sign-in via Convex Auth

### Advanced AI Capabilities
- **True Hybrid Analysis:** Genuine combination of vector embeddings, TF-IDF, and semantic AI
- **Vector Search Integration:** Real vector similarity using Convex Vector Search for semantic matching
- **Multi-Method Analysis:** Each method compensates for others' weaknesses for optimal results
- **Future Course Prediction:** AI-powered difficulty assessment for upcoming courses
- **Intelligent Caching:** Reduces API calls by 60-80% and improves performance
- **Batch Processing:** Efficient parallel handling of multiple courses simultaneously
- **Optimized Pre-filtering:** TF-IDF threshold of 0.15 reduces unnecessary AI processing

### User Experience
- **Tabbed Interface:** Seamless switching between manual entry and PDF upload
- **Real-time Updates:** Live data synchronization and progress indicators
- **Responsive Design:** Mobile-friendly interface with modern UI
- **Toast Notifications:** User feedback for all operations
- **Progress Tracking:** Visual feedback for long-running operations

---

## 🏗️ Architecture

### Frontend (`src/`)
- **React + Vite:** SPA with modern UI, state management, and tabbed navigation
- **Key Components:**
  - `CurriculumAnalyzer`: Manual entry, course management, and analysis trigger
  - `PDFUploader`: Handles single PDF upload, OCR extraction, and transcript management
  - `DualPDFUploader`: Handles dual PDF upload with grade filtering and enhanced processing
  - `DualAnalysisResults`: Displays dual analysis results with curriculum gap analysis
  - `CourseExtractor`: Course extraction and verification interface
  - `AnalysisResults`: Displays matched courses, gaps, future challenges, and recommendations
  - `CourseInputForm`: Form for adding/editing user courses
  - `SignInForm` / `SignOutButton`: Authentication UI
- **Styling:** Tailwind CSS with utility helpers (`src/lib/utils.ts`)
- **Notifications:** User feedback via `sonner` toasts

### Backend (`convex/`)
- **Convex Functions:**
  - `analysis.ts`: Core curriculum gap analysis with multi-layer AI matching and Gemini integration
  - `dualAnalysis.ts`: Dual PDF analysis with enhanced course matching and gap analysis
  - `dualTranscripts.ts`: Dual transcript management, grade filtering, and credit extraction
  - `courses.ts`: User and Plaksha course management, queries, and mutations
  - `transcriptData.ts`: Single transcript upload, storage, extraction, and status tracking
  - `seedData.ts`: Seeds Plaksha curriculum with course data and embeddings
  - `schema.ts`: Database schema for users, courses, transcripts, curriculum, and analysis results
  - `auth.ts`: Authentication logic and user queries
  - `maintenance.ts`: Admin actions (e.g., regenerate embeddings)
- **AI Integration:**
  - Azure OpenAI for both semantic embeddings and chat completions
  - Google Gemini 2.5 Flash for dual PDF analysis and course extraction
  - Vector search for course similarity and gap analysis
  - Multi-layer matching algorithm (Vector + TF-IDF + Semantic)
- **File Storage:** Convex file storage for uploaded transcripts and course of study documents

### Database (Convex)
- **Tables:**
  - `userCourses`: User-entered courses
  - `userTranscripts`: Single uploaded transcripts and extracted data
  - `dualTranscripts`: Dual PDF uploads with grade filtering and enhanced processing
  - `plakshaCourses`: Plaksha curriculum with embeddings
  - `analysisResults`: Stores results of each analysis
- **Indexes:** For efficient querying by user, status, department, semester, and vector similarity

---

## 🔄 User Flow

### 1. Manual Course Entry
1. **Authentication:** Sign in (password or anonymous)
2. **Course Addition:** Add completed courses with title, description, institution, and credits
3. **Target Selection:** Choose target semester for transfer
4. **Analysis Trigger:** AI matches user courses to Plaksha curriculum, identifies gaps, and predicts future challenges
5. **Results Display:** Comprehensive analysis with recommendations

### 2. Single PDF Transcript Upload
1. **File Upload:** Upload PDF transcript (max 10MB)
2. **OCR Processing:** Automatic text extraction using Tesseract.js with PDF.js fallback
3. **Course Parsing:** AI extracts and identifies individual courses
4. **Analysis Selection:** Choose between Vector AI (fast) or Hybrid AI (recommended)
5. **Results Display:** Same comprehensive analysis as manual entry

### 3. Dual PDF Analysis (NEW)
1. **Dual Upload:** Upload both transcript PDF and course of study PDF
2. **Grade Threshold:** Set minimum grade threshold (A+ to F) for course filtering
3. **Enhanced Processing:** Gemini AI extracts courses from transcript and enhances with course of study descriptions
4. **Grade Filtering:** Automatically filters out courses below grade threshold
5. **Credit Extraction:** Multi-method credit detection with fallback mechanisms
6. **Curriculum Matching:** Matches against Plaksha's actual curriculum requirements
7. **Gap Analysis:** Identifies missing Plaksha courses based on completed courses

## 🛠️ Development & Maintenance

### PDF Processing & OCR
The application uses PDF.js for rendering and text extraction. To prevent PDF.js worker version mismatch errors:

1. **Automatic Updates:** The `postinstall` script automatically updates the PDF worker file when dependencies are installed
2. **Manual Updates:** Run `npm run update-pdf-worker` to manually sync the worker file
3. **Version Consistency:** The worker file in `public/pdf.worker.js` must match the installed `pdfjs-dist` version

**Troubleshooting Version Mismatch:**
- Error: `"The API version "X.X.X" does not match the Worker version "Y.Y.Y"`
- Solution: Run `npm run update-pdf-worker` to sync versions
- Prevention: The `postinstall` script handles this automatically
2. **OCR Processing:** Automatic text extraction using Tesseract.js with PDF.js fallback
3. **Course Parsing:** AI extracts and identifies individual courses
4. **Analysis Selection:** Choose between Vector AI (fast) or Hybrid AI (recommended)
5. **Results Display:** Same comprehensive analysis as manual entry

---

## 🧠 AI Analysis Engine

### True Hybrid Multi-Layer Matching Algorithm
The system now uses a **genuine hybrid approach** combining three distinct similarity methods:

1. **Vector Embedding Search** (40% weight)
   - 3072-dimensional vectors using Azure OpenAI's text-embedding-3-large
   - Real vector similarity via Convex Vector Search (`ctx.vectorSearch`)
   - Captures semantic meaning and contextual relationships
   - Threshold: 0.3+ for initial filtering, 0.3+ for final matching

2. **TF-IDF Analysis** (30% weight)
   - Term frequency-inverse document frequency computation
   - Cosine similarity between TF-IDF vectors
   - Handles technical terminology and keyword matching
   - Threshold: 0.15+ for pre-filtering (optimized for efficiency)

3. **Semantic AI Analysis** (30% weight)
   - GPT-4 powered similarity assessment
   - Contextual understanding of course content
   - Evaluates learning objectives and outcomes
   - Cached results to avoid redundant API calls

### Final Score Calculation
```typescript
finalScore = 0.4 * vectorScore + 0.3 * tfidfScore + 0.3 * semanticScore
```

### Performance Optimizations
- **Vector Search Pre-filtering**: Reduces comparisons by 80-90%
- **TF-IDF Pre-filtering**: Eliminates low-similarity pairs before AI processing
- **Intelligent Caching**: Reduces API calls by 60-80%
- **Batch Processing**: Efficient parallel processing of course comparisons

### Gap Analysis Logic
- **Core Requirement Identification:** Analyzes requirements up to target semester
- **Gap Detection:** Identifies missing core courses
- **Future Challenge Prediction:** AI assesses difficulty of upcoming courses
- **Personalized Recommendations:** Actionable advice based on user background

---

## 🚀 Development & Deployment

### Quick Start
```bash
# Install dependencies
npm install

# Start development servers
npm run dev  # Runs frontend and backend concurrently

# Build for production
npm run build
```

### Environment Variables
```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-large
OPENAI_API_VERSION=2025-01-01-preview

# Google Gemini Configuration (for dual PDF analysis)
GOOGLE_API_KEY=your_gemini_api_key
```

### Convex Deployment
- Connected to Convex deployment [`healthy-puma-366`](https://dashboard.convex.dev/d/healthy-puma-366)
- Automatic schema migrations and function deployment
- Real-time data synchronization

---

## 🛠️ Technologies Used

### Frontend
- **React 18:** Modern UI with hooks and functional components
- **Vite:** Fast build tool and development server
- **TypeScript:** Type-safe development
- **Tailwind CSS:** Utility-first CSS framework
- **pdfjs-dist:** PDF rendering and text extraction
- **Sonner:** Toast notifications

### Backend
- **Convex:** Serverless database and functions
- **Azure OpenAI:** GPT-4 and text-embedding-3-large models
- **TypeScript:** Full-stack type safety
- **Vector Search:** Semantic similarity search

### Infrastructure
- **Convex Auth:** Authentication and user management
- **Convex File Storage:** Secure file upload and storage
- **Convex Vector Search:** High-performance similarity search
- **Modern CI/CD:** Automated deployment pipeline

---

## 📁 File Structure Reference

```
├── src/                    # Frontend React app
│   ├── components/        # React components
│   ├── lib/              # Utility functions
│   └── main.tsx          # Application entry point
├── convex/               # Backend Convex functions
│   ├── _generated/       # Auto-generated types
│   ├── utils/           # Shared utilities
│   └── schema.ts        # Database schema
├── public/              # Static assets
└── package.json         # Dependencies and scripts
```

---

## 📊 Performance & Scalability

### Optimizations
- **Intelligent Caching:** Reduces API calls by 60-80%
- **Batch Processing:** Handles multiple courses efficiently
- **Vector Search:** Fast similarity matching
- **Memory Management:** Efficient data structures
- **Error Recovery:** Graceful degradation on failures

### Monitoring
- **Performance Metrics:** Analysis time, success rates, error rates
- **User Analytics:** Feature usage, course counts, target semesters
- **API Monitoring:** Azure OpenAI usage and costs
- **Error Tracking:** Comprehensive logging and debugging

---

## 🔒 Security & Privacy

### Data Protection
- **Secure Authentication:** Convex Auth with password and anonymous options
- **File Validation:** Type and size checking for uploads
- **API Security:** Secure Azure OpenAI integration
- **User Isolation:** Data separation between users

### Privacy Features
- **Local Processing:** OCR and text extraction in browser
- **Secure Storage:** Encrypted file storage
- **Data Retention:** User-controlled data management
- **No Third-Party Sharing:** Analysis results for personal use only

---

## 🎯 Use Cases

### For Students
- **Transfer Credit Assessment:** Understand how previous courses map to Plaksha
- **Gap Identification:** Identify missing core requirements
- **Academic Planning:** Plan future coursework based on gaps
- **Admissions Support:** Provide detailed analysis for applications

### For Academic Advisors
- **Student Assessment:** Quick evaluation of student backgrounds
- **Transfer Planning:** Assist with credit transfer decisions
- **Curriculum Mapping:** Understand course equivalencies
- **Recommendation Support:** Provide data-driven advice

---

## 🔮 Future Roadmap

### Planned Features
- **Multi-Institution Support:** Compare courses across multiple universities
- **Advanced Analytics:** Longitudinal progress tracking
- **Predictive Modeling:** Course success prediction
- **Mobile App:** Native mobile application
- **API Access:** Public API for integration

### Technical Enhancements
- **Edge Computing:** Distributed processing for better performance
- **Advanced OCR:** Better handwriting and multi-language support
- **Real-time Collaboration:** Multi-user analysis sessions
- **Advanced Caching:** Redis integration for better performance

---

## 📚 Documentation

- **[User Manual](User_Manual.md):** Comprehensive guide for users
- **[Technical Documentation](Working.md):** Detailed technical implementation
- **[API Documentation](convex/):** Backend function documentation
- **[Component Documentation](src/components/):** Frontend component guides

---

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Start development: `npm run dev`
5. Make changes and test thoroughly
6. Submit a pull request

### Code Standards
- **TypeScript:** Full type safety required
- **ESLint:** Code quality and consistency
- **Prettier:** Consistent code formatting
- **Testing:** Unit and integration tests

---

## 📞 Support & Resources

### Getting Help
- **Documentation:** Comprehensive guides and examples
- **Issues:** Report bugs and request features
- **Discussions:** Community support and questions
- **Email Support:** Direct support for complex issues

### Resources
- [Convex Documentation](https://docs.convex.dev/)
- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Plaksha University](https://plaksha.edu.in/)
- [React Documentation](https://react.dev/)

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Plaksha University:** For curriculum data and academic guidance
- **Convex Team:** For the excellent serverless platform
- **Azure OpenAI:** For powerful AI capabilities
- **Open Source Community:** For the amazing tools and libraries

---

For questions, contributions, or support, please contact the maintainers or open an issue in the repository.
