import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface CourseExtractorProps {
  dualTranscriptId: string;
  transcriptType?: "dual" | "testing";
}

// Helper: normalize grade and get value
function normalizeGrade(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const g = String(raw).toUpperCase().trim().replace(/\s+/g, "");
  // Map common variants
  const map: Record<string, string> = {
    "A+": "A+", "A": "A", "A-": "A-",
    "B+": "B+", "B": "B", "B-": "B-",
    "C+": "C+", "C": "C", "C-": "C-",
    "D+": "D+", "D": "D", "D-": "D-",
    "F": "F", "FAIL": "F", "P": "D", "PASS": "D",
  };
  return map[g] ?? null;
}

function getGradeValue(grade: string | undefined | null): number | null {
  const norm = normalizeGrade(grade);
  if (!norm) return null;
  const values: Record<string, number> = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
  };
  return values[norm];
}

export function CourseExtractor({ dualTranscriptId, transcriptType = "dual" }: CourseExtractorProps) {
  const dualTranscript = useQuery(
    transcriptType === "testing" 
      ? api.testingTranscripts.getTestingTranscriptByIdPublic
      : api.dualTranscripts.getDualTranscriptByIdPublic, 
    transcriptType === "testing" 
      ? { testingTranscriptId: dualTranscriptId as any }
      : { dualTranscriptId: dualTranscriptId as any }
  );

  if (!dualTranscript) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (dualTranscript.processingStatus === "processing") {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          <h3 className="text-lg font-semibold text-gray-900">Processing Courses...</h3>
        </div>
        <p className="text-gray-600">Extracting and analyzing courses from your PDFs.</p>
      </div>
    );
  }

  if (dualTranscript.processingStatus === "failed") {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 p-6">
        <h3 className="text-lg font-semibold text-red-900 mb-2">Processing Failed</h3>
        <p className="text-red-700">{dualTranscript.errorMessage || "An error occurred during processing."}</p>
      </div>
    );
  }

  if (dualTranscript.processingStatus !== "completed") {
    return null;
  }

  const extractedCourses = dualTranscript.extractedCourses || [];

  // Calculate statistics: transcript courses, total credits, and GPA (based on valid grades only)
  const totalCredits = extractedCourses.reduce((sum, course) => sum + (course.credits || 0), 0);
  const gradeValues: number[] = extractedCourses
    .map(c => getGradeValue(c.grade))
    .filter((v): v is number => v !== null);
  const averageGrade = gradeValues.length > 0
    ? gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length
    : null;
  const stats = {
    transcriptCourses: extractedCourses.length,
    totalCredits,
    averageGrade,
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Transcript Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.transcriptCourses}</div>
            <div className="text-sm text-gray-600">Transcript Courses</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.totalCredits}</div>
            <div className="text-sm text-gray-600">Total Credits</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.averageGrade !== null ? stats.averageGrade.toFixed(2) : "N/A"}</div>
            <div className="text-sm text-gray-600">Avg GPA (unweighted)</div>
          </div>
        </div>
      </div>

      {/* Extracted Transcript Courses */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Matched Courses</h3>
          <p className="text-sm text-gray-600 mt-1">
            {extractedCourses.length} courses found in your transcript
          </p>
        </div>
        <div className="p-6">
          {extractedCourses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No courses found.
            </p>
          ) : (
            <div className="space-y-4">
              {extractedCourses.map((course, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{course.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{course.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        {(course as any).code && (
                          <span className="text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded">
                            {(course as any).code}
                          </span>
                        )}
                        {course.credits && (
                          <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {course.credits} credits
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        normalizeGrade(course.grade) === 'A' || normalizeGrade(course.grade) === 'A+' || normalizeGrade(course.grade) === 'A-'
                          ? 'bg-green-100 text-green-800'
                          : normalizeGrade(course.grade) === 'B' || normalizeGrade(course.grade) === 'B+' || normalizeGrade(course.grade) === 'B-'
                          ? 'bg-blue-100 text-blue-800'
                          : normalizeGrade(course.grade) === 'C' || normalizeGrade(course.grade) === 'C+' || normalizeGrade(course.grade) === 'C-'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {normalizeGrade(course.grade) ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Processing Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Processing Details</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Grade Threshold: {dualTranscript.gradeThreshold}</p>
          <p>• Transcript: {dualTranscript.transcriptFileName}</p>
          <p>• Course of Study: {dualTranscript.courseOfStudyFileName}</p>
          <p>• Processed: {new Date(dualTranscript.uploadDate).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
} 