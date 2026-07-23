import { redirect } from "next/navigation";
import { isTeacher } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await isTeacher()) redirect("/dashboard");
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
