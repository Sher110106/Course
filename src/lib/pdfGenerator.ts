import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface AnalysisData {
  matchedCourses: Array<{
    userCourse: string;
    curriculumCourse: string;
    similarity: number;
    grade: string;
    userCourseDescription?: string;
    curriculumCourseDescription?: string;
    similarityBreakdown?: {
      vectorScore: number;
      tfidfScore: number;
      semanticScore: number;
      finalScore: number;
    };
    userCourseCode?: string;
    curriculumCourseCode?: string;
  }>;
  gapCourses: Array<{
    code: string;
    title: string;
    description: string;
    semester?: number;
    priority: "high" | "medium" | "low";
  }>;
  recommendations: Array<{
    type: "prerequisite" | "elective" | "core";
    message: string;
    courses: string[];
  }>;
  totalUserCourses: number;
  totalMatched: number;
  totalGaps: number;
  targetSemester: number;
}

export function generateAnalysisPDF(analysisData: AnalysisData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let currentY = margin;

  // Helper function to add text with word wrapping
  const addText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + (lines.length * (fontSize * 0.4)) + 5;
  };

  // Helper function to check if we need a new page
  const checkNewPage = (requiredSpace: number) => {
    if (currentY + requiredSpace > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  currentY = addText('Curriculum Gap Analysis Report', margin, currentY, contentWidth, 20);
  currentY += 5;

  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  currentY = addText('Comprehensive Analysis of Academic Progress and Requirements', margin, currentY, contentWidth, 12);
  currentY += 15;

  // Analysis Summary
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  currentY = addText('Analysis Summary', margin, currentY, contentWidth, 16);
  currentY += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryText = `Target Semester: ${analysisData.targetSemester} | ` +
    `User Courses: ${analysisData.totalUserCourses} | ` +
    `Matched: ${analysisData.totalMatched} | ` +
    `Gaps: ${analysisData.totalGaps}`;
  currentY = addText(summaryText, margin, currentY, contentWidth, 10);
  currentY += 15;

  // Matched Courses Section
  if (analysisData.matchedCourses.length > 0) {
    checkNewPage(50);
    
    // Section separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    currentY = addText('Matched Courses', margin, currentY, contentWidth, 14);
    currentY += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    analysisData.matchedCourses.forEach((match, index) => {
      checkNewPage(60);
      
      // Course title
      doc.setFont('helvetica', 'bold');
      currentY = addText(`${index + 1}. ${match.userCourse}`, margin, currentY, contentWidth - 35, 11);
      
      // Grade in a colored box (positioned to the right)
      const gradeText = `Grade: ${match.grade}`;
      const gradeWidth = 30;
      const gradeX = pageWidth - margin - gradeWidth;
      
      doc.setFillColor(0, 100, 200);
      doc.roundedRect(gradeX, currentY - 2, gradeWidth, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(gradeText, gradeX + 3, currentY + 3);
      doc.setTextColor(0, 0, 0);
      
      // Move to next line for the match information
      currentY += 8;
      
      // Matched curriculum course
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      currentY = addText(`Matches: ${match.curriculumCourse}`, margin + 15, currentY, contentWidth - 15, 10);
      
      // Similarity score with breakdown if available
      doc.setFont('helvetica', 'normal');
      const similarityPercent = (match.similarity * 100).toFixed(1);
      if (match.similarityBreakdown) {
        const breakdown = match.similarityBreakdown;
        currentY = addText(`Similarity: ${similarityPercent}% (Vector: ${(breakdown.vectorScore * 100).toFixed(1)}%, TF-IDF: ${(breakdown.tfidfScore * 100).toFixed(1)}%, Semantic: ${(breakdown.semanticScore * 100).toFixed(1)}%)`, margin + 15, currentY, contentWidth - 15, 9);
      } else {
        currentY = addText(`Similarity: ${similarityPercent}%`, margin + 15, currentY, contentWidth - 15, 9);
      }
      
      // Course codes if available
      if (match.userCourseCode || match.curriculumCourseCode) {
        const codes = [];
        if (match.userCourseCode) codes.push(`User: ${match.userCourseCode}`);
        if (match.curriculumCourseCode) codes.push(`Curriculum: ${match.curriculumCourseCode}`);
        currentY = addText(`Codes: ${codes.join(' | ')}`, margin + 15, currentY, contentWidth - 15, 8);
      }
      
      // Descriptions if available (truncated for better layout)
      if (match.userCourseDescription) {
        const truncatedDesc = match.userCourseDescription.length > 120 ? 
          match.userCourseDescription.substring(0, 120) + '...' : match.userCourseDescription;
        currentY = addText(`Your Course: ${truncatedDesc}`, margin + 15, currentY, contentWidth - 15, 8);
      }
      if (match.curriculumCourseDescription) {
        const truncatedDesc = match.curriculumCourseDescription.length > 120 ? 
          match.curriculumCourseDescription.substring(0, 120) + '...' : match.curriculumCourseDescription;
        currentY = addText(`Curriculum: ${truncatedDesc}`, margin + 15, currentY, contentWidth - 15, 8);
      }
      
      currentY += 8;
    });
  }

  // Gap Courses Section
  if (analysisData.gapCourses.length > 0) {
    checkNewPage(50);
    
    // Section separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    currentY = addText('Missing Requirements', margin, currentY, contentWidth, 14);
    currentY += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    analysisData.gapCourses.forEach((gap, index) => {
      checkNewPage(50);
      
      // Course title
      doc.setFont('helvetica', 'bold');
      currentY = addText(`${index + 1}. ${gap.title}`, margin, currentY, contentWidth - 45, 11);
      
      // Priority indicator with colored box (positioned to the right)
      const priorityColor = gap.priority === 'high' ? [220, 38, 38] : gap.priority === 'medium' ? [245, 158, 11] : [107, 114, 128];
      const priorityText = gap.priority === 'high' ? 'REQUIRED' : gap.priority === 'medium' ? 'IMPORTANT' : 'ELECTIVE';
      const priorityWidth = 40;
      const priorityX = pageWidth - margin - priorityWidth;
      
      doc.setFillColor(priorityColor[0], priorityColor[1], priorityColor[2]);
      doc.roundedRect(priorityX, currentY - 2, priorityWidth, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(priorityText, priorityX + 3, currentY + 3);
      doc.setTextColor(0, 0, 0);
      
      // Move to next line for the course details
      currentY += 8;
      
      // Course code
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      currentY = addText(`Code: ${gap.code}`, margin + 15, currentY, contentWidth - 15, 9);
      
      // Semester if available
      if (gap.semester) {
        currentY = addText(`Semester: ${gap.semester}`, margin + 15, currentY, contentWidth - 15, 9);
      }
      
      // Description (truncated for better layout)
      const truncatedDesc = gap.description.length > 100 ? 
        gap.description.substring(0, 100) + '...' : gap.description;
      currentY = addText(`Description: ${truncatedDesc}`, margin + 15, currentY, contentWidth - 15, 8);
      
      currentY += 8;
    });
  }

  // Recommendations Section
  if (analysisData.recommendations.length > 0) {
    checkNewPage(50);
    
    // Section separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    currentY = addText('Recommendations', margin, currentY, contentWidth, 14);
    currentY += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    analysisData.recommendations.forEach((rec, index) => {
      checkNewPage(40);
      
      // Recommendation type
      const typeText = rec.type === 'core' ? 'Core Requirement' : 
                      rec.type === 'elective' ? 'Elective Suggestion' : 'Prerequisite';
      
      doc.setFont('helvetica', 'bold');
      currentY = addText(`${index + 1}. ${typeText}`, margin, currentY, contentWidth - 40, 11);
      
      // Type indicator box (positioned to the right)
      const typeColor = rec.type === 'core' ? [220, 38, 38] : rec.type === 'elective' ? [59, 130, 246] : [34, 197, 94];
      const typeWidth = 35;
      const typeX = pageWidth - margin - typeWidth;
      
      doc.setFillColor(typeColor[0], typeColor[1], typeColor[2]);
      doc.roundedRect(typeX, currentY - 2, typeWidth, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(rec.type.toUpperCase(), typeX + 3, currentY + 3);
      doc.setTextColor(0, 0, 0);
      
      // Move to next line for the recommendation details
      currentY += 8;
      
      // Recommendation message
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      currentY = addText(rec.message, margin + 15, currentY, contentWidth - 15, 9);
      
      // Suggested courses
      if (rec.courses.length > 0) {
        const coursesText = rec.courses.length > 3 ? 
          rec.courses.slice(0, 3).join(', ') + ` (+${rec.courses.length - 3} more)` :
          rec.courses.join(', ');
        currentY = addText(`Suggested: ${coursesText}`, margin + 15, currentY, contentWidth - 15, 8);
      }
      
      currentY += 8;
    });
  }

  // Summary Section
  checkNewPage(50);
  
  // Section separator line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  currentY = addText('Summary', margin, currentY, contentWidth, 14);
  currentY += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const completionRate = analysisData.totalUserCourses > 0 ? 
    ((analysisData.totalMatched / analysisData.totalUserCourses) * 100).toFixed(1) : '0';
  
  // Summary box with background
  const summaryBoxHeight = 25;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, currentY - 2, contentWidth, summaryBoxHeight, 3, 3, 'F');
  
  const summaryContent = `This analysis shows that you have completed ${analysisData.totalUserCourses} courses, ` +
    `with ${analysisData.totalMatched} successfully matched to curriculum requirements (${completionRate}% completion rate). ` +
    `You still need to complete ${analysisData.totalGaps} courses to meet the curriculum requirements for semester ${analysisData.targetSemester}. ` +
    `Focus on the high-priority courses first to ensure timely graduation.`;
  
  currentY = addText(summaryContent, margin + 5, currentY, contentWidth - 10, 10);
  currentY += 15;

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, pageHeight - 10);
  }

  // Download the PDF
  const fileName = `curriculum-analysis-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

// Alternative function to generate PDF from HTML element
export async function generatePDFFromElement(elementId: string, filename: string = 'curriculum-analysis.pdf'): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF from element:', error);
    throw error;
  }
}
