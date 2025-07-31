import { useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CourseInputForm } from "./CourseInputForm";
import { AnalysisResults } from "./AnalysisResults";
import { toast } from "sonner";

export function CurriculumAnalyzer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<number>(5);
  
  const userCourses = useQuery(api.courses.getUserCourses);
  const latestAnalysis = useQuery(api.analysis.getLatestAnalysis);
  const analyzeCurriculum = useAction(api.analysis.analyzeCurriculum);
  const seedData = useMutation(api.seedData.seedPlakshaCurriculum);

  const handleAnalyze = async () => {
    if (!userCourses || userCourses.length === 0) {
      toast.error("Please add at least one course before analyzing");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Ensure curriculum data exists
      const seedResult = await seedData();
      console.log("Seed result:", seedResult);
      
      const result = await analyzeCurriculum({ targetSemester: selectedSemester });
      setShowResults(true);
      toast.success(`Analysis complete! Found ${result.totalMatched} matches and ${result.totalGaps} gaps.`);
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : "Please try again."}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Semester Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-2xl font-semibold mb-4">Target Semester at Plaksha</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Which semester do you plan to join Plaksha University?
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(parseInt(e.target.value))}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> We'll analyze your completed courses against Plaksha's curriculum up to semester {selectedSemester - 1} 
              and provide recommendations for future courses.
            </p>
          </div>
        </div>
      </div>

      {/* Course Input Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-2xl font-semibold mb-4">Your Completed Courses</h2>
        <CourseInputForm />
        
        {userCourses && userCourses.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {userCourses.length} course{userCourses.length !== 1 ? 's' : ''} added
              </p>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Analyzing...
                  </>
                ) : (
                  "Analyze Curriculum"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {(showResults || latestAnalysis) && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Analysis Results</h2>
            {latestAnalysis && (
              <p className="text-sm text-gray-500">
                Last analyzed: {new Date(latestAnalysis.analysisDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <AnalysisResults analysis={latestAnalysis} />
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">How it works</h3>
        <ul className="text-blue-800 space-y-1 text-sm">
          <li>• Select your target semester to join Plaksha University</li>
          <li>• Add your completed courses with detailed descriptions</li>
          <li>• Our AI analyzes course content semantically, not just by title</li>
          <li>• Get a detailed mapping to Plaksha University's curriculum</li>
          <li>• Identify gaps in core requirements for your program</li>
          <li>• Receive recommendations for future courses based on your background</li>
        </ul>
      </div>
    </div>
  );
}
