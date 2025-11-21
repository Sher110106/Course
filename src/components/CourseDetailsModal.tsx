import React from 'react';

interface CourseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: {
    userCourse: string;
    curriculumCourse: string;
    similarity: number;
    grade: string;
    userCourseDescription?: string;
    curriculumCourseDescription?: string;
    similarityBreakdown?: {
      vectorScore: number;
      tfidfScore: number;
      semanticScore: number;
    };
    matchingHighlights?: {
      userHighlights: string[];
      curriculumHighlights: string[];
    };
    userCourseCode?: string;
    curriculumCourseCode?: string;
  };
}

// Helper function to highlight text with matching terms
function highlightText(text: string, highlights: string[]): string {
  if (!text || !highlights || highlights.length === 0) {
    return text;
  }
  
  let highlightedText = text;
  
  for (const highlight of highlights) {
    if (highlight.trim()) {
      const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
    }
  }
  
  return highlightedText;
}

export function CourseDetailsModal({ isOpen, onClose, match }: CourseDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Course Match Details</h2>
              <p className="text-sm text-gray-600 mt-1">
                {(match.similarity * 100).toFixed(1)}% similarity match
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Course Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Course */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Your Course</h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{match.userCourse}</h4>
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                    Grade: {match.grade}
                  </span>
                </div>
                {match.userCourseCode && (
                  <p className="text-sm text-gray-600 mb-3">Code: {match.userCourseCode}</p>
                )}
                <div 
                  className="text-sm text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: highlightText(
                      match.userCourseDescription || "No description available", 
                      match.matchingHighlights?.userHighlights || []
                    ) 
                  }}
                />
              </div>
            </div>
            
            {/* Curriculum Course */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Curriculum Course</h3>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{match.curriculumCourse}</h4>
                  {match.curriculumCourseCode && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {match.curriculumCourseCode}
                    </span>
                  )}
                </div>
                <div 
                  className="text-sm text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: highlightText(
                      match.curriculumCourseDescription || "No description available", 
                      match.matchingHighlights?.curriculumHighlights || []
                    ) 
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Similarity Breakdown */}
          {match.similarityBreakdown && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-medium text-gray-900 mb-4">Similarity Breakdown</h4>
              
              <div className="space-y-4">
                {/* Vector Similarity */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Vector Similarity</span>
                    <span className="text-sm font-medium">{(match.similarityBreakdown.vectorScore * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${match.similarityBreakdown.vectorScore * 100}%` }}
                    />
                  </div>
                </div>
                
                {/* TF-IDF Similarity */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">TF-IDF Similarity</span>
                    <span className="text-sm font-medium">{(match.similarityBreakdown.tfidfScore * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${match.similarityBreakdown.tfidfScore * 100}%` }}
                    />
                  </div>
                </div>
                
                {/* Semantic Similarity */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Semantic Similarity</span>
                    <span className="text-sm font-medium">{(match.similarityBreakdown.semanticScore * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${match.similarityBreakdown.semanticScore * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Overall Score */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Overall Match</span>
                  <span className="text-lg font-bold text-purple-600">{(match.similarity * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Matching Highlights */}
          {match.matchingHighlights && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-medium text-gray-900 mb-4">Full Descriptions with Matching Terms Highlighted</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User Course Full Description */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Your Course Description</h5>
                  <div className="bg-gray-50 p-3 rounded border-l-2 border-blue-500">
                    <div 
                      className="text-sm text-gray-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightText(
                          match.userCourseDescription || "No description available", 
                          match.matchingHighlights.userHighlights || []
                        ) 
                      }}
                    />
                  </div>
                </div>
                
                {/* Curriculum Course Full Description */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Curriculum Course Description</h5>
                  <div className="bg-blue-50 p-3 rounded border-l-2 border-green-500">
                    <div 
                      className="text-sm text-gray-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightText(
                          match.curriculumCourseDescription || "No description available", 
                          match.matchingHighlights.curriculumHighlights || []
                        ) 
                      }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Matching Terms List */}
              {match.matchingHighlights.userHighlights.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Key Matching Terms</h5>
                  <div className="flex flex-wrap gap-2">
                    {match.matchingHighlights.userHighlights.map((term, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
