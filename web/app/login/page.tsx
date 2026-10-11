import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-cream px-6 py-12">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
