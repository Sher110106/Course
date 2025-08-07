# Curriculum Gap Analysis Tool - Implementation Plan

## Overview
This plan outlines the implementation of a curriculum gap analysis tool that allows users to upload two PDFs: a student transcript and a course of study document. The system will extract course information from both PDFs, filter courses based on minimum grade requirements, and perform semantic analysis to match completed courses with curriculum requirements.

## Requirements Analysis

### Core Features
1. **Dual PDF Upload**: 
   - Student transcript PDF (containing completed courses with grades)
   - Course of study PDF (containing curriculum descriptions)
2. **Grade Filtering**: Minimum grade threshold (e.g., B or higher)
3. **Course Extraction**: Parse courses from both PDFs
4. **Semantic Matching**: AI-powered matching between completed and required courses
5. **Gap Analysis**: Identify missing requirements and provide recommendations

### Technical Requirements
- PDF text extraction using PDF.js and Tesseract.js OCR
- Grade parsing and validation
- Course description extraction and matching
- AI-powered semantic analysis
- Real-time processing with progress indicators
- Responsive web interface

## Architecture Design

### Frontend Components
```
src/components/
├── DualPDFUploader.tsx          # Main upload interface for both PDFs
├── GradeFilter.tsx              # Grade threshold selection
├── CourseExtractor.tsx          # Course parsing and display
├── AnalysisResults.tsx          # Enhanced results display
├── ProgressIndicator.tsx        # Processing progress
└── CourseMatcher.tsx           # Course matching interface
```

### Backend Functions (Convex)
```
convex/
├── dualTranscripts.ts           # Dual PDF processing
├── gradeFilter.ts              # Grade filtering logic
├── courseExtraction.ts         # Course parsing from PDFs
├── semanticMatching.ts         # AI-powered course matching
├── gapAnalysis.ts              # Gap identification
└── recommendations.ts          # Recommendation generation
```

### Database Schema Extensions
```typescript
// New tables for dual PDF processing
dualTranscripts: {
  userId: Id<"users">,
  transcriptFileId: Id<"_storage">,
  courseOfStudyFileId: Id<"_storage">,
  transcriptText: string,
  courseOfStudyText: string,
  processingStatus: "uploaded" | "processing" | "completed" | "failed",
  gradeThreshold: string, // e.g., "B", "C+", etc.
  extractedCourses: Array<{
    title: string,
    description: string,
    grade: string,
    credits: number,
    semester: string
  }>,
  curriculumCourses: Array<{
    code: string,
    title: string,
    description: string,
    credits: number,
    isRequired: boolean,
    semester: number
  }>,
  analysisResults: {
    matchedCourses: Array<{
      userCourse: string,
      curriculumCourse: string,
      similarity: number,
      grade: string
    }>,
    gapCourses: Array<{
      code: string,
      title: string,
      description: string,
      semester: number,
      priority: "high" | "medium" | "low"
    }>,
    recommendations: Array<{
      type: "prerequisite" | "elective" | "core",
      message: string,
      courses: string[]
    }>
  }
}
```

## Implementation Phases

### Phase 1: Enhanced PDF Processing (Week 1)
**Objective**: Extend existing PDF processing to handle dual PDFs with grade extraction

#### Tasks:
1. **Modify PDFUploader Component**
   - Add support for dual file upload
   - Implement grade extraction from transcript text
   - Add grade threshold selection UI
   - Enhance OCR processing for better grade recognition

2. **Create Grade Filtering Logic**
   - Implement grade comparison functions
   - Support various grade formats (A+, B-, etc.)
   - Add grade validation and normalization

3. **Update Database Schema**
   - Add new tables for dual transcript processing
   - Extend existing schema for grade information
   - Add indexes for efficient querying

#### Key Files to Modify:
- `src/components/PDFUploader.tsx` → `src/components/DualPDFUploader.tsx`
- `convex/transcriptData.ts` → `convex/dualTranscripts.ts`
- `convex/schema.ts` (add new tables)

### Phase 2: Course Extraction Enhancement (Week 2)
**Objective**: Improve course extraction from both transcript and curriculum PDFs

#### Tasks:
1. **Enhanced Course Parsing**
   - Implement AI-powered course title extraction
   - Add course description parsing from curriculum PDF
   - Handle various transcript formats and layouts

2. **Curriculum Course Processing**
   - Extract course codes, titles, and descriptions
   - Identify required vs. elective courses
   - Parse semester/level information

3. **Grade-Aware Course Filtering**
   - Filter courses based on minimum grade threshold
   - Calculate GPA for relevant courses
   - Handle incomplete grades and special cases

#### Key Files to Create/Modify:
- `convex/courseExtraction.ts` (new)
- `src/components/CourseExtractor.tsx` (new)
- `convex/gradeFilter.ts` (new)

### Phase 3: Semantic Matching Enhancement (Week 3)
**Objective**: Improve AI-powered course matching with grade considerations

#### Tasks:
1. **Enhanced Matching Algorithm**
   - Incorporate grade information in similarity calculations
   - Weight courses by grade performance
   - Add confidence scoring for matches

2. **Multi-Layer Analysis**
   - Vector similarity for course descriptions
   - TF-IDF analysis for technical terminology
   - Semantic AI analysis with grade context

3. **Grade-Weighted Recommendations**
   - Prioritize high-performing courses in matches
   - Consider prerequisite chains with grade requirements
   - Generate personalized recommendations

#### Key Files to Modify:
- `convex/analysis.ts` → `convex/semanticMatching.ts`
- `convex/analysis.ts` → `convex/gapAnalysis.ts`
- `src/components/AnalysisResults.tsx`

### Phase 4: Gap Analysis & Recommendations (Week 4)
**Objective**: Implement comprehensive gap analysis with grade-aware recommendations

#### Tasks:
1. **Advanced Gap Analysis**
   - Identify missing core requirements
   - Consider grade prerequisites for advanced courses
   - Calculate completion percentages by category

2. **Smart Recommendations**
   - Suggest courses based on current performance
   - Prioritize courses by difficulty and prerequisites
   - Generate personalized study plans

3. **Enhanced UI/UX**
   - Interactive course matching interface
   - Visual progress indicators
   - Detailed analysis reports

#### Key Files to Create/Modify:
- `convex/recommendations.ts` (new)
- `src/components/CourseMatcher.tsx` (new)
- `src/components/ProgressIndicator.tsx` (new)

## Technical Implementation Details

### PDF Processing Pipeline
```typescript
// Enhanced PDF processing with grade extraction
async function processDualPDFs(
  transcriptFile: File, 
  curriculumFile: File,
  gradeThreshold: string
): Promise<{
  transcriptCourses: Course[],
  curriculumCourses: Course[],
  filteredCourses: Course[]
}> {
  // 1. Extract text from both PDFs
  const transcriptText = await extractTextFromPDF(transcriptFile);
  const curriculumText = await extractTextFromPDF(curriculumFile);
  
  // 2. Parse courses with grades
  const transcriptCourses = await parseTranscriptWithGrades(transcriptText);
  
  // 3. Parse curriculum courses
  const curriculumCourses = await parseCurriculumCourses(curriculumText);
  
  // 4. Filter by grade threshold
  const filteredCourses = filterCoursesByGrade(transcriptCourses, gradeThreshold);
  
  return { transcriptCourses, curriculumCourses, filteredCourses };
}
```

### Grade Filtering System
```typescript
// Grade comparison and filtering
const GRADE_VALUES = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  'F': 0.0
};

function meetsGradeThreshold(grade: string, threshold: string): boolean {
  const gradeValue = GRADE_VALUES[grade] || 0;
  const thresholdValue = GRADE_VALUES[threshold] || 0;
  return gradeValue >= thresholdValue;
}
```

### Enhanced Semantic Matching
```typescript
// Grade-aware semantic matching
async function matchCoursesWithGrades(
  userCourses: Course[],
  curriculumCourses: Course[],
  gradeThreshold: string
): Promise<MatchResult[]> {
  const matches: MatchResult[] = [];
  
  for (const userCourse of userCourses) {
    // Only consider courses meeting grade threshold
    if (!meetsGradeThreshold(userCourse.grade, gradeThreshold)) {
      continue;
    }
    
    // Multi-layer similarity analysis
    const vectorSimilarity = await calculateVectorSimilarity(userCourse, curriculumCourses);
    const tfidfSimilarity = calculateTFIDFSimilarity(userCourse, curriculumCourses);
    const semanticSimilarity = await calculateSemanticSimilarity(userCourse, curriculumCourses);
    
    // Weight by grade performance
    const gradeWeight = GRADE_VALUES[userCourse.grade] / 4.0;
    const weightedSimilarity = (vectorSimilarity + tfidfSimilarity + semanticSimilarity) / 3 * gradeWeight;
    
    matches.push({
      userCourse,
      curriculumCourse: findBestMatch(curriculumCourses, weightedSimilarity),
      similarity: weightedSimilarity,
      grade: userCourse.grade
    });
  }
  
  return matches;
}
```

## UI/UX Design

### Main Interface Layout
```
┌─────────────────────────────────────┐
│  Curriculum Gap Analysis Tool       │
├─────────────────────────────────────┤
│ [Tab 1: Upload PDFs] [Tab 2: Results] │
├─────────────────────────────────────┤
│ Transcript PDF: [Upload] [File Name]   │
│ Course of Study PDF: [Upload] [File Name] │
│ Minimum Grade: [Dropdown: A+, A, B+, B, C+, C] │
│ [Process PDFs] [Clear All]              │
├─────────────────────────────────────┤
│ Progress: [██████████] 100% Complete   │
│ Status: Processing course matching...   │
└─────────────────────────────────────┘
```

### Results Display
```
┌─────────────────────────────────────┐
│ Analysis Results                    │
├─────────────────────────────────────┤
│ Matched Courses (Grade ≥ B)         │
│ ┌─────────────────────────────────┐ │
│ │ Course A → Curriculum A (95%)   │ │
│ │ Course B → Curriculum B (87%)   │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Missing Requirements                │
│ ┌─────────────────────────────────┐ │
│ │ Core Course X (Semester 3)      │ │
│ │ Core Course Y (Semester 4)      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Recommendations                     │
│ ┌─────────────────────────────────┐ │
│ │ • Take Core Course X next       │ │
│ │ • Consider Course Y for electives│ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Testing Strategy

### Unit Tests
- PDF text extraction accuracy
- Grade parsing and filtering
- Course matching algorithms
- Database operations

### Integration Tests
- End-to-end PDF processing
- AI analysis pipeline
- User workflow validation

### Performance Tests
- Large PDF processing times
- Memory usage optimization
- Concurrent user handling

## Deployment Considerations

### Environment Variables
```env
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-large
OPENAI_API_VERSION=2025-01-01-preview
MAX_FILE_SIZE=10485760  # 10MB
MAX_PROCESSING_TIME=300000  # 5 minutes
```

### Performance Optimizations
- Implement caching for embeddings
- Use batch processing for multiple courses
- Optimize PDF processing with worker threads
- Add progress indicators for long operations

## Success Metrics

### Technical Metrics
- PDF processing accuracy: >95%
- Grade extraction accuracy: >90%
- Course matching precision: >85%
- Processing time: <30 seconds per PDF

### User Experience Metrics
- User completion rate: >80%
- Error rate: <5%
- User satisfaction: >4.5/5

## Risk Mitigation

### Technical Risks
1. **PDF Processing Failures**
   - Implement fallback OCR methods
   - Add comprehensive error handling
   - Provide manual course entry option

2. **Grade Parsing Errors**
   - Support multiple grade formats
   - Add grade validation and correction
   - Allow manual grade entry

3. **AI Analysis Limitations**
   - Implement confidence scoring
   - Add manual override options
   - Provide detailed matching explanations

### User Experience Risks
1. **Complex Interface**
   - Progressive disclosure of features
   - Clear onboarding flow
   - Comprehensive help documentation

2. **Processing Delays**
   - Real-time progress indicators
   - Background processing
   - Email notifications for completion

## Future Enhancements

### Phase 5: Advanced Features (Future)
- Multi-institution support
- Advanced analytics dashboard
- Course recommendation engine
- Integration with academic systems
- Mobile application
- API access for third-party tools

## Conclusion

This implementation plan provides a comprehensive roadmap for building a sophisticated curriculum gap analysis tool that meets all specified requirements. The phased approach ensures manageable development while delivering value at each stage. The focus on grade-aware analysis and dual PDF processing will provide users with accurate, actionable insights for their academic planning.
