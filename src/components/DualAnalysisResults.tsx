import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface DualAnalysisResultsProps {
  dualTranscriptId: string;
  onAnalysisComplete?: (results: any) => void;
}

export function DualAnalysisResults({ dualTranscriptId, onAnalysisComplete }: DualAnalysisResultsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [targetSemester, setTargetSemester] = useState<number>(5);

  const analyzeDualTranscript = useAction(api.dualAnalysis.analyzeDualTranscript);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const results = await analyzeDualTranscript({
        dualTranscriptId: dualTranscriptId as any,
        targetSemester,
      });

      setAnalysisResults(results);
      onAnalysisComplete?.(results);
      toast.success(`Analysis complete! Found ${results.totalMatched} matches and ${results.totalGaps} gaps.`);
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : "Please try again."}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (analysisResults) {
    return (
      <div className="space-y-6">
        {/* Analysis Summary */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{analysisResults.totalUserCourses}</div>
              <div className="text-sm text-gray-600">User Courses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{analysisResults.totalMatched}</div>
              <div className="text-sm text-gray-600">Matched Courses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{analysisResults.totalGaps}</div>
              <div className="text-sm text-gray-600">Gap Courses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{targetSemester}</div>
              <div className="text-sm text-gray-600">Target Semester</div>
            </div>
          </div>
        </div>

        {/* Matched Courses */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              Matched Courses
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {analysisResults.matchedCourses.length} courses successfully matched
            </p>
          </div>
          <div className="p-6">
            {analysisResults.matchedCourses.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No courses were matched. This could indicate a mismatch between your transcript and the curriculum.
              </p>
            ) : (
              <div className="space-y-4">
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
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Gap Courses */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              Missing Requirements
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {analysisResults.gapCourses.length} courses still needed
            </p>
          </div>
          <div className="p-6">
            {analysisResults.gapCourses.length === 0 ? (
              <p className="text-green-600 text-center py-8">
                🎉 Congratulations! You have completed all required courses for this curriculum.
              </p>
            ) : (
              <div className="space-y-4">
                {analysisResults.gapCourses.map((gap: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{gap.title}</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            gap.priority === "high" 
                              ? 'bg-red-100 text-red-800' 
                              : gap.priority === "medium"
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {gap.priority === "high" ? "Required" : gap.priority === "medium" ? "Important" : "Elective"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{gap.description}</p>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded">
                            {gap.code}
                          </span>
                          {gap.semester && (
                            <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                              Semester {gap.semester}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              Recommendations
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Personalized suggestions based on your academic background
            </p>
          </div>
          <div className="p-6">
            {analysisResults.recommendations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No specific recommendations available at this time.
              </p>
            ) : (
              <div className="space-y-4">
                {analysisResults.recommendations.map((rec: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                        rec.type === "core" 
                          ? 'bg-red-500' 
                          : rec.type === "elective"
                          ? 'bg-blue-500'
                          : 'bg-green-500'
                      }`}>
                        {rec.type === "core" ? "C" : rec.type === "elective" ? "E" : "P"}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {rec.type === "core" ? "Core Requirement" : 
                           rec.type === "elective" ? "Elective Suggestion" : "Prerequisite"}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">{rec.message}</p>
                        {rec.courses.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {rec.courses.slice(0, 3).map((course: string, courseIndex: number) => (
                              <span key={courseIndex} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                {course}
                              </span>
                            ))}
                            {rec.courses.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{rec.courses.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Re-analyze Button */}
        <div className="text-center">
          <button
            onClick={() => setAnalysisResults(null)}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Re-analyze
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Curriculum Gap Analysis</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Semester
          </label>
          <select
            value={targetSemester}
            onChange={(e) => setTargetSemester(parseInt(e.target.value))}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value={1}>Semester 1 (Freshman)</option>
            <option value={2}>Semester 2</option>
            <option value={3}>Semester 3</option>
            <option value={4}>Semester 4</option>
            <option value={5}>Semester 5</option>
            <option value={6}>Semester 6</option>
            <option value={7}>Semester 7</option>
            <option value={8}>Semester 8</option>
          </select>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isAnalyzing ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Analyzing...
            </div>
          ) : (
            "Analyze Curriculum Gaps"
          )}
        </button>

        <div className="text-sm text-gray-600">
          <p>This analysis will:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Match your completed courses with curriculum requirements</li>
            <li>Identify missing courses needed for graduation</li>
            <li>Provide personalized recommendations based on your performance</li>
            <li>Use AI-powered semantic analysis for accurate matching</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 