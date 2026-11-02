import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import LogoutButton from "./LogoutButton";

export default async function Nav() {
  const user = await getSessionUser();

  return (
    <nav className="border-b-[3px] border-outline-variant bg-surface-container-low px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/" className="font-heading text-xl font-bold text-primary">
          Eventify
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/events" className="font-heading text-sm font-bold text-on-surface">
            Events
          </Link>
          {user ? (
            <>
              <span className="flex items-center gap-2 font-heading text-sm font-bold text-on-surface">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-on-primary">
                  {user.first_name.charAt(0).toUpperCase()}
                </span>
                {user.first_name}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="font-heading text-sm font-bold text-primary">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-primary px-4 py-2 font-heading text-sm font-bold text-on-primary"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
