import "server-only";
import { cookies } from "next/headers";

/** Cookie личности ученика: хранит household_id (общий для братьев/сестёр). */
export const STUDENT_COOKIE = "student_household";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getHouseholdId(): Promise<string | null> {
  const store = await cookies();
  return store.get(STUDENT_COOKIE)?.value ?? null;
}

export async function setHouseholdCookie(householdId: string): Promise<void> {
  const store = await cookies();
  store.set(STUDENT_COOKIE, householdId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function clearHouseholdCookie(): Promise<void> {
  const store = await cookies();
  store.delete(STUDENT_COOKIE);
}
