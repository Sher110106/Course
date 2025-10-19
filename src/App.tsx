import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { DualPDFUploader } from "./components/DualPDFUploader";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-primary">Dual PDF Analysis Tool</h2>
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
          AI-Powered Dual PDF Analysis
        </h1>
        <Authenticated>
          <p className="text-xl text-secondary">
            Welcome back, {loggedInUser?.email ?? "friend"}! Upload your transcript and course of study documents for comprehensive curriculum gap analysis.
          </p>
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-secondary">
            Enter your email and password to access the analysis tool. 
            <br />
            <span className="text-sm text-gray-600">
              New users will have accounts created automatically.
            </span>
          </p>
        </Unauthenticated>
      </div>

      <Authenticated>
        <DualPDFUploader />
      </Authenticated>

      <Unauthenticated>
        <div className="max-w-md mx-auto">
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}
