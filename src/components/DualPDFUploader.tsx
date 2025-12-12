import { useState, useRef } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
// @ts-expect-error: No type definitions for legacy build
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { CourseExtractor } from "./CourseExtractor";
import { DualAnalysisResults } from "./DualAnalysisResults";
import { 
  convertPDFToImages, 
  shouldUseOCR, 
  estimateImageSize 
} from "../lib/pdfToImage";

// Set the workerSrc to the CDN version for compatibility with Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

// Constants
const TEXT_EXTRACTION_THRESHOLD = 200; // Minimum characters for successful text extraction

/**
 * Enhanced PDF text extraction with automatic OCR fallback
 * Implements the specification:
 * 1. Try text-based extraction first
 * 2. If text < 200 characters, fall back to Gemini Vision OCR
 * 3. Return full text, never summarize
 */
async function extractTextWithFallback(
  file: File,
  extractFromImagesAction: any,
  forceOCR: boolean = false,
  onProgress?: (progress: number) => void
): Promise<{ text: string; method: "text" | "ocr" }> {
  const fileName = file.name;
  
  // Step 1: Try primary text extraction (unless forced to use OCR)
  if (!forceOCR) {
    console.log(`[Extract] Attempting primary text extraction for ${fileName}`);
    
    try {
      const primaryText = await extractTextFromPDF(file, (p) => {
        onProgress?.(p * 0.5); // First 50% of progress
      });
      
      const cleanText = primaryText.trim();
      console.log(`[Extract] Primary extraction result: ${cleanText.length} characters`);
      
      // Check if extraction was successful
      if (cleanText.length >= TEXT_EXTRACTION_THRESHOLD) {
        console.log(`[Extract] ✓ Primary extraction successful for ${fileName}`);
        onProgress?.(1.0);
        return { text: primaryText, method: "text" };
      }
      
      console.log(
        `[Extract] ✗ Primary extraction insufficient (${cleanText.length} < ${TEXT_EXTRACTION_THRESHOLD}). ` +
        `Triggering OCR fallback for ${fileName}`
      );
    } catch (error) {
      console.error(`[Extract] Primary extraction failed for ${fileName}:`, error);
      console.log(`[Extract] Falling back to OCR`);
    }
  } else {
    console.log(`[Extract] OCR forced for ${fileName}`);
  }
  
  // Step 2: Fallback to Gemini Vision OCR
  console.log(`[Extract] Starting Gemini 2.5 Flash Vision OCR for ${fileName}`);
  
  try {
    // Estimate size and warn if large
    const estimatedMB = await estimateImageSize(file, 300);
    if (estimatedMB > 50) {
      toast.warning(
        `Large PDF (${Math.round(estimatedMB)}MB images). OCR may take several minutes.`
      );
    }
    
    // Convert PDF pages to images
    console.log(`[Extract] Converting PDF to images...`);
    onProgress?.(0.6);
    
    const images = await convertPDFToImages(file, 300, (p) => {
      onProgress?.(0.6 + p * 0.2); // 60-80% of progress
    });
    
    console.log(`[Extract] Converted ${images.length} pages to images`);
    onProgress?.(0.8);
    
    // Send images to Gemini for OCR
    console.log(`[Extract] Sending ${images.length} images to Gemini Vision API...`);
    
    const result = await extractFromImagesAction({
      images: images.map(img => ({
        data: img.data,
        mimeType: img.mimeType,
      })),
    });
    
    console.log(`[Extract] ✓ OCR successful: ${result.length} characters`);
    onProgress?.(1.0);
    
    return { text: result.text, method: "ocr" };
    
  } catch (error) {
    console.error(`[Extract] OCR failed for ${fileName}:`, error);
    throw new Error(
      `PDF extraction failed. Primary extraction yielded insufficient text, and OCR failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Fast path: Extract text using pdf.js and preserve columns to keep credits (numbers)
async function extractTextFromPDF(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allPages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    type Item = { str: string; transform: number[]; width?: number };
    const items = (content.items as Item[]).filter(it => typeof it.str === "string" && it.str.length > 0);

    // Group by line using Y coordinate buckets
    const yTolerance = 2; // device units
    const linesMap = new Map<number, Item[]>();
    for (const it of items) {
      const y = it.transform?.[5] ?? 0;
      // Find an existing bucket within tolerance
      let key = y;
      for (const existing of linesMap.keys()) {
        if (Math.abs(existing - y) <= yTolerance) { key = existing; break; }
      }
      const arr = linesMap.get(key) || [];
      arr.push(it);
      linesMap.set(key, arr);
    }

    // Sort lines by Y (top to bottom) and items by X (left to right)
    const sortedLineYs = Array.from(linesMap.keys()).sort((a, b) => b - a);
    const pageLines: string[] = [];
    for (const yKey of sortedLineYs) {
      const lineItems = (linesMap.get(yKey) || []).slice().sort((a, b) => {
        const ax = a.transform?.[4] ?? 0;
        const bx = b.transform?.[4] ?? 0;
        return ax - bx;
      });

      // Estimate typical intra-word gap for this line to decide spaces vs tabs conservatively
      const gaps: number[] = [];
      for (let k = 1; k < lineItems.length; k++) {
        const prev = lineItems[k - 1];
        const curr = lineItems[k];
        const prevRight = (prev.transform?.[4] ?? 0) + (prev.width ?? 0);
        const currLeft = (curr.transform?.[4] ?? 0);
        const gap = currLeft - prevRight;
        if (gap > 0) gaps.push(gap);
      }
      const sortedGaps = gaps.slice().sort((a, b) => a - b);
      const medianGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 4;

      // Join items, inserting spaces normally and a tab only on significantly large gaps
      const parts: string[] = [];
      let prevRight = -Infinity;
      for (const it of lineItems) {
        const x = it.transform?.[4] ?? 0;
        const w = (it.width ?? 0);
        const gap = x - prevRight;
        if (prevRight !== -Infinity) {
          // If gap is far larger than typical, assume a new column → tab
          if (gap > Math.max(20, medianGap * 4)) {
            parts.push("\t");
          } else if (gap > Math.max(2, medianGap * 1.25)) {
            // Slightly larger than typical → add an extra space
            parts.push("  ");
          } else {
            // Normal separation
            parts.push(" ");
          }
        }
        parts.push(it.str);
        prevRight = x + w;
      }
      // Preserve tabs and spaces; avoid aggressive normalization to prevent data loss
      const rawLine = parts.join("")
        .replace(/\u00AD/g, ""); // strip soft hyphen only
      pageLines.push(rawLine);
    }

    allPages.push(pageLines.join("\n"));
    if (onProgress) onProgress(i / pdf.numPages);
  }

  // Avoid collapsing whitespace; just trim trailing newlines
  return allPages.join("\n\n").replace(/[\n\s]+$/g, "");
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
  const [useOCR, setUseOCR] = useState(false);
  const [autoDetectOCR, setAutoDetectOCR] = useState(true);
  
  // COS Template states
  const [cosMode, setCosMode] = useState<"template" | "one-time" | "dual">("dual");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [templateCosFile, setTemplateCosFile] = useState<File | null>(null);
  
  const transcriptFileInputRef = useRef<HTMLInputElement>(null);
  const courseOfStudyFileInputRef = useRef<HTMLInputElement>(null);

  const dualTranscripts = useQuery(api.dualTranscripts.getUserDualTranscripts);
  const cosTemplates = useQuery(api.cosTemplates.listUserTemplates);
  const generateUploadUrl = useMutation(api.dualTranscripts.generateDualUploadUrl);
  const saveDualTranscript = useMutation(api.dualTranscripts.saveDualTranscript);
  const saveTranscriptWithTemplate = useMutation(api.dualTranscripts.saveTranscriptWithTemplate);
  const createTemplate = useMutation(api.cosTemplates.createTemplate);
  const deleteTemplate = useMutation(api.cosTemplates.deleteTemplate);
  const deleteDualTranscript = useMutation(api.dualTranscripts.deleteDualTranscript);
  const extractFromImages = useAction(api.pdfExtraction.extractFromImages);

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
    // Validation based on mode
    if (cosMode === "dual") {
      if (!transcriptFile || !courseOfStudyFile) {
        toast.error("Please select both transcript and course of study PDFs");
        return;
      }
    } else if (cosMode === "template") {
      if (!transcriptFile) {
        toast.error("Please select a transcript PDF");
        return;
      }
      if (!selectedTemplate) {
        toast.error("Please select a COS template");
        return;
      }
    } else if (cosMode === "one-time") {
      if (!transcriptFile || !courseOfStudyFile) {
        toast.error("Please select both transcript and COS PDFs");
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log("[Process] Starting processing in mode:", cosMode);
      const t0 = performance.now();

      // Handle template or one-time mode with new pipeline
      if (cosMode === "template" || cosMode === "one-time") {
        // Extract transcript text with OCR fallback
        toast.info("Extracting text from transcript...");
        const transcriptResult = await extractTextWithFallback(
          transcriptFile,
          extractFromImages,
          useOCR,
          (progress) => {
            const pct = Math.max(0, Math.min(50, Math.round(progress * 50)));
            setUploadProgress(pct);
          }
        );

        const transcriptText = transcriptResult.text;
        console.log("[Process] Transcript extracted:", transcriptText.length, "characters via", transcriptResult.method);
        
        if (transcriptResult.method === "ocr") {
          toast.success("Used OCR for transcript extraction!");
        }
        
        setUploadProgress(50);

        // Extract COS text for one-time mode
        let oneTimeCosText: string | undefined;
        if (cosMode === "one-time" && courseOfStudyFile) {
          toast.info("Extracting text from Course of Study...");
          const cosResult = await extractTextWithFallback(
            courseOfStudyFile,
            extractFromImages,
            useOCR,
            (progress) => {
              const pct = Math.max(50, Math.min(70, Math.round(50 + progress * 20)));
              setUploadProgress(pct);
            }
          );
          oneTimeCosText = cosResult.text;
          console.log("[Process] COS extracted:", oneTimeCosText.length, "characters via", cosResult.method);
          
          if (cosResult.method === "ocr") {
            toast.success("Used OCR for COS extraction!");
          }
        }

        setUploadProgress(70);

        // Upload transcript file
        const transcriptUploadUrl = await generateUploadUrl();
        const transcriptUploadResult = await fetch(transcriptUploadUrl, {
          method: "POST",
          headers: { "Content-Type": transcriptFile.type },
          body: transcriptFile,
        });

        if (!transcriptUploadResult.ok) {
          throw new Error("Failed to upload transcript");
        }

        const { storageId: transcriptFileId } = await transcriptUploadResult.json();
        console.log("[Upload] Transcript uploaded:", transcriptFileId);
        setUploadProgress(80);

        // Save with template
        const transcriptId = await saveTranscriptWithTemplate({
          transcriptFileName: transcriptFile.name,
          transcriptFileId: transcriptFileId,
          transcriptText: transcriptText,
          cosTemplateId: cosMode === "template" ? selectedTemplate as any : undefined,
          oneTimeCosText: oneTimeCosText,
          gradeThreshold: gradeThreshold,
        });

        console.log("[Save] Transcript saved with ID:", transcriptId);
        setUploadProgress(100);

        const t1 = performance.now();
        console.log("[Process] Completed in", Math.round(t1 - t0), "ms");

        toast.success(
          cosMode === "template" 
            ? "Processing with template! Using cached COS for 90% cost savings." 
            : "Processing with one-time COS!"
        );

        // Clear files
        if (transcriptFileInputRef.current) transcriptFileInputRef.current.value = "";
        if (courseOfStudyFileInputRef.current) courseOfStudyFileInputRef.current.value = "";
        setTranscriptFile(null);
        setCourseOfStudyFile(null);

        setSelectedDualTranscriptId(transcriptId);
        
        setIsUploading(false);
        setUploadProgress(0);
        return;
      }

      // Original dual mode logic below
      console.log("[Process] Starting dual PDF processing with enhanced extraction");
      const t0Dual = performance.now();
      
      // Check if we should use OCR automatically
      let shouldUseOCRForTranscript = useOCR;
      let shouldUseOCRForCourseOfStudy = useOCR;
      
      if (autoDetectOCR && !useOCR) {
        console.log("[Process] Auto-detecting if OCR is needed...");
        toast.info("Analyzing PDFs to determine best extraction method...");
        
        [shouldUseOCRForTranscript, shouldUseOCRForCourseOfStudy] = await Promise.all([
          shouldUseOCR(transcriptFile),
          shouldUseOCR(courseOfStudyFile),
        ]);
        
        console.log("[Process] Auto-detect results:", {
          transcript: shouldUseOCRForTranscript ? "OCR" : "Text",
          courseOfStudy: shouldUseOCRForCourseOfStudy ? "OCR" : "Text",
        });
        
        if (shouldUseOCRForTranscript || shouldUseOCRForCourseOfStudy) {
          toast.info(
            `Scanned PDF detected. Using Gemini Vision OCR for ${
              shouldUseOCRForTranscript && shouldUseOCRForCourseOfStudy 
                ? "both documents" 
                : shouldUseOCRForTranscript 
                  ? "transcript" 
                  : "course of study"
            }.`,
            { duration: 5000 }
          );
        }
      }
      
      // Extract text from both PDFs with automatic fallback
      const [transcriptResult, courseOfStudyResult] = await Promise.all([
        extractTextWithFallback(
          transcriptFile,
          extractFromImages,
          shouldUseOCRForTranscript,
          (progress) => {
            // progress (0..1) → 0..40
            const pct = Math.max(0, Math.min(100, Math.round(progress * 40)));
            setUploadProgress(pct);
          }
        ),
        extractTextWithFallback(
          courseOfStudyFile,
          extractFromImages,
          shouldUseOCRForCourseOfStudy,
          (progress) => {
            // progress (0..1) → 40..80
            const pct = Math.max(40, Math.min(100, Math.round(40 + progress * 40)));
            setUploadProgress(pct);
          }
        ),
      ]);
      
      const transcriptExtractedText = transcriptResult.text;
      const courseOfStudyExtractedText = courseOfStudyResult.text;
      
      const t1 = performance.now();
      console.log("[Process] Extraction completed. Duration:", Math.round(t1 - t0), "ms");
      console.log("[Process] Transcript:", transcriptExtractedText.length, "chars via", transcriptResult.method);
      console.log("[Process] Course of Study:", courseOfStudyExtractedText.length, "chars via", courseOfStudyResult.method);
      
      // Show success message with extraction methods used
      const methods = new Set([transcriptResult.method, courseOfStudyResult.method]);
      if (methods.has("ocr")) {
        toast.success(
          `Text extracted successfully using ${
            methods.size === 1 && methods.has("ocr") 
              ? "OCR for both documents" 
              : "text extraction and OCR"
          }!`
        );
      }
      
      // Debug: Look for credit patterns in transcript
      const creditPatterns = transcriptExtractedText.match(/\b\d+(?:\.\d+)?\s*(?:credits?|hours?|units?|ch)\b/gi);
      if (creditPatterns) {
        console.log("[OCR] Found credit patterns in transcript:", creditPatterns.slice(0, 10));
      } else {
        console.log("[OCR] No obvious credit patterns found in transcript");
      }
      
      // Debug: Look for numbers that might be credits
      const numberPatterns = transcriptExtractedText.match(/\b[1-6](?:\.\d+)?\b/g);
      if (numberPatterns) {
        console.log("[OCR] Found number patterns in transcript:", numberPatterns.slice(0, 20));
      }

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
      console.log("[Upload] Received upload URLs");

      // Upload both files
      const [transcriptUploadResult, courseOfStudyUploadResult] = await Promise.all([
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
      console.log("[Upload] Upload responses:", transcriptUploadResult.status, courseOfStudyUploadResult.status);

      if (!transcriptUploadResult.ok || !courseOfStudyUploadResult.ok) {
        throw new Error("Upload failed");
      }

      const { storageId: transcriptFileId } = await transcriptUploadResult.json();
      const { storageId: courseOfStudyFileId } = await courseOfStudyUploadResult.json();
      console.log("[Upload] Storage IDs:", { transcriptFileId, courseOfStudyFileId });

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
      console.log("[Save] Dual transcript created with id:", dualTranscriptId);

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
      console.error("[Process] Failure:", error);
      toast.error("Upload or processing failed. See console for details.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      console.log("[Process] Done.");
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

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!templateCosFile) {
      toast.error("Please select a Course of Study PDF");
      return;
    }

    try {
      setIsUploading(true);
      toast.info("Creating template...");

      // Extract text from COS
      const cosText = await extractTextFromPDF(templateCosFile);
      
      // Upload file
      const uploadUrl = await generateUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": templateCosFile.type },
        body: templateCosFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload COS file");
      }

      const { storageId } = await uploadResponse.json();

      // Create template
      const templateId = await createTemplate({
        name: newTemplateName,
        fileId: storageId,
        fileName: templateCosFile.name,
        text: cosText,
      });

      toast.success(`Template "${newTemplateName}" created successfully!`);
      
      // Select the new template
      setSelectedTemplate(templateId);
      setCosMode("template");
      
      // Close modal and reset
      setShowCreateTemplateModal(false);
      setNewTemplateName("");
      setTemplateCosFile(null);
    } catch (error) {
      console.error("Failed to create template:", error);
      toast.error("Failed to create template. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      await deleteTemplate({ templateId: templateId as any });
      toast.success("Template deleted successfully");
      
      // Clear selection if deleted template was selected
      if (selectedTemplate === templateId) {
        setSelectedTemplate("");
      }
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to delete template");
    }
  };

  const handleTemplateChange = (value: string) => {
    if (value === "create-new") {
      setShowCreateTemplateModal(true);
    } else if (value === "one-time") {
      setCosMode("one-time");
      setSelectedTemplate("");
    } else if (value === "dual") {
      setCosMode("dual");
      setSelectedTemplate("");
    } else {
      setCosMode("template");
      setSelectedTemplate(value);
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
      {/* Settings Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Processing Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Grade Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Grade Threshold
            </label>
            <select
              value={gradeThreshold}
              onChange={(e) => setGradeThreshold(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-darkgreen"
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
              Only courses with grades at or above this threshold will be considered.
            </p>
          </div>

          {/* OCR Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text Extraction Method
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!useOCR && autoDetectOCR}
                  onChange={() => {
                    setUseOCR(false);
                    setAutoDetectOCR(true);
                  }}
                  className="mr-2"
                />
                <span className="text-sm">
                  <strong>Automatic (Recommended)</strong> - Detects scanned PDFs and uses OCR when needed
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!useOCR && !autoDetectOCR}
                  onChange={() => {
                    setUseOCR(false);
                    setAutoDetectOCR(false);
                  }}
                  className="mr-2"
                />
                <span className="text-sm">
                  <strong>Text Only</strong> - For digital PDFs with selectable text
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={useOCR}
                  onChange={() => {
                    setUseOCR(true);
                    setAutoDetectOCR(false);
                  }}
                  className="mr-2"
                />
                <span className="text-sm">
                  <strong>Force OCR</strong> - Use Gemini Vision for scanned/image PDFs (slower)
                </span>
              </label>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              💡 Automatic mode tries text extraction first, falls back to OCR if needed.
            </p>
          </div>
        </div>
      </div>

      {/* COS Template Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Course of Study (COS) Options</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How would you like to provide the Course of Study?
            </label>
            <select
              value={cosMode === "template" && selectedTemplate ? selectedTemplate : cosMode}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-darkgreen"
              disabled={isUploading}
            >
              <option value="dual">📄 Upload both Transcript + COS (Traditional)</option>
              <option value="" disabled>──────────</option>
              {cosTemplates && cosTemplates.length > 0 && (
                <>
                  <optgroup label="Saved Templates">
                    {cosTemplates.map((template) => (
                      <option key={template._id} value={template._id}>
                        📚 {template.name} {template.usageCount > 0 && `(used ${template.usageCount}×)`}
                      </option>
                    ))}
                  </optgroup>
                  <option value="" disabled>──────────</option>
                </>
              )}
              <option value="create-new">➕ Create New Template</option>
              <option value="one-time">📄 Upload for One-Time Use</option>
            </select>
            <p className="text-sm text-gray-600 mt-1">
              {cosMode === "template" && selectedTemplate && "Using saved template (fastest & cheapest!)"}
              {cosMode === "one-time" && "COS will be used once, not saved"}
              {cosMode === "dual" && "Traditional mode: upload both files separately"}
            </p>
          </div>

          {/* Template Management */}
          {cosTemplates && cosTemplates.length > 0 && (
            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Your Templates:</p>
              <div className="space-y-2">
                {cosTemplates.map((template) => (
                  <div key={template._id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {template.name} 
                      <span className="text-gray-400 ml-2">
                        (created {new Date(template.createdAt).toLocaleDateString()})
                      </span>
                    </span>
                    <button
                      onClick={() => handleDeleteTemplate(template._id)}
                      className="text-red-600 hover:text-red-800 text-xs"
                      disabled={isUploading}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Template Modal */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create COS Template</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g., Plaksha UG 2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-darkgreen"
                  disabled={isUploading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course of Study PDF
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setTemplateCosFile(e.target.files?.[0] || null)}
                  className="w-full"
                  disabled={isUploading}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>Tip:</strong> Saved templates are cached for ultra-fast processing and 90% cost savings!
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateTemplate}
                disabled={isUploading || !newTemplateName.trim() || !templateCosFile}
                className="flex-1 px-4 py-2 bg-darkgreen text-white rounded-lg hover:bg-darkgreen-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? "Creating..." : "Create Template"}
              </button>
              <button
                onClick={() => {
                  setShowCreateTemplateModal(false);
                  setNewTemplateName("");
                  setTemplateCosFile(null);
                }}
                disabled={isUploading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dual PDF Upload Section (Traditional Mode) */}
      {cosMode === "dual" && (
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
                className="px-6 py-2 bg-darkgreen text-white rounded-lg hover:bg-darkgreen-dark disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-6 py-2 bg-darkgreen text-white rounded-lg hover:bg-darkgreen-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {courseOfStudyFile ? courseOfStudyFile.name : "Choose Course of Study PDF"}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Transcript Upload (Template/One-Time Mode) */}
      {(cosMode === "template" || cosMode === "one-time") && (
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
                className="px-6 py-2 bg-darkgreen text-white rounded-lg hover:bg-darkgreen-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transcriptFile ? transcriptFile.name : "Choose Transcript PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One-Time COS Upload */}
      {cosMode === "one-time" && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Course of Study (One-Time)
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload COS for this session only. Won't be saved as a template.
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
                className="px-6 py-2 bg-darkgreen text-white rounded-lg hover:bg-darkgreen-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {courseOfStudyFile ? courseOfStudyFile.name : "Choose COS PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Process Button - Dual Mode */}
      {cosMode === "dual" && transcriptFile && courseOfStudyFile && (
        <div className="text-center">
          <button
            onClick={handleProcessPDFs}
            disabled={isUploading}
            className="px-8 py-3 bg-darkgreen text-white rounded-lg hover:bg-darkgreen-dark disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
          >
            {isUploading ? "Processing..." : "Process PDFs"}
          </button>
        </div>
      )}

      {/* Process Button - Template Mode */}
      {cosMode === "template" && selectedTemplate && transcriptFile && (
        <div className="text-center">
          <button
            onClick={handleProcessPDFs}
            disabled={isUploading}
            className="px-8 py-3 bg-darkgreen text-white rounded-lg hover:bg-darkgreen-dark disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
          >
            {isUploading ? "Processing with Template..." : "Process with Template"}
          </button>
          <p className="text-sm text-green-600 mt-2">
            ⚡ Using cached template - 90% faster & cheaper!
          </p>
        </div>
      )}

      {/* Process Button - One-Time Mode */}
      {cosMode === "one-time" && transcriptFile && courseOfStudyFile && (
        <div className="text-center">
          <button
            onClick={handleProcessPDFs}
            disabled={isUploading}
            className="px-8 py-3 bg-darkgreen text-white rounded-lg hover:bg-darkgreen-dark disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
          >
            {isUploading ? "Processing..." : "Process (One-Time)"}
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-darkgreen h-2 rounded-full transition-all duration-300"
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
                    
                    {dualTranscript.processingStatus === "completed" && (dualTranscript.extractedCourses || (dualTranscript as any).geminiResults) && (
                      <div className="mt-2 space-y-2">
                        {(() => {
                          const gemini = (dualTranscript as any).geminiResults;
                          if (gemini && gemini.matches) {
                            return (
                              <>
                                <p className="text-sm text-green-600">
                                  ✅ Matched {gemini.matches.length} courses (Grade ≥ {dualTranscript.gradeThreshold})
                                </p>
                                {Array.isArray(gemini.unmatched) && gemini.unmatched.length > 0 && (
                                  <p className="text-sm text-amber-600">
                                    ⚠️ Unmatched: {gemini.unmatched.length}
                                  </p>
                                )}
                              </>
                            );
                          }
                          // Legacy display for extractedCourses/curriculumCourses
                          return (
                            <>
                              <p className="text-sm text-green-600">
                                ✅ Found {dualTranscript.extractedCourses.length} courses (Grade ≥ {dualTranscript.gradeThreshold})
                              </p>
                              {dualTranscript.curriculumCourses && (
                                <p className="text-sm text-blue-600">
                                  📚 Found {dualTranscript.curriculumCourses.length} curriculum courses
                                </p>
                              )}
                            </>
                          );
                        })()}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedDualTranscriptId(dualTranscript._id);
                              setShowAnalysis(false);
                            }}
                            className="px-4 py-2 bg-darkgreen text-white text-sm rounded-lg hover:bg-darkgreen-dark"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDualTranscriptId(dualTranscript._id);
                              setShowAnalysis(true);
                            }}
                            className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover"
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
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-darkgreen"></div>
                        <p className="text-sm text-darkgreen">
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
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <h4 className="text-sm font-semibold text-darkgreen mb-2">How Course Matching Works</h4>
        <ul className="text-sm text-darkgreen-light space-y-1">
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