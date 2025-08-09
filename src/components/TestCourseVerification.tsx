import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface VerificationResult {
  verificationResults: {
    verifiedCourses: Array<{
      title: string;
      verification: {
        isVerified: boolean;
        matchedCurriculumCourse?: string;
        verificationScore: number;
        matchType: string;
      };
    }>;
    rejectedCourses: Array<{
      title: string;
      rejectionReason: string;
      bestMatch?: {
        curriculumCourse: string;
        similarity: number;
      };
    }>;
    verificationStats: {
      totalCourses: number;
      verifiedCourses: number;
      rejectedCourses: number;
      verificationRate: number;
    };
  };
  testSummary: {
    totalTested: number;
    verified: number;
    rejected: number;
    verificationRate: number;
    exampleRejections: string[];
  };
}

export default function TestCourseVerification() {
  const [results, setResults] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const testCourseVerification = useMutation(api.courseVerification.testCourseVerification);

  const runTest = async () => {
    setIsLoading(true);
    try {
      // Sample transcript courses (including problematic ones like "Tech in Computer")
      const sampleTranscriptCourses = [
        {
          title: "Computer Science Fundamentals",
          description: "Introduction to programming and computer science concepts",
          grade: "A",
          code: "CS101"
        },
        {
          title: "Data Structures and Algorithms",
          description: "Study of fundamental data structures and algorithmic techniques",
          grade: "B+",
          code: "CS201"
        },
        {
          title: "Tech in Computer", // This should be rejected
          description: "Extracted from transcript: Tech in Computer",
          grade: "B",
        },
        {
          title: "Page 2", // This should be rejected
          description: "Extracted from transcript: Page 2",
          grade: "A",
        },
        {
          title: "Mathematics for Engineers",
          description: "Advanced mathematical concepts for engineering applications",
          grade: "A-",
          code: "MATH301"
        },
        {
          title: "Database Systems",
          description: "Design and implementation of database management systems",
          grade: "B",
          code: "CS301"
        },
        {
          title: "Network Security",
          description: "Principles of computer network security and cryptography",
          grade: "A",
          code: "CS401"
        },
        {
          title: "Software Engineering", // Partial match test
          description: "Software development methodologies and project management",
          grade: "B+",
          code: "CS350"
        },
        {
          title: "Total Credits: 24", // This should be rejected
          description: "Extracted from transcript: Total Credits: 24",
          grade: "A",
        },
        {
          title: "Machine Learning Basics", // Close match test
          description: "Introduction to machine learning algorithms and applications",
          grade: "A-",
          code: "CS450"
        },
        {
          title: "Research Methods", // S grade test - should be rejected
          description: "Research methodology and academic writing",
          grade: "S", // This should be rejected due to S grade
          code: "RES101"
        }
      ];

      // Sample curriculum courses (official course list)
      const sampleCurriculumCourses = [
        {
          code: "CS101",
          title: "Introduction to Computer Science",
          description: "Fundamentals of computer science and programming",
          isRequired: true
        },
        {
          code: "CS201",
          title: "Data Structures and Algorithms",
          description: "Study of data structures and algorithmic design",
          isRequired: true
        },
        {
          code: "MATH301",
          title: "Engineering Mathematics",
          description: "Mathematical methods for engineering applications",
          isRequired: true
        },
        {
          code: "CS301",
          title: "Database Management Systems",
          description: "Database design, implementation, and management",
          isRequired: true
        },
        {
          code: "CS401",
          title: "Computer Network Security",
          description: "Network security protocols and cryptographic methods",
          isRequired: false
        },
        {
          code: "CS350",
          title: "Software Engineering Principles",
          description: "Software development lifecycle and engineering practices",
          isRequired: true
        },
        {
          code: "CS450",
          title: "Introduction to Machine Learning",
          description: "Machine learning algorithms and their applications",
          isRequired: false
        },
        {
          code: "CS502",
          title: "Advanced Algorithms",
          description: "Advanced algorithmic techniques and complexity analysis",
          isRequired: false
        },
        {
          code: "RES101",
          title: "Research Methodology",
          description: "Introduction to research methods and academic writing",
          isRequired: true
        }
      ];

      const result = await testCourseVerification({
        sampleTranscriptCourses,
        sampleCurriculumCourses
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
        <h2 className="text-2xl font-bold text-gray-800 mb-4">🔍 Course Verification Test</h2>
        <p className="text-gray-600 mb-4">
          This test demonstrates the course verification system that cross-references extracted transcript courses 
          against the official curriculum to filter out invalid courses like "Tech in Computer" and reject courses 
          with unaccepted grades like "S".
        </p>
        
        <button
          onClick={runTest}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {isLoading ? 'Running Test...' : 'Test Course Verification'}
        </button>
      </div>

      {results && (
        <>
          {/* Summary Stats */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📊 Verification Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{results.testSummary.totalTested}</div>
                <div className="text-sm text-blue-800">Total Courses</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{results.testSummary.verified}</div>
                <div className="text-sm text-green-800">Verified</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{results.testSummary.rejected}</div>
                <div className="text-sm text-red-800">Rejected</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {(results.testSummary.verificationRate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-purple-800">Success Rate</div>
              </div>
            </div>
          </div>

          {/* Verified Courses */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-green-800 mb-4">✅ Verified Courses</h3>
            <div className="space-y-3">
              {results.verificationResults.verifiedCourses.map((course, index) => (
                <div key={index} className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{course.title}</h4>
                      {course.verification.matchedCurriculumCourse && (
                        <p className="text-sm text-green-700 mt-1">
                          Matched: {course.verification.matchedCurriculumCourse}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-600">
                        {course.verification.matchType.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="text-sm text-gray-600">
                        Score: {(course.verification.verificationScore * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rejected Courses */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-red-800 mb-4">❌ Rejected Courses</h3>
            <div className="space-y-3">
              {results.verificationResults.rejectedCourses.map((course, index) => (
                <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{course.title}</h4>
                      <p className="text-sm text-red-700 mt-1">{course.rejectionReason}</p>
                      {course.bestMatch && (
                        <p className="text-sm text-gray-600 mt-1">
                          Best match: {course.bestMatch.curriculumCourse} ({(course.bestMatch.similarity * 100).toFixed(1)}%)
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-600">REJECTED</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Example Rejections */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🔍 Key Rejections</h3>
            <div className="space-y-2">
              {results.testSummary.exampleRejections.map((rejection, index) => (
                <div key={index} className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                  {rejection}
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🔧 How Course Verification Works</h3>
            <div className="space-y-4 text-gray-700">
              <div>
                <h4 className="font-semibold text-gray-800">1. Exact Code Matching</h4>
                <p className="text-sm">Matches courses by exact course codes (e.g., CS101 → CS101)</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">2. Exact Title Matching</h4>
                <p className="text-sm">Matches courses by identical titles after normalization</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">3. Fuzzy Title Matching</h4>
                <p className="text-sm">Uses similarity algorithms to match similar course titles</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">4. Partial Keyword Matching</h4>
                <p className="text-sm">Matches based on key terms and concepts in course titles</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">5. Grade Validation</h4>
                <p className="text-sm">Rejects courses with unaccepted grades (e.g., "S" grades are not accepted)</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">6. Invalid Pattern Detection</h4>
                <p className="text-sm">Filters out headers, metadata, page numbers, and non-course content</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
