"use client";

import {
  AccountSettings,
  SignIn,
  SignUp,
} from "@stackframe/stack";

import { StackFallbackPanel } from "@/components/auth/StackFallbackPanel";

function hasStackClientKeys() {
  return Boolean(
    process.env.NEXT_PUBLIC_STACK_PROJECT_ID &&
      process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  );
}

export function StackSignInPanel() {
  if (!hasStackClientKeys()) {
    return <StackFallbackPanel />;
  }

  return <SignIn fullPage />;
}

export function StackSignUpPanel() {
  if (!hasStackClientKeys()) {
    return <StackFallbackPanel />;
  }

  return <SignUp fullPage />;
}

export function StackAccountPanel() {
  if (!hasStackClientKeys()) {
    return <StackFallbackPanel />;
  }

  return <AccountSettings fullPage />;
}
