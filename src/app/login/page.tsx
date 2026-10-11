"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { BookOpen, ArrowRight, LoaderCircle } from "lucide-react";
import { loginSchema } from "@/lib/schemas";
import { COLLEGE_NAME, COLLEGE_SHORT_NAME } from "@/lib/branding";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<{ email: string; password: string }>({
    resolver: zodResolver(loginSchema),
  });
  return (
    <div className="login-page">
      <section className="login-art">
        <div className="brand">
          <span className="brand-icon">
            <BookOpen />
          </span>
          <span>
            folio<span className="brand-sub">LICET BOOK BANK</span>
          </span>
        </div>
        <div className="login-quote">
          <p className="eyebrow">A WORLD WAITING TO BE OPENED</p>
          <h1>
            Great ideas begin
            <br />
            with a good book.
          </h1>
          <p>
            Your campus collection. Your next discovery.
            <br />
            One thoughtful place to bring it all together.
          </p>
          <div className="decor-books">
            <div>
              THE ART
              <br />
              OF LEARNING
            </div>
            <div>
              Ideas
              <br />
              <em>in motion.</em>
            </div>
            <div>
              STORIES
              <br />
              THAT STAY
            </div>
          </div>
        </div>
        <p className="login-bottom">
          Built for curious minds. Designed for your campus.
        </p>
      </section>
      <section className="login-form">
        <div>
          <p className="eyebrow">WELCOME TO {COLLEGE_SHORT_NAME} BOOK BANK</p>
          <h1>A new chapter awaits.</h1>
          <p className="muted mb-8">
            {COLLEGE_NAME}
            <br />
            Sign in to your Book Bank account to get started.
          </p>
          <form
            onSubmit={handleSubmit(async (data) => {
              setError("");
              try {
                const r = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data),
                });
                const body = await r.json();
                if (!r.ok) throw new Error(body.error);
                router.push("/dashboard");
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            })}
          >
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                placeholder="you@college.edu"
                {...register("email")}
              />
              {errors.email && (
                <small className="danger-text">
                  Enter a valid email address.
                </small>
              )}
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Your account password"
                {...register("password")}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button w-full justify-center mt-5"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <>
                  Sign in <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="login-help">
            Need an account or a password reset?
            <br />
            Contact your campus librarian.
          </p>
        </div>
      </section>
    </div>
  );
}
