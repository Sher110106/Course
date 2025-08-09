import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function TestEnhancedExtraction() {
  const [testResults, setTestResults] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  
  const testEnhancedExtraction = useMutation(api.testEnhancedExtraction.testEnhancedExtraction);
  const testPatternMatching = useMutation(api.testEnhancedExtraction.testPatternMatching);
  const testGradeValidation = useMutation(api.testEnhancedExtraction.testGradeValidation);

  const sampleTranscriptText = `
CS101 - Introduction to Computer Science (3 credits) A
MATH201 - Calculus I (4 credits) B+
PHYS101 - Physics Fundamentals (3 credits) A-
ENG101 - English Composition (3 credits) B
CHEM101 - General Chemistry (4 credits) A
CS201 - Data Structures (3 credits) B+
MATH202 - Calculus II (4 credits) A
PHYS102 - Physics Lab (2 credits) B-
ENG102 - Advanced Writing (3 credits) A
CHEM102 - Organic Chemistry (4 credits) B+
CS301 - Algorithms (3 credits) A
MATH301 - Linear Algebra (3 credits) B
PHYS201 - Modern Physics (4 credits) A-
ENG201 - Literature Analysis (3 credits) B+
CHEM201 - Biochemistry (4 credits) A
CS401 - Software Engineering (3 credits) B+
  `;

  const sampleGrades = ["A", "A+", "A-", "B", "B+", "B-", "C", "C+", "C-", "D", "D+", "D-", "F", "P", "S", "U", "I", "W"];

  const handleTestExtraction = async () => {
    setIsTesting(true);
    try {
      const results = await testEnhancedExtraction({
        testTranscriptText: sampleTranscriptText,
        expectedCourseCount: 16,
        gradeThreshold: "B",
      });
      
      setTestResults(results);
      
      if (results.passed) {
        toast.success(`Test passed! Extracted ${results.extractedCount}/${results.expectedCount} courses with ${(results.gradeSuccessRate * 100).toFixed(1)}% grade accuracy.`);
      } else {
        toast.error(`Test failed! Only extracted ${results.extractedCount}/${results.expectedCount} courses.`);
      }
    } catch (error) {
      console.error("Test failed:", error);
      toast.error(`Test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestPatterns = async () => {
    setIsTesting(true);
    try {
      const testLines = [
        "CS101 - Introduction to Computer Science (3 credits) A",
        "MATH201 Calculus I B+",
        "PHYS101 - Physics Fundamentals A-",
        "1. English Composition B",
        "CS201 Data Structures and Algorithms B+",
      ];
      
      const results = await testPatternMatching({
        testLines,
      });
      
      console.log("Pattern test results:", results);
      toast.success(`Pattern test completed! Check console for details.`);
    } catch (error) {
      console.error("Pattern test failed:", error);
      toast.error(`Pattern test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestGrades = async () => {
    setIsTesting(true);
    try {
      const results = await testGradeValidation({
        testGrades: sampleGrades,
        threshold: "B",
      });
      
      console.log("Grade test results:", results);
      toast.success(`Grade test completed! Check console for details.`);
    } catch (error) {
      console.error("Grade test failed:", error);
      toast.error(`Grade test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Enhanced Course Extraction</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Sample Transcript</h4>
            <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto max-h-40">
              {sampleTranscriptText}
            </pre>
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={handleTestExtraction}
              disabled={isTesting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isTesting ? "Testing..." : "Test Enhanced Extraction"}
            </button>
            
            <button
              onClick={handleTestPatterns}
              disabled={isTesting}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isTesting ? "Testing..." : "Test Pattern Matching"}
            </button>
            
            <button
              onClick={handleTestGrades}
              disabled={isTesting}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {isTesting ? "Testing..." : "Test Grade Validation"}
            </button>
          </div>
        </div>
      </div>

      {testResults && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{testResults.extractedCount}</div>
              <div className="text-sm text-gray-600">Extracted Courses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{testResults.expectedCount}</div>
              <div className="text-sm text-gray-600">Expected Courses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{(testResults.successRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{(testResults.gradeSuccessRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Grade Accuracy</div>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-2">Extracted Courses</h4>
            <div className="space-y-2 max-h-60 overflow-auto">
              {testResults.courses.map((course: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{course.title}</span>
                    <span className="text-sm text-gray-600 ml-2">({course.extractionMethod})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                      {course.grade}
                    </span>
                    <span className="text-xs text-gray-500">{(course.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-2">Grade Normalization Results</h4>
            <div className="space-y-2 max-h-40 overflow-auto">
              {testResults.gradeResults.map((result: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-medium">{result.originalGrade}</span>
                  <span className="text-gray-600">→</span>
                  <span className="font-medium">{result.normalizedGrade}</span>
                  <span className="text-gray-500">({result.numericValue})</span>
                  <span className={`text-xs px-2 py-1 rounded ${result.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {result.isValid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={`text-center p-4 rounded ${testResults.passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <span className="font-medium">
              {testResults.passed ? '✅ Test Passed' : '❌ Test Failed'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}




