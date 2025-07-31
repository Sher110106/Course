import { Doc } from "../../convex/_generated/dataModel";

interface AnalysisResult {
  matchedCourses: Array<{
    userCourseId?: Doc<"userCourses">["_id"];
    userCourseTitle: string;
    plakshaCourseCode: string;
    plakshaCourseTitle: string;
    similarity: number;
  }>;
  gapCourses: Array<{
    code: string;
    title: string;
    department: string;
    semester: number;
  }>;
  futureChallenges: Array<{
    code: string;
    title: string;
    department: string;
    semester: number;
    difficulty: string;
    reason: string;
  }>;
  analysisDate: number;
  targetSemester: number;
}

interface AnalysisResultsProps {
  analysis: AnalysisResult | null | undefined;
}

export function AnalysisResults({ analysis }: AnalysisResultsProps) {
  if (!analysis) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No analysis results yet. Add your courses and click "Analyze Curriculum" to get started.</p>
      </div>
    );
  }

  const { matchedCourses, gapCourses, futureChallenges, targetSemester } = analysis;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'text-green-700 bg-green-100';
      case 'moderate': return 'text-blue-700 bg-blue-100';
      case 'challenging': return 'text-orange-700 bg-orange-100';
      case 'very challenging': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800">Matched Courses</h3>
          <p className="text-2xl font-bold text-green-600">{matchedCourses.length}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-800">Gap Courses</h3>
          <p className="text-2xl font-bold text-orange-600">{gapCourses.length}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800">Coverage</h3>
          <p className="text-2xl font-bold text-blue-600">
            {matchedCourses.length > 0 
              ? Math.round((matchedCourses.length / (matchedCourses.length + gapCourses.length)) * 100)
              : 0}%
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-800">Target Semester</h3>
          <p className="text-2xl font-bold text-purple-600">{targetSemester}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Matched Courses */}
        <div>
          <h3 className="text-xl font-semibold text-green-800 mb-4">
            ✅ Matched Courses ({matchedCourses.length})
          </h3>
          {matchedCourses.length > 0 ? (
            <div className="space-y-3">
              {matchedCourses.map((match, index) => (
                <div key={index} className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{match.userCourseTitle}</h4>
                    <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                      {Math.round(match.similarity * 100)}% match
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>↓ Maps to</p>
                    <p className="font-medium text-green-700">
                      {match.plakshaCourseCode}: {match.plakshaCourseTitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No course matches found. Consider adding more detailed course descriptions.</p>
          )}
        </div>

        {/* Gap Courses */}
        <div>
          <h3 className="text-xl font-semibold text-orange-800 mb-4">
            ⚠️ Required Courses Missing ({gapCourses.length})
          </h3>
          {gapCourses.length > 0 ? (
            <div className="space-y-3">
              {gapCourses.map((gap, index) => (
                <div key={index} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900">
                    {gap.code}: {gap.title}
                  </h4>
                  <p className="text-sm text-orange-700 mt-1">
                    Department: {gap.department} | Semester: {gap.semester}
                  </p>
                  <p className="text-xs text-orange-600 mt-2">
                    This is a core requirement at Plaksha University
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-green-600 font-medium">🎉 Congratulations!</p>
              <p className="text-gray-600">You've covered all core requirements up to semester {targetSemester - 1}.</p>
            </div>
          )}
        </div>
      </div>

      {/* Future Course Challenges */}
      {futureChallenges && futureChallenges.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-purple-800 mb-4">
            🔮 Semester {targetSemester} Course Difficulty Predictions ({futureChallenges.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {futureChallenges.map((challenge, index) => (
              <div key={index} className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">
                    {challenge.code}: {challenge.title}
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded ${getDifficultyColor(challenge.difficulty)}`}>
                    {challenge.difficulty}
                  </span>
                </div>
                <p className="text-sm text-purple-700 mb-2">
                  Department: {challenge.department}
                </p>
                <p className="text-sm text-gray-600">
                  {challenge.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">📚 Recommendations</h3>
        <ul className="text-blue-700 space-y-1 text-sm">
          {gapCourses.length > 0 && (
            <li>• Consider taking the missing core courses before semester {targetSemester} to meet Plaksha's requirements</li>
          )}
          <li>• Contact the admissions office to discuss credit transfer options</li>
          <li>• Some gaps might be filled through placement tests or portfolio reviews</li>
          <li>• Bridge courses may be available for certain subjects</li>
          {futureChallenges.some(c => c.difficulty.toLowerCase().includes('challenging')) && (
            <li>• Consider additional preparation for challenging courses in semester {targetSemester}</li>
          )}
          <li>• Review prerequisite knowledge for courses marked as "Very Challenging"</li>
        </ul>
      </div>
    </div>
  );
}
