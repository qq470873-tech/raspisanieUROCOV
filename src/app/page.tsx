import { redirect } from "next/navigation";
import { isTeacher } from "@/lib/auth";

export default async function Home() {
  redirect((await isTeacher()) ? "/dashboard" : "/login");
}
