# Plaksha Course Matcher - User Manual

**Version 1.0** | Last Updated: November 19, 2025

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Step-by-Step Guide](#step-by-step-guide)
4. [Understanding Your Results](#understanding-your-results)
5. [Tips for Best Results](#tips-for-best-results)
6. [Troubleshooting](#troubleshooting)
7. [Frequently Asked Questions](#frequently-asked-questions)

---

## Introduction

### What is Plaksha Course Matcher?

Plaksha Course Matcher is an AI-powered tool that analyzes your academic transcript and compares it against Plaksha University's curriculum. It helps you:

- **Identify course equivalencies** between your completed courses and Plaksha requirements
- **Discover curriculum gaps** that need to be filled
- **Plan your academic path** with personalized recommendations
- **Generate professional reports** for admissions or advising

### Who Should Use This Tool?

- **Transfer Students**: Understand how your previous coursework maps to Plaksha
- **Prospective Students**: Assess your preparedness for Plaksha's curriculum
- **Academic Advisors**: Evaluate student backgrounds for placement decisions
- **Current Students**: Identify missing requirements for graduation planning

---

## Getting Started

### System Requirements

- **Modern Web Browser**: Chrome, Firefox, Safari, or Edge (latest version)
- **Internet Connection**: Required for AI processing
- **PDF Documents**: 
  - Academic transcript (official or unofficial)
  - Course of Study document (course descriptions from your institution)

### Accessing the Application

1. Navigate to the application URL in your web browser
2. You'll see the welcome screen with the Plaksha Course Matcher header

```
┌──────────────────────────────────────────────────────────┐
│  Plaksha Course Matcher                     [Sign Out]   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│         AI-Powered Course Matching                       │
│                                                           │
│    Welcome back! Upload your transcript and course       │
│    of study documents for comprehensive curriculum       │
│    gap analysis.                                         │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### Authentication

**First-Time Users:**
1. Enter your email address
2. Create a password (min. 8 characters)
3. Click "Sign In" - an account will be automatically created

**Returning Users:**
1. Enter your email and password
2. Click "Sign In"

---

## Step-by-Step Guide

### Step 1: Sign In

<function_calls>
```
┌────────────────────────────────┐
│   Sign In to Continue          │
├────────────────────────────────┤
│  Email:                        │
│  [___________________]         │
│                                 │
│  Password:                     │
│  [___________________]         │
│                                 │
│     [Sign In with Password]    │
│                                 │
│  New users: Account created    │
│  automatically on first sign-in│
└────────────────────────────────┘
```

### Step 2: Prepare Your Documents

Before uploading, ensure you have:

**1. Academic Transcript (Required)**
- Contains course names, codes, grades, and credits
- Can be official or unofficial
- PDF format, max 10MB
- Should include all completed coursework

**2. Course of Study Document (Required)**
- Contains detailed course descriptions
- Often called "course catalog" or "syllabus collection"
- Helps the AI understand course content better
- PDF format, max 10MB

**Document Quality Tips:**
- Use clear, high-resolution PDFs
- Avoid heavily watermarked documents
- Ensure text is readable (not just scanned images)
- Multi-page documents are supported

### Step 3: Upload Your Documents

```
┌──────────────────────────────────────────────────────────┐
│  Upload Dual Documents                                    │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  📄 Transcript PDF                                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Click to upload or drag and drop               │    │
│  │  PDF files up to 10MB                           │    │
│  └─────────────────────────────────────────────────┘    │
│  [No file chosen]                                        │
│                                                           │
│  📚 Course of Study PDF                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Click to upload or drag and drop               │    │
│  │  PDF files up to 10MB                           │    │
│  └─────────────────────────────────────────────────┘    │
│  [No file chosen]                                        │
│                                                           │
│  Minimum Grade Threshold: [B ▼]                          │
│                                                           │
│         [Process PDFs and Analyze →]                     │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Upload Process:**
1. Click the transcript upload area or drag your transcript PDF
2. Wait for the file name to appear
3. Click the course of study upload area or drag the PDF
4. Select your minimum grade threshold (see below)
5. Click "Process PDFs and Analyze"

### Step 4: Set Grade Threshold

The grade threshold filters which courses are included in the analysis.

**Grade Options:**
- **A+, A, A-** (4.0-3.7 GPA): Only excellent grades
- **B+, B, B-** (3.3-3.0 GPA): Good grades and above
- **C+, C, C-** (2.3-2.0 GPA): Average grades and above
- **D+, D, D-** (1.3-1.0 GPA): Passing grades and above
- **F** (0.0 GPA): All courses including failures

**Recommendation:** Set threshold to **B** or higher for most accurate transfer credit evaluation.

```
Grade Threshold Visual:
┌────────┬────────┬────────┬────────┬────────┐
│   A+   │   B+   │   C+   │   D+   │   F    │
│  4.0   │  3.3   │  2.3   │  1.3   │  0.0   │
├────────┼────────┼────────┼────────┼────────┤
│ ✓ Best │ ✓ Good │ ✓ Pass │ ✓ Pass │ All    │
└────────┴────────┴────────┴────────┴────────┘
```

### Step 5: Wait for Processing

The system will now:

```
Processing Flow:
┌─────────────────────────────────────────┐
│ 1. Uploading files... (5-10 seconds)    │
│    ▓▓▓▓▓▓▓▓▓▓ 100%                     │
├─────────────────────────────────────────┤
│ 2. Extracting text... (10-20 seconds)   │
│    ▓▓▓▓▓▓▓▓░░ 80%                      │
├─────────────────────────────────────────┤
│ 3. AI course extraction... (30-60 sec)  │
│    ▓▓▓▓░░░░░░ 40%                      │
├─────────────────────────────────────────┤
│ 4. Matching courses... (20-40 seconds)  │
│    ▓▓░░░░░░░░ 20%                      │
├─────────────────────────────────────────┤
│ 5. Analyzing gaps... (10-20 seconds)    │
│    ░░░░░░░░░░ 0%                       │
└─────────────────────────────────────────┘
```

**Total Time:** 1-3 minutes depending on document size and number of courses

**What's Happening:**
1. **Text Extraction**: PDF.js extracts text while preserving layout
2. **AI Parsing**: Google Gemini identifies courses, grades, and credits
3. **Grade Filtering**: Courses below threshold are removed
4. **Hybrid Matching**: Three-layer AI compares courses to Plaksha curriculum
5. **Gap Analysis**: Identifies missing requirements and generates recommendations

---

## Understanding Your Results

### Results Overview

After processing, you'll see a comprehensive analysis page:

```
┌──────────────────────────────────────────────────────────┐
│  Analysis Results                                         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  📊 Analysis Summary                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Total Courses Analyzed:  24                    │    │
│  │  Matched Courses:         18                    │    │
│  │  Curriculum Gaps:         6                     │    │
│  │  Average Match Score:     85.3%                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  📚 Matched Courses                                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Data Structures (CS201)              [A]       │    │
│  │  Matches: CS202 - Data Structures                    │
│  │  92.3% match          [View Details →]          │    │
│  │  ● Vector: 90%  ● TF-IDF: 95%  ● Semantic: 91% │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ⚠️ Curriculum Gaps                                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  [HIGH PRIORITY]                                │    │
│  │  CS301: Algorithms and Complexity               │    │
│  │  Recommended for Semester 3                     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  💡 Recommendations                                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Based on your background, we recommend...      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│         [Download PDF Report]  [Re-analyze]             │
└──────────────────────────────────────────────────────────┘
```

### Analysis Summary

**Total Courses Analyzed:** Number of courses from your transcript (after grade filtering)

**Matched Courses:** Courses that have strong equivalents in Plaksha's curriculum

**Curriculum Gaps:** Plaksha core requirements you haven't fulfilled

**Average Match Score:** Overall quality of matches (higher is better)

### Matched Courses Section

Each matched course shows:

```
┌──────────────────────────────────────────────────────┐
│  Your Course Name (Code)                [Grade Badge]│
│  Matches: Plaksha Course Code - Plaksha Course Name │
│  XX.X% match                  [View Details →]      │
│  ● Vector: XX%  ● TF-IDF: XX%  ● Semantic: XX%     │
└──────────────────────────────────────────────────────┘
```

**Grade Badges:**
- **Green Badge [A]**: High performance (B or above)
- **Yellow Badge [C+ ⚠️]**: Lower performance (below B) - may need review

**Match Percentage:**
- **90-100%**: Excellent match, very strong equivalency
- **80-89%**: Strong match, good equivalency
- **70-79%**: Moderate match, may need supplemental work
- **60-69%**: Weak match, significant differences exist

**Similarity Components:**
- **🔵 Vector**: Semantic meaning similarity (AI embeddings)
- **🟢 TF-IDF**: Keyword and terminology overlap
- **🟣 Semantic**: GPT-4 contextual understanding

### Course Details Modal

Click "View Details →" to see comprehensive information:

```
┌──────────────────────────────────────────────────────────┐
│  Course Matching Details                        [Close ×]│
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Your Course:                                            │
│  Data Structures (CS201) - Grade: A, Credits: 4         │
│                                                           │
│  Description:                                            │
│  Study of fundamental data structures including arrays,  │
│  linked lists, stacks, queues, trees, and graphs...     │
│                                                           │
│  ──────────────────────────────────────────────         │
│                                                           │
│  Plaksha Match:                                          │
│  CS202: Data Structures and Algorithms                   │
│  Credits: 4, Semester: 2                                 │
│                                                           │
│  Description:                                            │
│  Comprehensive study of data structures and their        │
│  applications, including implementation and analysis...  │
│                                                           │
│  ──────────────────────────────────────────────         │
│                                                           │
│  Similarity Breakdown:                                   │
│  Overall Match: 92.3%                                    │
│                                                           │
│  Vector Similarity: 90%                                  │
│  ████████████████████░░  (Semantic embeddings)          │
│                                                           │
│  TF-IDF Similarity: 95%                                  │
│  ███████████████████░   (Keyword matching)              │
│                                                           │
│  Semantic AI: 91%                                        │
│  ████████████████████░░  (GPT-4 analysis)               │
│                                                           │
│  Key Matching Topics:                                    │
│  ✓ Arrays and linked lists                              │
│  ✓ Tree data structures                                 │
│  ✓ Graph algorithms                                     │
│  ✓ Time complexity analysis                             │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### Curriculum Gaps Section

Shows Plaksha courses you haven't taken:

```
┌──────────────────────────────────────────────────────┐
│  ⚠️ CURRICULUM GAPS (6 courses)                      │
├──────────────────────────────────────────────────────┤
│                                                       │
│  🔴 HIGH PRIORITY                                     │
│  CS301: Algorithms and Complexity                    │
│  Semester: 3 • Credits: 4                            │
│  Core requirement with prerequisites you've met      │
│                                                       │
│  🟡 MEDIUM PRIORITY                                   │
│  MATH202: Linear Algebra                             │
│  Semester: 2 • Credits: 4                            │
│  Foundation course for advanced topics               │
│                                                       │
│  🟢 LOW PRIORITY                                      │
│  ENG301: Technical Writing                           │
│  Semester: 3 • Credits: 2                            │
│  General education requirement                       │
└──────────────────────────────────────────────────────┘
```

**Priority Levels:**
- **🔴 High**: Core requirements for your target semester
- **🟡 Medium**: Important foundations for future courses
- **🟢 Low**: Electives or later-semester requirements

### Recommendations Section

Personalized advice based on your analysis:

```
┌──────────────────────────────────────────────────────┐
│  💡 RECOMMENDATIONS                                   │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ✓ Strong Foundation in Data Structures              │
│    Your DS courses provide excellent preparation     │
│    for advanced algorithms work at Plaksha.          │
│                                                       │
│  ⚠️ Mathematics Gap Identified                        │
│    Consider reviewing linear algebra before          │
│    enrolling in ML/AI courses. Self-study           │
│    resources recommended.                            │
│                                                       │
│  📚 Suggested Action Plan:                            │
│    1. Take MATH202 in first semester                 │
│    2. Enroll in CS301 concurrently or next semester │
│    3. Consider technical writing course for better   │
│       communication skills                           │
│                                                       │
│  🎯 Future Course Difficulty Assessment:              │
│    Based on your background, upcoming AI/ML courses  │
│    may require additional mathematical preparation.  │
└──────────────────────────────────────────────────────┘
```

### Algorithm Weightage Configuration

Understanding how matches are calculated:

```
┌──────────────────────────────────────────────────────┐
│  Algorithm Weightage Configuration  [Adjust Weightage]│
├──────────────────────────────────────────────────────┤
│                                                       │
│  Vector Similarity    TF-IDF Similarity   Semantic   │
│       40%                  30%              30%      │
│  ████████░░          ███░░░░░░          ███░░░░░░   │
│                                                       │
│  Final Score = 0.4×Vector + 0.3×TF-IDF + 0.3×Semantic│
└──────────────────────────────────────────────────────┘
```

Click "Adjust Weightage" to see sliders and understand the algorithm (display only - changes don't affect current results).

### Downloading Your Report

Click "Download PDF Report" to generate a comprehensive document:

**Report Contents:**
- Cover page with analysis date and student info
- Executive summary with key statistics
- Complete matched courses list with details
- Curriculum gaps analysis
- Detailed recommendations
- Appendix with methodology explanation

**PDF Features:**
- Professional formatting
- Print-ready layout
- Suitable for admissions or advising meetings
- Can be saved for your records

---

## Tips for Best Results

### Document Preparation

**For Transcripts:**
- ✅ Use official transcript if possible
- ✅ Ensure all pages are included
- ✅ Check that course codes and grades are visible
- ✅ Include course credit information
- ❌ Avoid heavily redacted documents
- ❌ Don't use poor-quality scans

**For Course of Study:**
- ✅ Include detailed course descriptions
- ✅ Use official course catalog if available
- ✅ Include learning objectives and topics
- ✅ Ensure text is readable (not just images)
- ❌ Avoid incomplete course listings
- ❌ Don't submit syllabi without descriptions

### Grade Threshold Selection

**Choose B or higher if:**
- Applying for transfer credit
- Need to meet minimum requirements
- Want conservative recommendations

**Choose C+ or lower if:**
- Conducting informal assessment
- Want to see all possible matches
- Planning self-study or review

### Improving Match Accuracy

1. **Provide detailed course descriptions**: The AI works better with more context
2. **Use standard naming**: Courses with clear names match better than abbreviations
3. **Include all relevant courses**: More data = better gap analysis
4. **Check your documents**: Ensure text extraction worked correctly

### Common Issues and Solutions

**Low Match Scores:**
- **Cause**: Courses truly different from Plaksha curriculum
- **Solution**: Review detailed breakdown to understand differences
- **Note**: Low scores don't mean poor education, just different focus

**Missing Matches:**
- **Cause**: Course names too different or specialized
- **Solution**: Check course details modal for partial matches
- **Tip**: AI may not recognize highly specialized or interdisciplinary courses

**Incorrect Grade Parsing:**
- **Cause**: Unusual transcript format
- **Solution**: Check extracted courses in verification step
- **Fix**: Note discrepancies for manual review with advisor

---

## Troubleshooting

### Upload Issues

**Problem: "File too large" error**
- **Solution**: Compress PDF or split into multiple documents
- **Limit**: 10MB per file
- **Tool**: Use online PDF compressors (reduce to 150-200 DPI)

**Problem: "Invalid file type" error**
- **Solution**: Ensure file is PDF format
- **Check**: File extension is `.pdf`, not `.doc`, `.jpg`, or other
- **Convert**: Use online tools to convert other formats to PDF

**Problem: Upload appears stuck**
- **Solution**: Check internet connection
- **Wait**: Large files may take 30-60 seconds to upload
- **Refresh**: If stuck > 2 minutes, refresh page and try again

### Processing Issues

**Problem: Processing takes too long (> 5 minutes)**
- **Cause**: Large document, many courses, or server load
- **Solution**: Wait patiently or refresh and retry
- **Contact**: If consistently fails, contact support

**Problem: "Text extraction failed" error**
- **Cause**: PDF is image-only (scanned) without text layer
- **Solution**: Use OCR software to add text layer, or request digital transcript
- **Tools**: Adobe Acrobat, online OCR services

**Problem: Courses extracted incorrectly**
- **Cause**: Unusual transcript format confuses AI
- **Solution**: Review extraction, note errors for advisor review
- **Manual**: Consider manual entry alternative (if available)

### Analysis Issues

**Problem: No matches found**
- **Cause**: Courses completely different from Plaksha curriculum
- **Check**: Verify correct PDFs uploaded
- **Review**: Lower match threshold in settings (if available)

**Problem: Too many gaps identified**
- **Expected**: Transfer students often have gaps
- **Solution**: Review recommendations for priority order
- **Note**: Gaps are opportunities, not deficiencies

**Problem: Match scores seem incorrect**
- **Understand**: AI uses semantic meaning, not just keywords
- **Review**: Click "View Details" to see reasoning
- **Feedback**: Note discrepancies for system improvement

### Authentication Issues

**Problem: "Invalid email/password" error**
- **Solution**: Double-check credentials
- **Reset**: Use password reset feature (if available)
- **New**: If first-time user, ensure creating new account

**Problem: Signed out unexpectedly**
- **Cause**: Session timeout (usually 24 hours)
- **Solution**: Sign in again
- **Data**: Your previous analyses are saved

---

## Frequently Asked Questions

### General Questions

**Q: Is my data secure?**
A: Yes. Documents are processed securely, encrypted in storage, and only accessible by you. We don't share your data with third parties.

**Q: How accurate is the matching?**
A: The hybrid AI system achieves 85-95% accuracy for standard courses. Specialized or interdisciplinary courses may have lower accuracy. Always review results with an academic advisor.

**Q: Can I use this for official transfer credit?**
A: This tool provides analysis and recommendations. Final transfer credit decisions are made by Plaksha's admissions office. Use this as a guide for discussions with advisors.

**Q: How long are my results saved?**
A: Results are saved indefinitely in your account. You can access them anytime by signing in.

**Q: Can I analyze multiple transcripts?**
A: Currently, one analysis per upload. For multiple transcripts, combine them into a single PDF or run separate analyses.

### Technical Questions

**Q: Why does processing take so long?**
A: The system performs complex AI operations:
- Text extraction from PDFs
- Course identification using Google Gemini
- Semantic embedding generation (3072 dimensions)
- TF-IDF calculation across curriculum
- GPT-4 similarity assessment
- Gap analysis and recommendation generation

Total time: 1-3 minutes is normal for 20-30 courses.

**Q: What are Vector, TF-IDF, and Semantic scores?**
A: Three different AI approaches:
- **Vector (40%)**: Semantic embeddings - understands meaning
- **TF-IDF (30%)**: Keyword matching - finds term overlap
- **Semantic (30%)**: GPT-4 analysis - contextual understanding

Combined, they provide robust matching.

**Q: Why do some courses have warning symbols?**
A: Yellow warning badge indicates grade below B (GPA < 3.0). These courses may not meet transfer credit requirements at some institutions.

**Q: Can I adjust the algorithm weights?**
A: Currently display-only to help you understand the system. Future versions may allow customization.

### Results Interpretation

**Q: What's a good match score?**
A:
- **90-100%**: Excellent, strong equivalency
- **80-89%**: Good, acceptable equivalency
- **70-79%**: Moderate, may need supplemental work
- **60-69%**: Weak, significant differences
- **< 60%**: Poor match, not recommended as equivalent

**Q: Why are some obvious matches rated low?**
A: AI considers content depth, learning objectives, and context - not just course names. A low score may indicate different emphasis or rigor.

**Q: Should I retake courses with low match scores?**
A: Not necessarily. Discuss with an academic advisor. Some differences can be addressed through self-study or supplemental courses.

**Q: What do priority levels mean for gaps?**
A:
- **High**: Core requirements for your target entry semester
- **Medium**: Important foundations needed for future courses
- **Low**: Electives or later-semester requirements

Focus on high-priority gaps first.

### Advanced Usage

**Q: Can I export results to other formats?**
A: Currently PDF export only. Future versions may support CSV, JSON, or Excel.

**Q: Can advisors access my results?**
A: Not automatically. You can share your PDF report or grant access (if feature available).

**Q: How do I report incorrect matches?**
A: Note discrepancies in your PDF report and discuss with your advisor. Feedback helps improve the system.

**Q: Can this tool evaluate non-academic experience?**
A: Currently no. The system only analyzes formal coursework from transcripts. Work experience, MOOCs, or certifications require separate evaluation.

---

## Support and Contact

### Getting Help

If you encounter issues not covered in this manual:

1. **Re-read relevant sections**: Many questions are answered in detail above
2. **Check Troubleshooting**: Common problems have solutions listed
3. **Contact Academic Advising**: For credit transfer decisions
4. **Technical Support**: For system bugs or persistent errors

### Providing Feedback

Your feedback helps improve the system:
- Report matching inaccuracies
- Suggest feature enhancements
- Share usability improvements
- Note document format issues

### Additional Resources

- **Technical Implementation Guide**: For developers and technical users
- **Plaksha Course Catalog**: Official curriculum information
- **Admissions Office**: Official transfer credit policies

---

## Appendix: Sample Workflow

### Complete Analysis Example

**Scenario**: Sarah is transferring from State University to Plaksha

**Step 1**: Sarah logs in with her email

**Step 2**: Uploads documents
- Transcript: 32 courses, grades B- to A+
- Course catalog: 150-page PDF with descriptions
- Grade threshold: Set to B

**Step 3**: Processing (2 minutes)
- 28 courses pass grade filter (4 below B excluded)
- AI extracts course codes, titles, descriptions
- System matches against 50+ Plaksha core courses

**Step 4**: Results
- 22 courses matched (79% match rate)
- 6 curriculum gaps identified
- Average match score: 83.2%
- 3 high-priority gaps, 2 medium, 1 low

**Step 5**: Review
- Strong matches in CS fundamentals (90%+ scores)
- Moderate matches in math (75-80% scores)
- Gap: Advanced algorithms course needed
- Gap: Linear algebra needs review

**Step 6**: Action
- Downloads PDF report
- Schedules meeting with Plaksha advisor
- Plans to take MATH202 in first semester
- Confident about CS placement, needs math support

**Outcome**: Clear understanding of standing and path forward

---

**End of User Manual**

For technical details about system architecture and implementation, see [TECHNICAL_IMPLEMENTATION.md](TECHNICAL_IMPLEMENTATION.md).
