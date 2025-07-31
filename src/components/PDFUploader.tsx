import { useState, useRef } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
// @ts-expect-error: No type definitions for legacy build
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
// Remove the import for pdf.worker.entry
// import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.entry";
import Tesseract from "tesseract.js";

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

export function PDFUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzingTranscripts, setAnalyzingTranscripts] = useState<Set<string>>(new Set());
  const [selectedSemester, setSelectedSemester] = useState<number>(5);
  const [analysisMethod, setAnalysisMethod] = useState<'vector' | 'hybrid'>('hybrid');
  const [analysisProgress, setAnalysisProgress] = useState<{visible: boolean, current: number, total: number, message: string}>({visible: false, current: 0, total: 0, message: ''});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transcripts = useQuery(api.transcriptData.getUserTranscripts);
  const generateUploadUrl = useMutation(api.transcriptData.generateUploadUrl);
  const saveTranscript = useMutation(api.transcriptData.saveTranscript);
  const deleteTranscript = useMutation(api.transcriptData.deleteTranscript);
  const analyzeTranscript = useAction(api.analysis.analyzeTranscript);
  const analyzeTranscriptHybrid = useAction(api.analysis.analyzeTranscriptHybrid);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      toast.error("Please select a PDF file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Always use OCR first, fallback to PDF.js text extraction if needed
      const extractedText = await extractTextFromPDF(file, (progress) => setUploadProgress(progress));
      if (!extractedText.trim()) {
        toast.error("Failed to extract text from PDF.");
        setIsUploading(false);
        return;
      }

      // Step 1: Get upload URL
      const uploadUrl = await generateUploadUrl();
      setUploadProgress(25);

      // Step 2: Upload file
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();
      setUploadProgress(75);

      // Step 3: Save transcript record (now with extractedText)
      await saveTranscript({
        fileName: file.name,
        fileId: storageId,
        extractedText, // Pass extracted text to backend
      });

      setUploadProgress(100);
      toast.success("PDF uploaded and text extracted successfully! Processing will begin shortly.");
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAnalyzeTranscript = async (transcriptId: string) => {
    setAnalyzingTranscripts(prev => new Set(prev).add(transcriptId));
    setAnalysisProgress({visible: true, current: 0, total: 0, message: 'Starting analysis...'});
    try {
      // Simulate progress for now (since backend logs are not directly accessible)
      // In a real app, you would poll a progress endpoint or subscribe to logs
      const fakeTotal = 10;
      setAnalysisProgress({visible: true, current: 0, total: fakeTotal, message: 'Analyzing courses...'});
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev.current < fakeTotal) {
            return {...prev, current: prev.current + 1, message: `Analyzing course ${prev.current + 1} of ${fakeTotal}...`};
          } else {
            clearInterval(progressInterval);
            return prev;
          }
        });
      }, 800);
      let result;
      if (analysisMethod === 'hybrid') {
        result = await analyzeTranscriptHybrid({
          transcriptId: transcriptId as any,
          targetSemester: selectedSemester,
        });
      } else {
        result = await analyzeTranscript({
          transcriptId: transcriptId as any,
          targetSemester: selectedSemester,
        });
      }
      setAnalysisProgress({visible: false, current: 0, total: 0, message: ''});
      const methodLabel = analysisMethod === 'hybrid' ? 'Hybrid AI' : 'Vector AI';
      toast.success(`Analysis complete! (${methodLabel}) Found ${result.totalMatched} matches and ${result.totalGaps} gaps.`);
    } catch (error) {
      setAnalysisProgress({visible: false, current: 0, total: 0, message: ''});
      console.error("Analysis failed:", error);
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : "Please try again."}`);
    } finally {
      setAnalyzingTranscripts(prev => {
        const newSet = new Set(prev);
        newSet.delete(transcriptId);
        return newSet;
      });
    }
  };

  const handleDelete = async (transcriptId: string) => {
    try {
      await deleteTranscript({ id: transcriptId as any });
      toast.success("Transcript deleted successfully");
    } catch (error) {
      toast.error("Failed to delete transcript");
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
      {/* Target Semester Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Target Semester at Plaksha</h3>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Analysis Method
            </label>
            <select
              value={analysisMethod}
              onChange={e => setAnalysisMethod(e.target.value as 'vector' | 'hybrid')}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="vector">Vector AI (Fast)</option>
              <option value="hybrid">Hybrid AI (Recommended)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Upload Academic Transcript
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload a PDF containing your course descriptions and grades. Our AI will extract and analyze your courses automatically.
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={e => { void handleFileSelect(e); }}
              disabled={isUploading}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "Uploading..." : "Choose PDF File"}
            </button>
            
            <p className="text-xs text-gray-500 mt-2">
              Maximum file size: 10MB
            </p>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">{uploadProgress}% uploaded</p>
          </div>
        )}
      </div>

      {/* Transcripts List */}
      {transcripts && transcripts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Your Uploaded Transcripts</h3>
          <div className="space-y-3">
            {transcripts.map((transcript) => (
              <div key={transcript._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">{transcript.fileName}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(transcript.processingStatus)}`}>
                        {getStatusText(transcript.processingStatus)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      Uploaded: {new Date(transcript.uploadDate).toLocaleDateString()}
                    </p>
                    
                    {transcript.processingStatus === "completed" && transcript.parsedCourses && (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-green-600">
                          ✅ Found {transcript.parsedCourses.length} courses
                        </p>
                        <button
                          onClick={() => { void handleAnalyzeTranscript(transcript._id); }}
                          disabled={analyzingTranscripts.has(transcript._id)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {analyzingTranscripts.has(transcript._id) ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Analyzing...
                            </>
                          ) : (
                            "Analyze Curriculum"
                          )}
                        </button>
                      </div>
                    )}
                    
                    {transcript.processingStatus === "failed" && transcript.errorMessage && (
                      <p className="text-sm text-red-600 mt-1">
                        ❌ {transcript.errorMessage}
                      </p>
                    )}
                    
                    {transcript.processingStatus === "processing" && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <p className="text-sm text-blue-600">
                          Extracting and analyzing courses...
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => { void handleDelete(transcript._id); }}
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

      {/* Info Section */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">How PDF Analysis Works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Upload your official academic transcript or course catalog</li>
          <li>• Our AI extracts text and identifies individual courses</li>
          <li>• Click "Analyze Curriculum" once processing is complete</li>
          <li>• Each course is analyzed using advanced semantic matching</li>
          <li>• Vector embeddings enable precise curriculum mapping</li>
          <li>• Results show matched courses and identify gaps automatically</li>
        </ul>
      </div>

      {/* Progress Modal/Overlay */}
      {analysisProgress.visible && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full flex flex-col items-center">
            <div className="w-full mb-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(analysisProgress.current / (analysisProgress.total || 1)) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-lg font-semibold mb-2">Analyzing Transcript</div>
            <div className="text-gray-700 mb-2">{analysisProgress.message}</div>
            <div className="text-sm text-gray-500">This may take several minutes. Please do not close the window.</div>
          </div>
        </div>
      )}
    </div>
  );
}
