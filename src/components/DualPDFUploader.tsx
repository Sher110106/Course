import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
// @ts-expect-error: No type definitions for legacy build
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import Tesseract from "tesseract.js";
import { CourseExtractor } from "./CourseExtractor";
import { DualAnalysisResults } from "./DualAnalysisResults";

// Set the workerSrc to the CDN version for compatibility with Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

// Helper: Render a PDF page to a data URL image
async function renderPageToImage(page: any, scale = 2): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/png");
}

// Primary: Extract text from PDF using Tesseract.js OCR on each page image
async function extractTextFromPDF(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let ocrText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const imageDataUrl = await renderPageToImage(page, 2);
    console.log(`[OCR] Starting OCR for page ${i}, imageDataUrl length:`, imageDataUrl.length);
    const { data: { text } } = await Tesseract.recognize(imageDataUrl, "eng", {
      logger: m => {
        if (onProgress && m.status === "recognizing text") {
          onProgress(((i - 1) + m.progress) / pdf.numPages);
        }
        if (m.status) console.log(`[OCR] Progress for page ${i}:`, m);
      }
    });
    console.log(`[OCR] OCR result for page ${i}:`, text);
    ocrText += text + "\n";
    if (onProgress) onProgress(i / pdf.numPages);
  }
  console.log("[OCR] Final concatenated OCR text:", ocrText);
  // If OCR result is empty, fallback to PDF.js text extraction
  if (!ocrText.trim()) {
    let fallbackText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fallbackText += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return fallbackText;
  }
  return ocrText;
}

export function DualPDFUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [courseOfStudyFile, setCourseOfStudyFile] = useState<File | null>(null);
  const [gradeThreshold, setGradeThreshold] = useState<string>("B");
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [courseOfStudyText, setCourseOfStudyText] = useState<string>("");
  const [selectedDualTranscriptId, setSelectedDualTranscriptId] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  const transcriptFileInputRef = useRef<HTMLInputElement>(null);
  const courseOfStudyFileInputRef = useRef<HTMLInputElement>(null);

  const dualTranscripts = useQuery(api.dualTranscripts.getUserDualTranscripts);
  const generateUploadUrl = useMutation(api.dualTranscripts.generateDualUploadUrl);
  const saveDualTranscript = useMutation(api.dualTranscripts.saveDualTranscript);
  const deleteDualTranscript = useMutation(api.dualTranscripts.deleteDualTranscript);

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
      // Extract text from both PDFs
      const [transcriptExtractedText, courseOfStudyExtractedText] = await Promise.all([
        extractTextFromPDF(transcriptFile, (progress) => setUploadProgress(progress * 0.4)),
        extractTextFromPDF(courseOfStudyFile, (progress) => setUploadProgress(0.4 + progress * 0.4)),
      ]);

      if (!transcriptExtractedText.trim() || !courseOfStudyExtractedText.trim()) {
        toast.error("Failed to extract text from one or both PDFs.");
        setIsUploading(false);
        return;
      }

      setTranscriptText(transcriptExtractedText);
      setCourseOfStudyText(courseOfStudyExtractedText);
      setUploadProgress(80);

      // Get upload URLs for both files
      const [transcriptUploadUrl, courseOfStudyUploadUrl] = await Promise.all([
        generateUploadUrl(),
        generateUploadUrl(),
      ]);

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

      setUploadProgress(90);

      // Save dual transcript record
      const dualTranscriptId = await saveDualTranscript({
        transcriptFileName: transcriptFile.name,
        transcriptFileId,
        courseOfStudyFileName: courseOfStudyFile.name,
        courseOfStudyFileId,
        transcriptText: transcriptExtractedText,
        courseOfStudyText: courseOfStudyExtractedText,
        gradeThreshold,
      });

      setUploadProgress(100);
      toast.success("PDFs uploaded and text extracted successfully! Processing will begin shortly.");
      
      // Clear file inputs
      if (transcriptFileInputRef.current) transcriptFileInputRef.current.value = "";
      if (courseOfStudyFileInputRef.current) courseOfStudyFileInputRef.current.value = "";
      setTranscriptFile(null);
      setCourseOfStudyFile(null);
      
      // Set the newly created transcript as selected
      setSelectedDualTranscriptId(dualTranscriptId);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (dualTranscriptId: string) => {
    try {
      await deleteDualTranscript({ id: dualTranscriptId as any });
      toast.success("Dual transcript deleted successfully");
      if (selectedDualTranscriptId === dualTranscriptId) {
        setSelectedDualTranscriptId(null);
        setShowAnalysis(false);
      }
    } catch (error) {
      toast.error("Failed to delete dual transcript");
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
      case "processing": return "Processing...";
      case "completed": return "Completed";
      case "failed": return "Failed";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
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
            {isUploading ? "Processing..." : "Process PDFs"}
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

      {/* Dual Transcripts List */}
      {dualTranscripts && dualTranscripts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Your Uploaded Dual Transcripts</h3>
          <div className="space-y-3">
            {dualTranscripts.map((dualTranscript) => (
              <div key={dualTranscript._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">
                        {dualTranscript.transcriptFileName} + {dualTranscript.courseOfStudyFileName}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(dualTranscript.processingStatus)}`}>
                        {getStatusText(dualTranscript.processingStatus)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      Uploaded: {new Date(dualTranscript.uploadDate).toLocaleDateString()}
                    </p>
                    
                    <p className="text-sm text-gray-600">
                      Grade Threshold: {dualTranscript.gradeThreshold}
                    </p>
                    
                    {dualTranscript.processingStatus === "completed" && dualTranscript.extractedCourses && (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-green-600">
                          ✅ Found {dualTranscript.extractedCourses.length} courses (Grade ≥ {dualTranscript.gradeThreshold})
                        </p>
                        {dualTranscript.curriculumCourses && (
                          <p className="text-sm text-blue-600">
                            📚 Found {dualTranscript.curriculumCourses.length} curriculum courses
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedDualTranscriptId(dualTranscript._id);
                              setShowAnalysis(false);
                            }}
                            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDualTranscriptId(dualTranscript._id);
                              setShowAnalysis(true);
                            }}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                          >
                            Analyze Gaps
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {dualTranscript.processingStatus === "failed" && dualTranscript.errorMessage && (
                      <p className="text-sm text-red-600 mt-1">
                        ❌ {dualTranscript.errorMessage}
                      </p>
                    )}
                    
                    {dualTranscript.processingStatus === "processing" && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        <p className="text-sm text-purple-600">
                          Extracting and analyzing courses...
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => { void handleDelete(dualTranscript._id); }}
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
      {selectedDualTranscriptId && !showAnalysis && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Course Analysis</h3>
            <button
              onClick={() => {
                setSelectedDualTranscriptId(null);
                setShowAnalysis(false);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          <CourseExtractor dualTranscriptId={selectedDualTranscriptId} />
        </div>
      )}

      {/* Dual Analysis Results for Selected Transcript */}
      {selectedDualTranscriptId && showAnalysis && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Curriculum Gap Analysis</h3>
            <button
              onClick={() => {
                setSelectedDualTranscriptId(null);
                setShowAnalysis(false);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          <DualAnalysisResults 
            dualTranscriptId={selectedDualTranscriptId}
            onAnalysisComplete={(results) => {
              console.log("Analysis completed:", results);
            }}
          />
        </div>
      )}

      {/* Info Section */}
      <div className="bg-purple-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-purple-900 mb-2">How Dual PDF Analysis Works</h4>
        <ul className="text-sm text-purple-800 space-y-1">
          <li>• Upload your academic transcript with grades</li>
          <li>• Upload the curriculum/course of study document</li>
          <li>• Set minimum grade threshold for course consideration</li>
          <li>• Our AI extracts and matches courses from both documents</li>
          <li>• Grade-aware analysis ensures quality course matching</li>
          <li>• Results show matched courses and identify curriculum gaps</li>
        </ul>
      </div>
    </div>
  );
} 