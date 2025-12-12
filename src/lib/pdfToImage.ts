/**
 * Client-side PDF to Image Conversion
 * 
 * Uses PDF.js to render PDF pages as PNG images at 300 DPI
 * These images can then be sent to Gemini 2.5 Flash Vision for OCR
 */

// @ts-expect-error: No type definitions for legacy build
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// Ensure worker is set
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

export interface ImageData {
  data: string; // base64 encoded PNG
  mimeType: string; // "image/png"
  pageNumber: number;
  width: number;
  height: number;
}

/**
 * Convert a single PDF page to PNG image at specified DPI
 * 
 * @param page - PDF.js page object
 * @param pageNumber - Page number (1-indexed)
 * @param dpi - Target DPI (default: 300)
 * @returns ImageData object with base64 PNG
 */
async function renderPageToImage(
  page: any,
  pageNumber: number,
  dpi: number = 300
): Promise<ImageData> {
  // Calculate scale based on DPI
  // PDF.js default is 72 DPI, so scale = targetDPI / 72
  const scale = dpi / 72;
  
  const viewport = page.getViewport({ scale });
  
  // Create canvas
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get canvas 2d context");
  }
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  // Render PDF page to canvas
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };
  
  await page.render(renderContext).promise;
  
  // Convert canvas to PNG data URL
  const dataUrl = canvas.toDataURL("image/png");
  
  // Extract base64 data (remove "data:image/png;base64," prefix)
  const base64Data = dataUrl.split(",")[1];
  
  console.log(
    `[PDF to Image] Rendered page ${pageNumber}: ${canvas.width}x${canvas.height}px, ` +
    `${Math.round(base64Data.length / 1024)}KB`
  );
  
  return {
    data: base64Data,
    mimeType: "image/png",
    pageNumber,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Convert entire PDF file to array of PNG images
 * 
 * @param file - PDF File object
 * @param dpi - Target DPI (default: 300)
 * @param onProgress - Progress callback (receives 0-1)
 * @returns Array of ImageData objects
 */
export async function convertPDFToImages(
  file: File,
  dpi: number = 300,
  onProgress?: (progress: number) => void
): Promise<ImageData[]> {
  console.log("[PDF to Images] Starting conversion:", file.name);
  console.log("[PDF to Images] Target DPI:", dpi);
  
  // Load PDF
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  console.log("[PDF to Images] PDF loaded:", pdf.numPages, "pages");
  
  const images: ImageData[] = [];
  
  // Convert each page
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const imageData = await renderPageToImage(page, i, dpi);
    images.push(imageData);
    
    if (onProgress) {
      onProgress(i / pdf.numPages);
    }
  }
  
  console.log("[PDF to Images] Conversion complete:", images.length, "images");
  
  return images;
}

/**
 * Check if PDF text extraction is likely to fail
 * Useful for deciding whether to use OCR upfront
 * 
 * @param file - PDF File object
 * @param threshold - Minimum characters for "good" extraction (default: 200)
 * @returns true if text extraction seems insufficient
 */
export async function shouldUseOCR(
  file: File,
  threshold: number = 200
): Promise<boolean> {
  try {
    // Quick text extraction test
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Check first page only for speed
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    
    const text = content.items
      .filter((item: any) => typeof item.str === "string")
      .map((item: any) => item.str)
      .join(" ");
    
    const hasText = text.trim().length >= threshold;
    
    console.log(
      `[Should Use OCR] First page has ${text.length} characters. ` +
      `Threshold: ${threshold}. Use OCR: ${!hasText}`
    );
    
    return !hasText;
  } catch (error) {
    console.error("[Should Use OCR] Error checking text:", error);
    // If we can't check, assume OCR is needed
    return true;
  }
}

/**
 * Estimate total size of images that would be generated
 * Useful for warning users about large uploads
 * 
 * @param file - PDF File object
 * @param dpi - Target DPI
 * @returns Estimated total size in MB
 */
export async function estimateImageSize(
  file: File,
  dpi: number = 300
): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  // Get first page to estimate dimensions
  const page = await pdf.getPage(1);
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });
  
  // Estimate PNG size: width * height * 4 bytes (RGBA) * compression factor (0.3)
  const estimatedBytesPerPage = viewport.width * viewport.height * 4 * 0.3;
  const totalBytes = estimatedBytesPerPage * pdf.numPages;
  const totalMB = totalBytes / (1024 * 1024);
  
  console.log(
    `[Estimate Size] ${pdf.numPages} pages at ${Math.round(viewport.width)}x${Math.round(viewport.height)}px ` +
    `≈ ${totalMB.toFixed(2)} MB`
  );
  
  return totalMB;
}
