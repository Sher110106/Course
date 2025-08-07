# Enhanced Course Matching Visibility - Implementation Plan

## Overview
This plan outlines the implementation of detailed course matching visibility for the dual PDF upload feature. Users will be able to click "View Details" for each matched course to see the full descriptions of both courses and highlighted parts that resulted in the match.

## Current State Analysis

### Existing Components
- `DualPDFUploader.tsx`: Main upload interface with "View Details" and "Analyze Gaps" buttons
- `DualAnalysisResults.tsx`: Displays analysis results with basic match information
- `convex/dualAnalysis.ts`: Backend analysis logic with similarity calculations

### Current Data Structure
```typescript
// From dualAnalysis.ts - matched courses structure
matchedCourses: Array<{
  userCourse: string,        // Course title from transcript
  curriculumCourse: string,  // Course title from curriculum
  similarity: number,        // Similarity score (0-1)
  grade: string,            // Student's grade
}>
```

## Requirements

### Core Features
1. **View Details Button**: Add "View Details" button for each matched course
2. **Course Descriptions**: Display full descriptions of both user and curriculum courses
3. **Highlighted Matching Parts**: Show which specific parts of descriptions led to the match
4. **Similarity Breakdown**: Display vector, TF-IDF, and semantic similarity scores
5. **Modal Interface**: Clean modal popup for detailed view

### Technical Requirements
- Enhanced data structure to include full course descriptions
- Similarity analysis breakdown (vector, TF-IDF, semantic)
- Text highlighting algorithm for matching parts
- Modal component for detailed view
- Responsive design for mobile compatibility

## Implementation Plan

### Phase 1: Enhanced Data Structure (Backend)

#### 1.1 Update Dual Analysis Results Structure
**File**: `convex/dualAnalysis.ts`

**Changes**:
```typescript
// Enhanced matched courses structure
matchedCourses: Array<{
  userCourse: string,
  curriculumCourse: string,
  similarity: number,
  grade: string,
  // NEW FIELDS
  userCourseDescription: string,
  curriculumCourseDescription: string,
  similarityBreakdown: {
    vectorScore: number,
    tfidfScore: number,
    semanticScore: number,
  },
  matchingHighlights: {
    userHighlights: string[],    // Highlighted phrases from user course
    curriculumHighlights: string[], // Highlighted phrases from curriculum course
  },
  userCourseCode?: string,
  curriculumCourseCode?: string,
}>
```

#### 1.2 Update Analysis Function
**File**: `convex/dualAnalysis.ts`

**Changes**:
- Modify `analyzeDualTranscript` action to include full course descriptions
- Add similarity breakdown calculation
- Implement text highlighting algorithm
- Return enhanced match data

**Key Functions to Add**:
```typescript
// Calculate similarity breakdown
function calculateSimilarityBreakdown(
  userCourse: any,
  curriculumCourse: any,
  vectorScore: number,
  tfidfScore: number,
  semanticScore: number
): {
  vectorScore: number,
  tfidfScore: number,
  semanticScore: number,
  finalScore: number
}

// Extract matching highlights
function extractMatchingHighlights(
  userDescription: string,
  curriculumDescription: string,
  similarityScore: number
): {
  userHighlights: string[],
  curriculumHighlights: string[]
}

// Highlight matching text parts
function highlightMatchingText(
  text: string,
  keywords: string[]
): string
```

### Phase 2: Frontend Modal Component

#### 2.1 Create Course Details Modal
**File**: `src/components/CourseDetailsModal.tsx`

**Features**:
- Modal popup for detailed course view
- Side-by-side course descriptions
- Highlighted matching parts
- Similarity breakdown visualization
- Responsive design

**Component Structure**:
```typescript
interface CourseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: {
    userCourse: string;
    curriculumCourse: string;
    similarity: number;
    grade: string;
    userCourseDescription: string;
    curriculumCourseDescription: string;
    similarityBreakdown: {
      vectorScore: number;
      tfidfScore: number;
      semanticScore: number;
    };
    matchingHighlights: {
      userHighlights: string[];
      curriculumHighlights: string[];
    };
  };
}
```

#### 2.2 Modal UI Design
```
┌─────────────────────────────────────────────────────────┐
│ Course Match Details                    [X] Close      │
├─────────────────────────────────────────────────────────┤
│ User Course: "Introduction to Computer Science" (A)   │
│ Curriculum Course: "CS 101: Computer Science I"       │
│                                                       │
│ ┌─────────────────┐  ┌─────────────────┐             │
│ │ User Course     │  │ Curriculum      │             │
│ │ Description     │  │ Description     │             │
│ │                 │  │                 │             │
│ │ This course     │  │ This course     │             │
│ │ covers [HIGHLIGHT]programming[HIGHLIGHT] │  │ covers [HIGHLIGHT]programming[HIGHLIGHT] │             │
│ │ fundamentals... │  │ fundamentals... │             │
│ └─────────────────┘  └─────────────────┘             │
│                                                       │
│ Similarity Breakdown:                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐                 │
│ │ Vector  │ │ TF-IDF  │ │Semantic │                 │
│ │  85%    │ │  78%    │ │  92%    │                 │
│ └─────────┘ └─────────┘ └─────────┘                 │
│                                                       │
│ Overall Match: 87.5%                                  │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: Update Dual Analysis Results Component

#### 3.1 Enhance Matched Courses Display
**File**: `src/components/DualAnalysisResults.tsx`

**Changes**:
- Add "View Details" button to each matched course
- Integrate CourseDetailsModal component
- Handle modal state management
- Pass enhanced match data to modal

**Updated Match Display**:
```typescript
{analysisResults.matchedCourses.map((match: any, index: number) => (
  <div key={index} className="border border-gray-200 rounded-lg p-4">
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="font-medium text-gray-900">{match.userCourse}</h4>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {match.grade}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Matches: <span className="font-medium">{match.curriculumCourse}</span>
        </p>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
            {(match.similarity * 100).toFixed(1)}% match
          </span>
          {/* NEW: View Details Button */}
          <button
            onClick={() => setSelectedMatch(match)}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium"
          >
            View Details →
          </button>
        </div>
      </div>
    </div>
  </div>
))}
```

#### 3.2 Add Modal Integration
```typescript
// Add state for modal
const [selectedMatch, setSelectedMatch] = useState<any>(null);

// Add modal component
{selectedMatch && (
  <CourseDetailsModal
    isOpen={!!selectedMatch}
    onClose={() => setSelectedMatch(null)}
    match={selectedMatch}
  />
)}
```

### Phase 4: Text Highlighting Algorithm

#### 4.1 Implement Highlighting Logic
**File**: `convex/dualAnalysis.ts`

**Algorithm**:
1. Extract key terms from both descriptions
2. Find overlapping terms/phrases
3. Calculate term importance based on TF-IDF
4. Highlight most significant matching terms
5. Return highlighted text with HTML markup

**Implementation**:
```typescript
function extractMatchingHighlights(
  userDescription: string,
  curriculumDescription: string,
  similarityScore: number
): {
  userHighlights: string[],
  curriculumHighlights: string[]
} {
  // 1. Tokenize both descriptions
  const userTokens = tokenizeText(userDescription);
  const curriculumTokens = tokenizeText(curriculumDescription);
  
  // 2. Find overlapping terms
  const overlappingTerms = findOverlappingTerms(userTokens, curriculumTokens);
  
  // 3. Calculate term importance
  const importantTerms = calculateTermImportance(overlappingTerms, similarityScore);
  
  // 4. Extract phrases containing important terms
  const userHighlights = extractHighlightedPhrases(userDescription, importantTerms);
  const curriculumHighlights = extractHighlightedPhrases(curriculumDescription, importantTerms);
  
  return { userHighlights, curriculumHighlights };
}

function highlightText(text: string, highlights: string[]): string {
  let highlightedText = text;
  
  for (const highlight of highlights) {
    const regex = new RegExp(`(${highlight})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  }
  
  return highlightedText;
}
```

### Phase 5: Enhanced Similarity Visualization

#### 5.1 Create Similarity Breakdown Component
**File**: `src/components/SimilarityBreakdown.tsx`

**Features**:
- Visual representation of similarity scores
- Progress bars for each similarity type
- Color-coded indicators
- Tooltips with explanations

**Component**:
```typescript
interface SimilarityBreakdownProps {
  vectorScore: number;
  tfidfScore: number;
  semanticScore: number;
  finalScore: number;
}

export function SimilarityBreakdown({
  vectorScore,
  tfidfScore,
  semanticScore,
  finalScore
}: SimilarityBreakdownProps) {
  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">Similarity Breakdown</h4>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Vector Similarity</span>
          <span className="text-sm font-medium">{(vectorScore * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${vectorScore * 100}%` }}
          />
        </div>
      </div>
      
      {/* Repeat for TF-IDF and Semantic */}
    </div>
  );
}
```

## Technical Implementation Details

### Backend Changes

#### 1. Enhanced Analysis Function
```typescript
// In convex/dualAnalysis.ts
export const analyzeDualTranscript = action({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
    targetSemester: v.number(),
  },
  handler: async (ctx, args) => {
    // ... existing logic ...
    
    // Enhanced match creation
    for (const [userCourseTitle, match] of userCourseMatches) {
      const userCourse = dualTranscript.extractedCourses.find(c => c.title === userCourseTitle);
      if (userCourse) {
        // Extract matching highlights
        const highlights = extractMatchingHighlights(
          userCourse.description,
          match.curriculumCourse.description,
          match.finalScore
        );
        
        // Calculate similarity breakdown
        const breakdown = calculateSimilarityBreakdown(
          userCourse,
          match.curriculumCourse,
          match.vectorScore,
          match.tfidfScore,
          match.semanticScore
        );
        
        matchedCourses.push({
          userCourse: userCourse.title,
          curriculumCourse: match.curriculumCourse.title,
          similarity: match.finalScore,
          grade: userCourse.grade,
          // NEW FIELDS
          userCourseDescription: userCourse.description,
          curriculumCourseDescription: match.curriculumCourse.description,
          similarityBreakdown: breakdown,
          matchingHighlights: highlights,
          userCourseCode: userCourse.code,
          curriculumCourseCode: match.curriculumCourse.code,
        });
      }
    }
    
    // ... rest of function ...
  },
});
```

#### 2. Text Processing Utilities
```typescript
// Text processing helper functions
function tokenizeText(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

function findOverlappingTerms(tokens1: string[], tokens2: string[]): string[] {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  return Array.from(set1).filter(token => set2.has(token));
}

function calculateTermImportance(terms: string[], similarityScore: number): string[] {
  // Filter terms based on similarity score and term frequency
  return terms.filter(term => {
    const frequency = terms.filter(t => t === term).length;
    return frequency > 1 && similarityScore > 0.5;
  });
}
```

### Frontend Changes

#### 1. Modal Component Implementation
```typescript
// src/components/CourseDetailsModal.tsx
import React from 'react';
import { SimilarityBreakdown } from './SimilarityBreakdown';

export function CourseDetailsModal({ isOpen, onClose, match }: CourseDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Course Match Details</h2>
              <p className="text-sm text-gray-600 mt-1">
                {(match.similarity * 100).toFixed(1)}% similarity match
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Course Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Your Course</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">{match.userCourse}</h4>
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 mt-2">
                  Grade: {match.grade}
                </span>
                <div 
                  className="mt-3 text-sm text-gray-700"
                  dangerouslySetInnerHTML={{ 
                    __html: highlightText(match.userCourseDescription, match.matchingHighlights.userHighlights) 
                  }}
                />
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Curriculum Course</h3>
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">{match.curriculumCourse}</h4>
                {match.curriculumCourseCode && (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                    {match.curriculumCourseCode}
                  </span>
                )}
                <div 
                  className="mt-3 text-sm text-gray-700"
                  dangerouslySetInnerHTML={{ 
                    __html: highlightText(match.curriculumCourseDescription, match.matchingHighlights.curriculumHighlights) 
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Similarity Breakdown */}
          <SimilarityBreakdown
            vectorScore={match.similarityBreakdown.vectorScore}
            tfidfScore={match.similarityBreakdown.tfidfScore}
            semanticScore={match.similarityBreakdown.semanticScore}
            finalScore={match.similarity}
          />
        </div>
      </div>
    </div>
  );
}
```

## Testing Strategy

### Unit Tests
- Text highlighting algorithm accuracy
- Similarity breakdown calculations
- Modal component functionality
- Data structure validation

### Integration Tests
- End-to-end course matching with details
- Modal opening/closing behavior
- Data flow from backend to frontend

### User Experience Tests
- Modal responsiveness on mobile
- Highlighting visibility and readability
- Similarity breakdown clarity

## Success Metrics

### Technical Metrics
- Text highlighting accuracy: >90%
- Modal load time: <500ms
- Similarity breakdown accuracy: >95%

### User Experience Metrics
- User engagement with "View Details": >60%
- Time spent viewing details: >30 seconds
- User satisfaction with detailed view: >4.5/5

## Risk Mitigation

### Technical Risks
1. **Text Highlighting Performance**
   - Implement efficient regex patterns
   - Cache highlighted results
   - Limit highlight count to prevent UI clutter

2. **Modal Responsiveness**
   - Test on various screen sizes
   - Implement mobile-first design
   - Add touch-friendly interactions

3. **Data Structure Complexity**
   - Validate data at each step
   - Add fallback for missing data
   - Implement graceful degradation

### User Experience Risks
1. **Information Overload**
   - Progressive disclosure of details
   - Clear visual hierarchy
   - Intuitive navigation

2. **Performance Impact**
   - Lazy load modal content
   - Optimize image and text rendering
   - Implement loading states

## Future Enhancements

### Phase 6: Advanced Features (Future)
- Course prerequisite chain visualization
- Historical grade trends analysis
- Course difficulty assessment
- Personalized study recommendations
- Export detailed analysis to PDF

## Implementation Timeline

### Week 1: Backend Enhancement
- Update data structures
- Implement highlighting algorithm
- Add similarity breakdown
- Update analysis function

### Week 2: Frontend Components
- Create CourseDetailsModal component
- Implement SimilarityBreakdown component
- Update DualAnalysisResults component
- Add modal state management

### Week 3: Integration & Testing
- Integrate all components
- Test end-to-end functionality
- Optimize performance
- Add error handling

### Week 4: Polish & Deploy
- UI/UX refinements
- Mobile responsiveness
- Performance optimization
- Documentation updates

## Conclusion

This implementation plan provides a comprehensive approach to adding detailed course matching visibility to the dual PDF upload feature. The enhanced functionality will give users deep insights into how their courses match with curriculum requirements, improving transparency and trust in the AI-powered analysis system.

The phased approach ensures manageable development while delivering value at each stage. The focus on user experience, performance, and maintainability will result in a robust and user-friendly feature that enhances the overall curriculum gap analysis tool.
