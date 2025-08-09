import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { CurriculumAnalyzer } from "./components/CurriculumAnalyzer";
import { PDFUploader } from "./components/PDFUploader";
import { DualPDFUploader } from "./components/DualPDFUploader";
import { TestEnhancedExtraction } from "./components/TestEnhancedExtraction";
import TestCourseVerification from "./components/TestCourseVerification";
import TestCourseMatching from "./components/TestCourseMatching";
import MigrationHelper from "./components/MigrationHelper";
import { useState } from "react";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-primary">Plaksha Curriculum Mapper</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-8">
        <Content />
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [activeTab, setActiveTab] = useState<"manual" | "pdf" | "dual" | "test" | "verify" | "match" | "migrate">("manual");

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-primary mb-4">
          AI-Powered Curriculum Gap Analysis
        </h1>
        <Authenticated>
          <p className="text-xl text-secondary">
            Welcome back, {loggedInUser?.email ?? "friend"}! Map your courses to Plaksha University's curriculum.
          </p>
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-secondary">
            Sign in to analyze how your completed courses map to Plaksha University's curriculum
          </p>
        </Unauthenticated>
      </div>

      <Authenticated>
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("manual")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "manual"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                📝 Manual Course Entry
              </button>
              <button
                onClick={() => setActiveTab("pdf")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "pdf"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                📄 Single PDF Upload
              </button>
              <button
                onClick={() => setActiveTab("dual")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "dual"
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                🎯 Dual PDF Analysis
              </button>
              <button
                onClick={() => setActiveTab("test")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "test"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                🧪 Test Enhanced Extraction
              </button>
              <button
                onClick={() => setActiveTab("verify")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "verify"
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                🔍 Test Course Verification
              </button>
              <button
                onClick={() => setActiveTab("match")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "match"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                🔗 Test Course Matching
              </button>
              <button
                onClick={() => setActiveTab("migrate")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "migrate"
                    ? "border-yellow-500 text-yellow-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                🔧 Migration Helper
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "manual" && <CurriculumAnalyzer />}
        {activeTab === "pdf" && <PDFUploader />}
        {activeTab === "dual" && <DualPDFUploader />}
        {activeTab === "test" && <TestEnhancedExtraction />}
        {activeTab === "verify" && <TestCourseVerification />}
        {activeTab === "match" && <TestCourseMatching />}
        {activeTab === "migrate" && <MigrationHelper />}
      </Authenticated>

      <Unauthenticated>
        <div className="max-w-md mx-auto">
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}
