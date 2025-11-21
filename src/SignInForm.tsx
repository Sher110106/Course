"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = useState(false);

  const handleSSOAuth = async (formData: FormData) => {
    setSubmitting(true);
    
    try {
      // First try to sign in
      formData.set("flow", "signIn");
      await signIn("password", formData);
      toast.success("Welcome back!");
    } catch (signInError) {
      // If sign in fails, try to sign up (create new account)
      try {
        formData.set("flow", "signUp");
        await signIn("password", formData);
        toast.success("Account created successfully! Welcome!");
      } catch (signUpError) {
        // If both fail, show error
        toast.error("Authentication failed. Please check your credentials and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target as HTMLFormElement);
          void handleSSOAuth(formData);
        }}
      >
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Password"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign In"}
        </button>
        <div className="text-center text-sm text-secondary">
          <span>
            Enter your email and password to access the application.
            <br />
            If this is your first time, an account will be created automatically.
          </span>
        </div>
      </form>
    </div>
  );
}
