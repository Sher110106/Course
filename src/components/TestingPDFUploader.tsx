import { useState, useRef } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { CourseExtractor } from "./CourseExtractor";
import { DualAnalysisResults } from "./DualAnalysisResults";

export function TestingPDFUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [courseOfStudyFile, setCourseOfStudyFile] = useState<File | null>(null);
  const [gradeThreshold, setGradeThreshold] = useState<string>("B");
  const [useAdvancedFeatures, setUseAdvancedFeatures] = useState<boolean>(false);
  const [selectedTestingTranscriptId, setSelectedTestingTranscriptId] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  const transcriptFileInputRef = useRef<HTMLInputElement>(null);
  const courseOfStudyFileInputRef = useRef<HTMLInputElement>(null);

  const testingTranscripts = useQuery(api.testingTranscripts.getUserTestingTranscripts);
  const generateUploadUrl = useMutation(api.testingTranscripts.generateTestingUploadUrl);
  const saveTestingTranscript = useMutation(api.testingTranscripts.saveTestingTranscript);
  const deleteTestingTranscript = useMutation(api.testingTranscripts.deleteTestingTranscript);
  const testAWSCreds = useAction(api.awsTextract.testAWSCredentialsPublic);

  const handleTranscriptFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      toast.error("Please select a PDF file for transcript");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Transcript file size must be less than 10MB");
      return;
    }

    setTranscriptFile(file);
    toast.success("Transcript file selected");
  };

  const handleCourseOfStudyFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      toast.error("Please select a PDF file for course of study");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Course of study file size must be less than 10MB");
      return;
    }

    setCourseOfStudyFile(file);
    toast.success("Course of study file selected");
  };

  const handleProcessPDFs = async () => {
    if (!transcriptFile || !courseOfStudyFile) {
      toast.error("Please select both transcript and course of study PDFs");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(20);

      // Get upload URLs for both files
      const [transcriptUploadUrl, courseOfStudyUploadUrl] = await Promise.all([
        generateUploadUrl(),
        generateUploadUrl(),
      ]);

      setUploadProgress(40);

      // Upload both files
      const [transcriptResult, courseOfStudyResult] = await Promise.all([
        fetch(transcriptUploadUrl, {
          method: "POST",
          headers: { "Content-Type": transcriptFile.type },
          body: transcriptFile,
        }),
        fetch(courseOfStudyUploadUrl, {
          method: "POST",
          headers: { "Content-Type": courseOfStudyFile.type },
          body: courseOfStudyFile,
        }),
      ]);

      if (!transcriptResult.ok || !courseOfStudyResult.ok) {
        throw new Error("Upload failed");
      }

      const { storageId: transcriptFileId } = await transcriptResult.json();
      const { storageId: courseOfStudyFileId } = await courseOfStudyResult.json();

      setUploadProgress(60);

      // Save testing transcript record (no text extraction needed - Textract will handle it)
      const testingTranscriptId = await saveTestingTranscript({
        transcriptFileName: transcriptFile.name,
        transcriptFileId,
        courseOfStudyFileName: courseOfStudyFile.name,
        courseOfStudyFileId,
        gradeThreshold,
        useAdvancedFeatures,
      });

      setUploadProgress(100);
      toast.success("PDFs uploaded successfully! Amazon Textract processing will begin shortly.");
      
      // Clear file inputs
      if (transcriptFileInputRef.current) transcriptFileInputRef.current.value = "";
      if (courseOfStudyFileInputRef.current) courseOfStudyFileInputRef.current.value = "";
      setTranscriptFile(null);
      setCourseOfStudyFile(null);
      
      // Set the newly created transcript as selected
      setSelectedTestingTranscriptId(testingTranscriptId);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (testingTranscriptId: string) => {
    try {
      await deleteTestingTranscript({ id: testingTranscriptId as any });
      toast.success("Testing transcript deleted successfully");
      if (selectedTestingTranscriptId === testingTranscriptId) {
        setSelectedTestingTranscriptId(null);
        setShowAnalysis(false);
      }
    } catch (error) {
      toast.error("Failed to delete testing transcript");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "uploaded": return "text-blue-700 bg-blue-100";
      case "processing": return "text-yellow-700 bg-yellow-100";
      case "completed": return "text-green-700 bg-green-100";
      case "failed": return "text-red-700 bg-red-100";
      default: return "text-gray-700 bg-gray-100";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "uploaded": return "Uploaded";
      case "processing": return "Processing with Textract...";
      case "completed": return "Completed";
      case "failed": return "Failed";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Amazon Textract Configuration */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Amazon Textract Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="advancedFeatures"
              checked={useAdvancedFeatures}
              onChange={(e) => setUseAdvancedFeatures(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="advancedFeatures" className="text-sm font-medium text-gray-700">
              Use Advanced Features (TABLES, FORMS)
            </label>
          </div>
          <p className="text-sm text-gray-600">
            {useAdvancedFeatures 
              ? "Advanced features provide better table and form extraction but may take longer to process."
              : "Simple text detection for faster processing with basic OCR capabilities."
            }
          </p>
          <div>
            <button
              onClick={async () => {
                try {
                  const res = await testAWSCreds({});
                  if (res.success) {
                    toast.success(`AWS OK${res.s3WriteTest?.ok ? `; S3: ${res.s3WriteTest.message}` : ""}`);
                  } else {
                    toast.error(`AWS not configured: ${res.message}`);
                  }
                } catch (e: any) {
                  toast.error(`AWS test failed: ${e?.message ?? "Unknown error"}`);
                }
              }}
              className="px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 text-sm"
            >
              Test AWS
            </button>
          </div>
        </div>
      </div>

      {/* Grade Threshold Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Grade Filter Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Grade Threshold
            </label>
            <select
              value={gradeThreshold}
              onChange={(e) => setGradeThreshold(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="A+">A+ (4.0)</option>
              <option value="A">A (4.0)</option>
              <option value="A-">A- (3.7)</option>
              <option value="B+">B+ (3.3)</option>
              <option value="B">B (3.0)</option>
              <option value="B-">B- (2.7)</option>
              <option value="C+">C+ (2.3)</option>
              <option value="C">C (2.0)</option>
              <option value="C-">C- (1.7)</option>
              <option value="D+">D+ (1.3)</option>
              <option value="D">D (1.0)</option>
              <option value="D-">D- (0.7)</option>
              <option value="F">F (0.0)</option>
            </select>
            <p className="text-sm text-gray-600 mt-1">
              Only courses with grades at or above this threshold will be considered in the analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Dual PDF Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transcript Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Student Transcript
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload your academic transcript containing completed courses with grades.
              </p>
              
              <input
                ref={transcriptFileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleTranscriptFileSelect}
                disabled={isUploading}
                className="hidden"
              />
              
              <button
                onClick={() => transcriptFileInputRef.current?.click()}
                disabled={isUploading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transcriptFile ? transcriptFile.name : "Choose Transcript PDF"}
              </button>
            </div>
          </div>
        </div>

        {/* Course of Study Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Course of Study
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload the curriculum document containing required courses and descriptions.
              </p>
              
              <input
                ref={courseOfStudyFileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleCourseOfStudyFileSelect}
                disabled={isUploading}
                className="hidden"
              />
              
              <button
                onClick={() => courseOfStudyFileInputRef.current?.click()}
                disabled={isUploading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {courseOfStudyFile ? courseOfStudyFile.name : "Choose Course of Study PDF"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Process Button */}
      {transcriptFile && courseOfStudyFile && (
        <div className="text-center">
          <button
            onClick={handleProcessPDFs}
            disabled={isUploading}
            className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
          >
            {isUploading ? "Processing..." : "Process PDFs with Amazon Textract"}
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">{uploadProgress}% processed</p>
        </div>
      )}

      {/* Testing Transcripts List */}
      {testingTranscripts && testingTranscripts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Your Testing Transcripts (Amazon Textract)</h3>
          <div className="space-y-3">
            {testingTranscripts.map((testingTranscript) => (
              <div key={testingTranscript._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">
                        {testingTranscript.transcriptFileName} + {testingTranscript.courseOfStudyFileName}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(testingTranscript.processingStatus)}`}>
                        {getStatusText(testingTranscript.processingStatus)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      Uploaded: {new Date(testingTranscript.uploadDate).toLocaleDateString()}
                    </p>
                    
                    <p className="text-sm text-gray-600">
                      Grade Threshold: {testingTranscript.gradeThreshold}
                    </p>

                    <p className="text-sm text-gray-600">
                      Textract Features: {testingTranscript.useAdvancedFeatures ? "Advanced (TABLES, FORMS)" : "Simple (TEXT_DETECTION)"}
                    </p>
                    
                    {testingTranscript.processingStatus === "completed" && testingTranscript.extractedCourses && (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-green-600">
                          ✅ Found {testingTranscript.extractedCourses.length} courses (Grade ≥ {testingTranscript.gradeThreshold})
                        </p>
                        {testingTranscript.curriculumCourses && (
                          <p className="text-sm text-blue-600">
                            📚 Found {testingTranscript.curriculumCourses.length} curriculum courses
                          </p>
                        )}
                        {testingTranscript.textractResults && (
                          <div className="text-sm text-purple-600">
                            🔍 Textract Results:
                            <ul className="ml-4 mt-1 space-y-1">
                              <li>• Transcript Confidence: {testingTranscript.textractResults.transcriptConfidence.toFixed(1)}%</li>
                              <li>• Course of Study Confidence: {testingTranscript.textractResults.courseOfStudyConfidence.toFixed(1)}%</li>
                              <li>• Processing Time: {testingTranscript.textractResults.processingTime}ms</li>
                              <li>• Features Used: {testingTranscript.textractResults.featuresUsed.join(", ")}</li>
                            </ul>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedTestingTranscriptId(testingTranscript._id);
                              setShowAnalysis(false);
                            }}
                            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTestingTranscriptId(testingTranscript._id);
                              setShowAnalysis(true);
                            }}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                          >
                            Analyze Gaps
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {testingTranscript.processingStatus === "failed" && testingTranscript.errorMessage && (
                      <p className="text-sm text-red-600 mt-1">
                        ❌ {testingTranscript.errorMessage}
                      </p>
                    )}
                    
                    {testingTranscript.processingStatus === "processing" && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        <p className="text-sm text-purple-600">
                          Processing with Amazon Textract...
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => { void handleDelete(testingTranscript._id); }}
                    className="text-red-600 hover:text-red-800 text-sm ml-4"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course Extractor for Selected Transcript */}
      {selectedTestingTranscriptId && !showAnalysis && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Course Analysis (Amazon Textract)</h3>
            <button
              onClick={() => {
                setSelectedTestingTranscriptId(null);
                setShowAnalysis(false);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          <CourseExtractor dualTranscriptId={selectedTestingTranscriptId} transcriptType="testing" />
        </div>
      )}

      {/* Dual Analysis Results for Selected Transcript */}
      {selectedTestingTranscriptId && showAnalysis && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Curriculum Gap Analysis (Amazon Textract)</h3>
            <button
              onClick={() => {
                setSelectedTestingTranscriptId(null);
                setShowAnalysis(false);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          <DualAnalysisResults 
            dualTranscriptId={selectedTestingTranscriptId}
            onAnalysisComplete={(results) => {
              console.log("Analysis completed:", results);
            }}
          />
        </div>
      )}

      {/* Info Section */}
      <div className="bg-purple-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-purple-900 mb-2">How Amazon Textract Testing Works</h4>
        <ul className="text-sm text-purple-800 space-y-1">
          <li>• Upload your academic transcript with grades</li>
          <li>• Upload the curriculum/course of study document</li>
          <li>• Choose between simple or advanced Textract features</li>
          <li>• Amazon Textract extracts text with high accuracy</li>
          <li>• Our AI matches courses and identifies curriculum gaps</li>
          <li>• View confidence scores and processing metrics</li>
        </ul>
        <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This testing system uses Amazon Textract for superior OCR accuracy compared to local Tesseract processing.
          </p>
        </div>
      </div>
    </div>
  );
}

