import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface CourseExtractorProps {
  dualTranscriptId: string;
}

// Helper function to get grade value
function getGradeValue(grade: string): number {
  const GRADE_VALUES = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
  } as const;
  
  return GRADE_VALUES[grade as keyof typeof GRADE_VALUES] || 0;
}

export function CourseExtractor({ dualTranscriptId }: CourseExtractorProps) {
  const dualTranscript = useQuery(api.dualTranscripts.getDualTranscriptByIdPublic, {
    dualTranscriptId: dualTranscriptId as any,
  });

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
  const curriculumCourses = dualTranscript.curriculumCourses || [];

  // Calculate statistics locally
  const totalCredits = extractedCourses.reduce((sum, course) => sum + (course.credits || 0), 0);
  const requiredCourses = curriculumCourses.filter(course => course.isRequired).length;
  const electiveCourses = curriculumCourses.filter(course => !course.isRequired).length;
  const averageGrade = extractedCourses.length > 0 
    ? extractedCourses.reduce((sum, course) => {
        const gradeValue = getGradeValue(course.grade);
        return sum + gradeValue;
      }, 0) / extractedCourses.length
    : 0;

  const stats = {
    transcriptCourses: extractedCourses.length,
    curriculumCourses: curriculumCourses.length,
    totalCredits,
    requiredCourses,
    electiveCourses,
    averageGrade,
  };

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Extraction Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.transcriptCourses}</div>
            <div className="text-sm text-gray-600">Transcript Courses</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.curriculumCourses}</div>
            <div className="text-sm text-gray-600">Curriculum Courses</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.totalCredits}</div>
            <div className="text-sm text-gray-600">Total Credits</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.averageGrade.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Avg GPA</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600">{stats.requiredCourses}</div>
            <div className="text-sm text-gray-600">Required Courses</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-yellow-600">{stats.electiveCourses}</div>
            <div className="text-sm text-gray-600">Elective Courses</div>
          </div>
        </div>
      </div>

      {/* Extracted Transcript Courses */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Extracted Courses (Grade ≥ {dualTranscript.gradeThreshold})
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {extractedCourses.length} courses found in your transcript
          </p>
        </div>
        <div className="p-6">
          {extractedCourses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No courses found that meet the grade threshold of {dualTranscript.gradeThreshold}
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
                        {course.credits && (
                          <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {course.credits} credits
                          </span>
                        )}
                        {course.semester && (
                          <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                            {course.semester}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        course.grade === 'A' || course.grade === 'A+' || course.grade === 'A-' 
                          ? 'bg-green-100 text-green-800'
                          : course.grade === 'B' || course.grade === 'B+' || course.grade === 'B-'
                          ? 'bg-blue-100 text-blue-800'
                          : course.grade === 'C' || course.grade === 'C+' || course.grade === 'C-'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {course.grade}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Curriculum Courses */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Curriculum Requirements
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {curriculumCourses.length} courses found in the curriculum
          </p>
        </div>
        <div className="p-6">
          {curriculumCourses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No curriculum courses found in the course of study document
            </p>
          ) : (
            <div className="space-y-4">
              {curriculumCourses.map((course, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{course.title}</h4>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          course.isRequired 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {course.isRequired ? 'Required' : 'Elective'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{course.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        {course.credits && (
                          <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {course.credits} credits
                          </span>
                        )}
                        {course.semester && (
                          <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                            Semester {course.semester}
                          </span>
                        )}
                        <span className="text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded">
                          {course.code}
                        </span>
                      </div>
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