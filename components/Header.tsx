import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Zap } from "lucide-react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Button } from "./ui/button";
import PricingModal from "./PricingModal";
import { checkUser } from "@/lib/checkUser";
import { PLANS } from "@/lib/constants";

export const Header = async () => {
  const user = await checkUser();
  return (
    <header className="w-full fixed top-0 left-0 h-16 z-50 border-b border-white/6 bg-white/7 backdrop-blur-md">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/">
          <Image
            src={"/logo.png"}
            alt="logo"
            width={100}
            height={100}
            className="h-9 w-auto rounded-md"
          />
        </Link>

        <div className="flex items-center gap-5">
          <Show when="signed-in">
            <Link
              href={"/projects"}
              className="text-[13px] font-medium text-white/40 transition-colors hover:text-white/80"
            >
              Projects
            </Link>
            
           {user && ( <PricingModal>
              <span className="inline-flex h-8 gap-1.5 items-center rounded-full border border-white/10 bg-white/5 px-3 text-white/70">
              <Zap className="h-3 w-3 fill-white/70" />
              {user.credits} / {user.credits} credits
            </span>
            </PricingModal>)}
            
            <UserButton />
          </Show>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button
                variant={"ghost"}
                size={"sm"}
                className={" text-white/40 "}
              >
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button
                size={"sm"}
                className={
                  "h-8 rounded-full font-semibold active:scale-95 px-4 pt-0.5"
                }
              >
                Get Started
                <ArrowRight className="h-3 w-3 opacity-60" />
              </Button>
            </SignUpButton>
          </Show>
        </div>
      </nav>
    </header>
  );
};
