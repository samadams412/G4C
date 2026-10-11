import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import LogoutButton from "./LogoutButton";

export default async function Nav() {
  const user = await getSessionUser();

  return (
    <nav className="border-b-[3px] border-coral/20 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/" className="font-heading text-xl font-bold text-coral">
          Eventify
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/events" className="font-heading text-sm font-bold text-ink">
            Events
          </Link>
          {user ? (
            <>
              <span className="flex items-center gap-2 font-heading text-sm font-bold text-ink">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet text-xs text-white">
                  {user.first_name.charAt(0).toUpperCase()}
                </span>
                {user.first_name}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="font-heading text-sm font-bold text-violet">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-violet px-4 py-2 font-heading text-sm font-bold text-white"
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
