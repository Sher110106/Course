# Curriculum Gap Analysis Tool

A full-stack web application for mapping a student's completed courses (manual entry or PDF transcript upload) to Plaksha University's curriculum, identifying gaps, and providing actionable recommendations. Built with React, Convex, and AI-powered semantic analysis.

---

## 🚀 Recent Updates & Improvements

### Latest Features (v2.1.0)
- **Enhanced PDF Processing:** Improved OCR accuracy with Tesseract.js and fallback to PDF.js
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
- **PDF Transcript Upload:** Upload academic transcripts (PDF) with automatic OCR text extraction
- **AI-Powered Curriculum Mapping:** Uses OpenAI embeddings to semantically match user courses to Plaksha's curriculum
- **Gap Analysis:** Identifies missing core requirements and predicts challenges in future semesters
- **Personalized Recommendations:** Offers guidance on bridging curriculum gaps and preparing for advanced courses
- **Authentication:** Supports password and anonymous sign-in via Convex Auth

### Advanced AI Capabilities
- **Semantic Matching:** Deep understanding of course content beyond simple keyword matching
- **Multi-Method Analysis:** Combines vector embeddings, TF-IDF, and semantic AI for optimal results
- **Future Course Prediction:** AI-powered difficulty assessment for upcoming courses
- **Intelligent Caching:** Reduces API calls and improves performance
- **Batch Processing:** Efficient handling of multiple courses simultaneously

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
  - `PDFUploader`: Handles PDF upload, OCR extraction, and transcript management
  - `AnalysisResults`: Displays matched courses, gaps, future challenges, and recommendations
  - `CourseInputForm`: Form for adding/editing user courses
  - `SignInForm` / `SignOutButton`: Authentication UI
- **Styling:** Tailwind CSS with utility helpers (`src/lib/utils.ts`)
- **Notifications:** User feedback via `sonner` toasts

### Backend (`convex/`)
- **Convex Functions:**
  - `analysis.ts`: Core curriculum gap analysis with multi-layer AI matching
  - `courses.ts`: User and Plaksha course management, queries, and mutations
  - `transcriptData.ts`: Transcript upload, storage, extraction, and status tracking
  - `seedData.ts`: Seeds Plaksha curriculum with course data and embeddings
  - `schema.ts`: Database schema for users, courses, transcripts, curriculum, and analysis results
  - `auth.ts`: Authentication logic and user queries
  - `maintenance.ts`: Admin actions (e.g., regenerate embeddings)
- **AI Integration:**
  - Azure OpenAI for both semantic embeddings and chat completions
  - Vector search for course similarity and gap analysis
  - Multi-layer matching algorithm (Vector + TF-IDF + Semantic)
- **File Storage:** Convex file storage for uploaded transcripts

### Database (Convex)
- **Tables:**
  - `userCourses`: User-entered courses
  - `userTranscripts`: Uploaded transcripts and extracted data
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

### 2. PDF Transcript Upload
1. **File Upload:** Upload PDF transcript (max 10MB)

## 🛠️ Development & Maintenance

### PDF.js Worker Version Management
The application uses PDF.js for PDF processing. To prevent version mismatch errors:

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

### Multi-Layer Matching Algorithm
1. **Vector Embedding Search** (40% weight)
   - 3072-dimensional vectors using Azure OpenAI's text-embedding-3-large
   - Fast similarity search using Convex Vector Search
   - Threshold: 0.6+ similarity score

2. **TF-IDF Analysis** (30% weight)
   - Term frequency-inverse document frequency computation
   - Cosine similarity between TF-IDF vectors
   - Handles technical terminology matching

3. **Semantic AI Analysis** (30% weight)
   - GPT-4 powered similarity assessment
   - Contextual understanding of course content
   - Evaluates learning objectives and outcomes

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
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-large
OPENAI_API_VERSION=2025-01-01-preview
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
- **Tesseract.js:** OCR for PDF text extraction
- **pdfjs-dist:** PDF parsing and text extraction
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
