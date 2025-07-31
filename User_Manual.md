# Curriculum Gap Analysis Tool - User Manual

## Overview

The Curriculum Gap Analysis Tool is an AI-powered web application that helps students map their completed courses to Plaksha University's curriculum. The tool uses advanced semantic analysis to identify course equivalencies, highlight gaps in core requirements, and provide personalized recommendations for future academic planning.

## Getting Started

### 1. Accessing the Application
- Open your web browser and navigate to the application URL
- The application will load with a clean, modern interface

### 2. Authentication
- **Sign In Options:**
  - **Password Authentication:** Use your email and password
  - **Anonymous Sign-In:** Click "Continue as Guest" for a temporary session
- **Note:** Anonymous sessions are temporary and data may not persist

## Main Features

### 📝 Manual Course Entry

#### Adding Your Courses
1. **Select Target Semester:**
   - Choose which semester you plan to join Plaksha University (1-8)
   - This determines which core requirements will be analyzed

2. **Add Course Details:**
   - Click "Add Course" to open the course input form
   - Fill in the following information:
     - **Course Title:** The name of your course (e.g., "Introduction to Programming")
     - **Description:** Detailed description of what you learned (this is crucial for AI matching)
     - **Institution:** Where you took the course (optional)
     - **Credits:** Number of credits earned (optional)

3. **Course Description Tips:**
   - Be detailed and specific about topics covered
   - Include programming languages, tools, or methodologies learned
   - Mention projects, assignments, or practical work
   - Example: "Learned Python programming, data structures, algorithms, and object-oriented design. Completed projects including a student management system and basic web applications."

4. **Managing Courses:**
   - View all added courses in the list below the form
   - Edit courses by clicking the edit icon
   - Delete courses by clicking the delete icon
   - Courses are automatically saved as you add them

#### Running Analysis
1. **Prerequisites:**
   - Add at least one course before analyzing
   - Ensure you have selected a target semester

2. **Start Analysis:**
   - Click the "Analyze Curriculum" button
   - The system will process your courses using AI-powered semantic matching
   - Analysis typically takes 30-60 seconds

3. **Understanding Results:**
   - **Matched Courses:** Shows which of your courses map to Plaksha's curriculum
   - **Gap Courses:** Identifies core requirements you still need
   - **Future Challenges:** Predicts difficulty of upcoming courses
   - **Recommendations:** Provides actionable advice

### 📄 PDF Transcript Upload

#### Uploading Transcripts
1. **File Requirements:**
   - Only PDF files are accepted
   - Maximum file size: 10MB
   - Should contain course descriptions and grades

2. **Upload Process:**
   - Click "Choose PDF File" to select your transcript
   - The system will automatically extract text using OCR (Optical Character Recognition)
   - Processing includes:
     - Text extraction from PDF pages
     - Course identification and parsing
     - AI-powered content analysis

3. **Processing Status:**
   - **Uploaded:** File successfully uploaded
   - **Processing:** AI is extracting and analyzing courses
   - **Completed:** Ready for curriculum analysis
   - **Failed:** Error occurred during processing

#### Analysis Methods
1. **Vector AI (Fast):**
   - Uses vector embeddings for quick matching
   - Suitable for straightforward course comparisons
   - Faster processing time

2. **Hybrid AI (Recommended):**
   - Combines vector search, TF-IDF, and semantic analysis
   - More accurate matching for complex courses
   - Better handling of nuanced course descriptions
   - Recommended for best results

#### Running Transcript Analysis
1. **After Processing:**
   - Once status shows "Completed," click "Analyze Curriculum"
   - Choose your target semester
   - Select analysis method (Vector or Hybrid)

2. **Analysis Progress:**
   - Progress bar shows analysis status
   - Do not close the browser during analysis
   - Results will appear automatically when complete

## Understanding Your Results

### 📊 Analysis Summary
- **Matched Courses:** Number of your courses that map to Plaksha curriculum
- **Gap Courses:** Core requirements you still need to fulfill
- **Coverage Percentage:** How much of the core curriculum you've completed
- **Target Semester:** Your planned entry semester

### ✅ Matched Courses
- Shows your courses and their Plaksha equivalents
- Displays similarity percentage (how well they match)
- Higher percentages indicate better matches
- Example: "Introduction to Programming" → "CT101: Computational Thinking (85% match)"

### ⚠️ Gap Courses
- Core requirements missing from your background
- Shows course code, title, department, and semester
- These are courses you may need to take or get credit for
- Contact admissions about transfer credit options

### 🔮 Future Course Challenges
- Predicts difficulty of upcoming courses in your target semester
- Difficulty levels: Easy, Moderate, Challenging, Very Challenging
- Provides reasoning based on your academic background
- Helps you prepare for challenging courses

### 📚 Recommendations
- **For Gap Courses:** Suggestions for meeting missing requirements
- **Transfer Credit:** Contact admissions office for credit transfer
- **Placement Tests:** Some gaps can be filled through testing
- **Bridge Courses:** Additional preparation courses available
- **Challenging Courses:** Preparation strategies for difficult subjects

## Tips for Best Results

### Course Descriptions
- **Be Specific:** Include programming languages, tools, methodologies
- **Include Projects:** Mention practical work and assignments
- **Cover Scope:** Describe topics, skills, and learning outcomes
- **Avoid Generic Terms:** Use specific technical terminology

### Example Good Description:
"Comprehensive introduction to computer science covering Python programming, data structures (arrays, linked lists, trees), algorithms (sorting, searching), object-oriented design principles, and software development practices. Completed projects including a student database system and basic web applications using HTML/CSS."

### Example Poor Description:
"Learned about computers and programming."

### Target Semester Selection
- **Semester 1-2:** Freshman level courses
- **Semester 3-4:** Sophomore level, more specialized
- **Semester 5+:** Advanced courses and electives
- Choose based on your current academic level

## Troubleshooting

### Common Issues

#### Analysis Fails
- **Check Course Descriptions:** Ensure they're detailed and specific
- **Add More Courses:** Try adding additional courses for better matching
- **Check Internet Connection:** Analysis requires stable internet
- **Try Again:** Sometimes temporary server issues occur

#### No Matches Found
- **Improve Descriptions:** Add more detail to course descriptions
- **Add More Courses:** Include additional relevant courses
- **Check Target Semester:** Ensure semester selection is appropriate
- **Contact Support:** If issues persist

#### PDF Upload Issues
- **File Size:** Ensure PDF is under 10MB
- **File Format:** Only PDF files are supported
- **File Quality:** Ensure text is clear and readable
- **Try Manual Entry:** If PDF processing fails, use manual entry

### Getting Help
- **Contact Support:** For technical issues or questions
- **Documentation:** Check this manual for detailed instructions
- **FAQ:** Common questions and answers
- **Feedback:** Share suggestions for improving the tool

## Privacy and Data

### Data Storage
- Your course data is stored securely
- Transcripts are processed and stored temporarily
- Analysis results are saved for your reference
- You can delete your data at any time

### Data Usage
- Course information is used only for curriculum analysis
- No personal data is shared with third parties
- Analysis results are for your personal use only

## Advanced Features

### Multiple Analyses
- Run analysis multiple times with different courses
- Compare results from different target semesters
- Track your progress over time

### Course Management
- Edit course details anytime
- Add new courses and re-analyze
- Delete courses you no longer want to include

### Export Results
- Save analysis results for your records
- Share results with academic advisors
- Use results for transfer credit applications

## Best Practices

### Before Analysis
1. **Gather Course Information:** Collect detailed descriptions of all relevant courses
2. **Research Target Program:** Understand Plaksha's curriculum structure
3. **Prepare Descriptions:** Write detailed, specific course descriptions

### During Analysis
1. **Be Patient:** AI analysis takes time for accurate results
2. **Don't Close Browser:** Keep the application open during processing
3. **Review Results:** Carefully examine matches and gaps

### After Analysis
1. **Save Results:** Keep a copy of your analysis results
2. **Contact Admissions:** Discuss transfer credit possibilities
3. **Plan Ahead:** Use gap analysis to plan future coursework
4. **Follow Up:** Re-analyze as you complete additional courses

## Conclusion

The Curriculum Gap Analysis Tool provides a powerful way to understand how your academic background aligns with Plaksha University's curriculum. By following this manual and providing detailed course information, you'll get the most accurate and helpful analysis results for your academic planning.

Remember: The quality of your analysis depends on the detail and accuracy of the course information you provide. Take time to write comprehensive course descriptions for the best results.

