import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/inspections");
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
