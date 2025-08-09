import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface MatchingResult {
  matchedCourses: Array<{
    title: string;
    description: string;
    grade: string;
    courseOfStudyMatch: {
      originalTranscriptDescription: string;
      courseOfStudyDescription: string;
      courseOfStudyTitle: string;
      courseOfStudyCode: string;
      matchScore: number;
      matchType: string;
    };
  }>;
  unmatchedCourses: Array<{
    title: string;
    description: string;
    grade: string;
    reason: string;
    bestMatch?: {
      courseOfStudyTitle: string;
      similarity: number;
    };
  }>;
  matchingStats: {
    totalTranscriptCourses: number;
    matchedCourses: number;
    unmatchedCourses: number;
    matchingRate: number;
  };
}

export default function TestCourseMatching() {
  const [results, setResults] = useState<MatchingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const testCourseMatching = useMutation(api.courseMatching.matchTranscriptToCourseOfStudy);

  const runTest = async () => {
    setIsLoading(true);
    try {
      // Sample transcript courses (with OCR errors and basic descriptions)
      const sampleTranscriptCourses = [
        {
          title: "Computer Sci Fundamentals", // OCR error: missing "ence"
          description: "Extracted from transcript: Computer Sci Fundamentals",
          grade: "A",
          code: "CS101"
        },
        {
          title: "Data Structure & Algorithm", // OCR error: missing "s"
          description: "Extracted from transcript: Data Structure & Algorithm",
          grade: "B+",
          code: "CS201"
        },
        {
          title: "Math for Engineers", // OCR error: shortened
          description: "Extracted from transcript: Math for Engineers",
          grade: "A-",
          code: "MATH301"
        },
        {
          title: "Database Mgmt Systems", // OCR error: abbreviated
          description: "Extracted from transcript: Database Mgmt Systems",
          grade: "B",
          code: "CS301"
        },
        {
          title: "Network Securty", // OCR error: missing "i"
          description: "Extracted from transcript: Network Securty",
          grade: "A",
          code: "CS401"
        },
        {
          title: "Research Methods", // S grade test - should be rejected
          description: "Research methodology and academic writing",
          grade: "S", // This should be rejected due to S grade
          code: "RES101"
        },
        {
          title: "Machine Learn Intro", // OCR error: shortened
          description: "Extracted from transcript: Machine Learn Intro",
          grade: "A-",
          code: "CS450"
        }
      ];

      // Sample course of study courses (with rich descriptions)
      const sampleCourseOfStudyCourses = [
        {
          code: "CS101",
          title: "Computer Science Fundamentals",
          description: "This comprehensive course introduces students to the fundamental concepts of computer science, including programming paradigms, data representation, algorithmic thinking, and computational problem-solving. Students will learn basic programming concepts, understand how computers process information, and develop critical thinking skills essential for computer science.",
          credits: 4,
          isRequired: true,
          semester: 1
        },
        {
          code: "CS201",
          title: "Data Structures and Algorithms",
          description: "An in-depth study of fundamental data structures including arrays, linked lists, stacks, queues, trees, and graphs. Students will learn to analyze algorithmic complexity, implement efficient algorithms for searching and sorting, and understand the trade-offs between different data structure choices. The course emphasizes both theoretical understanding and practical implementation skills.",
          credits: 4,
          isRequired: true,
          semester: 2
        },
        {
          code: "MATH301",
          title: "Mathematics for Engineers",
          description: "Advanced mathematical concepts essential for engineering applications including linear algebra, differential equations, vector calculus, and numerical methods. Students will learn to apply mathematical tools to solve real-world engineering problems, understand the mathematical foundations underlying engineering principles, and develop proficiency in mathematical modeling and analysis.",
          credits: 3,
          isRequired: true,
          semester: 3
        },
        {
          code: "CS301",
          title: "Database Management Systems",
          description: "Comprehensive coverage of database design principles, relational database theory, SQL programming, and database administration. Students will learn to design normalized database schemas, write complex queries, understand transaction processing and concurrency control, and gain hands-on experience with popular database management systems.",
          credits: 3,
          isRequired: true,
          semester: 4
        },
        {
          code: "CS401",
          title: "Network Security",
          description: "In-depth exploration of computer network security principles, cryptographic protocols, security threats and vulnerabilities, and defense mechanisms. Students will learn about encryption algorithms, digital signatures, secure communication protocols, intrusion detection systems, and security policy development. The course includes practical exercises in security assessment and implementation.",
          credits: 3,
          isRequired: false,
          semester: 5
        },
        {
          code: "RES101",
          title: "Research Methodology",
          description: "Introduction to research methods and academic writing skills essential for conducting scholarly research. Students will learn about research design, data collection and analysis methods, literature review techniques, and academic writing standards. The course emphasizes critical thinking, ethical research practices, and effective communication of research findings.",
          credits: 2,
          isRequired: true,
          semester: 1
        },
        {
          code: "CS450",
          title: "Introduction to Machine Learning",
          description: "Comprehensive introduction to machine learning algorithms and their applications in solving real-world problems. Students will learn about supervised and unsupervised learning techniques, neural networks, deep learning fundamentals, and practical implementation using popular machine learning frameworks. The course includes hands-on projects with real datasets.",
          credits: 4,
          isRequired: false,
          semester: 6
        }
      ];

      const result = await testCourseMatching({
        transcriptCourses: sampleTranscriptCourses,
        courseOfStudyCourses: sampleCourseOfStudyCourses,
        matchingThreshold: 0.3
      });

      setResults(result);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">🔗 Course Matching Test</h2>
        <p className="text-gray-600 mb-4">
          This test demonstrates the new course matching system that matches transcript courses to course of study 
          courses (handling OCR errors) and replaces transcript descriptions with rich course of study descriptions 
          before comparing to Plaksha courses.
        </p>
        
        <button
          onClick={runTest}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {isLoading ? 'Running Test...' : 'Test Course Matching'}
        </button>
      </div>

      {results && (
        <>
          {/* Summary Stats */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📊 Matching Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{results.matchingStats.totalTranscriptCourses}</div>
                <div className="text-sm text-blue-800">Total Courses</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{results.matchingStats.matchedCourses}</div>
                <div className="text-sm text-green-800">Matched & Enhanced</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{results.matchingStats.unmatchedCourses}</div>
                <div className="text-sm text-red-800">Unmatched</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {(results.matchingStats.matchingRate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-purple-800">Success Rate</div>
              </div>
            </div>
          </div>

          {/* Matched Courses with Description Enhancement */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-green-800 mb-4">✅ Matched & Enhanced Courses</h3>
            <div className="space-y-4">
              {results.matchedCourses.map((course, index) => (
                <div key={index} className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{course.title}</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Matched: {course.courseOfStudyMatch.courseOfStudyTitle} ({course.courseOfStudyMatch.courseOfStudyCode})
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-600">
                        {course.courseOfStudyMatch.matchType.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="text-sm text-gray-600">
                        Score: {(course.courseOfStudyMatch.matchScore * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Description Comparison */}
                  <div className="space-y-3 mt-4">
                    <div className="bg-red-100 p-3 rounded border-l-4 border-red-400">
                      <h5 className="text-sm font-semibold text-red-800 mb-1">Original Transcript Description:</h5>
                      <p className="text-sm text-red-700">{course.courseOfStudyMatch.originalTranscriptDescription}</p>
                    </div>
                    <div className="bg-green-100 p-3 rounded border-l-4 border-green-400">
                      <h5 className="text-sm font-semibold text-green-800 mb-1">Enhanced Course of Study Description:</h5>
                      <p className="text-sm text-green-700">{course.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Unmatched Courses */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-red-800 mb-4">❌ Unmatched Courses</h3>
            <div className="space-y-3">
              {results.unmatchedCourses.map((course, index) => (
                <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{course.title}</h4>
                      <p className="text-sm text-red-700 mt-1">{course.reason}</p>
                      {course.bestMatch && (
                        <p className="text-sm text-gray-600 mt-1">
                          Best match: {course.bestMatch.courseOfStudyTitle} ({(course.bestMatch.similarity * 100).toFixed(1)}%)
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-600">UNMATCHED</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🔧 How Course Matching Works</h3>
            <div className="space-y-4 text-gray-700">
              <div>
                <h4 className="font-semibold text-gray-800">1. Extract from Transcript</h4>
                <p className="text-sm">Extract courses from transcript (may have OCR errors and basic descriptions)</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">2. Extract from Course of Study</h4>
                <p className="text-sm">Extract courses from course of study PDF (rich descriptions, official titles)</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">3. Match with OCR Error Handling</h4>
                <p className="text-sm">Match transcript courses to course of study using fuzzy matching to handle OCR errors</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">4. Enhance Descriptions</h4>
                <p className="text-sm">Replace basic transcript descriptions with rich course of study descriptions</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">5. Compare to Plaksha Courses</h4>
                <p className="text-sm">Use enhanced courses (with rich descriptions) for comparison to Plaksha curriculum</p>
              </div>
            </div>
          </div>

          {/* Key Benefits */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🎯 Key Benefits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="text-green-500 mt-1">✅</div>
                  <div>
                    <h4 className="font-semibold text-gray-800">Handles OCR Errors</h4>
                    <p className="text-sm text-gray-600">"Computer Sci Fundamentals" → "Computer Science Fundamentals"</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-green-500 mt-1">✅</div>
                  <div>
                    <h4 className="font-semibold text-gray-800">Rich Descriptions</h4>
                    <p className="text-sm text-gray-600">Replaces basic transcript text with detailed course descriptions</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="text-green-500 mt-1">✅</div>
                  <div>
                    <h4 className="font-semibold text-gray-800">Better Plaksha Matching</h4>
                    <p className="text-sm text-gray-600">Enhanced descriptions improve similarity matching accuracy</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-green-500 mt-1">✅</div>
                  <div>
                    <h4 className="font-semibold text-gray-800">Grade Validation</h4>
                    <p className="text-sm text-gray-600">Still rejects courses with unaccepted grades like "S"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
