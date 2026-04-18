import { ArrowLeft, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { PublicFooter } from "@/components/layout/public-footer"

const LAST_UPDATED = "April 2025"
const CONTACT_EMAIL = "privacy@ideamapper.app"

export function PrivacyPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/80 via-background to-background" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 md:px-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Home
            </Link>
          </Button>
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            Branchly
          </p>
        </div>

        <article className="mx-auto mt-12 w-full max-w-2xl flex-1 pb-16">
          <header className="mb-10 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: {LAST_UPDATED}
            </p>
          </header>

          <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Overview
              </h2>
              <p>
                Branchly ("we", "our", or "us") is a collaborative mind-mapping
                tool. This policy explains what information we collect when you use
                Branchly, how we use it, and how we keep it safe. By using
                Branchly you agree to this policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Information we collect
              </h2>
              <p>
                <strong>Account data.</strong> When you sign up we collect your
                email address. We do not collect your name, phone number, or
                payment information through the sign-up flow.
              </p>
              <p>
                <strong>Map and workspace content.</strong> We store the maps,
                nodes, and connections you create. This content is associated with
                your account and is not shared beyond your map collaborators.
              </p>
              <p>
                <strong>Usage data.</strong> We may log basic technical events
                (errors, page visits) to diagnose problems and improve the product.
                These logs do not include map content.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                How we use your information
              </h2>
              <ul className="ml-4 list-disc space-y-1.5 text-muted-foreground">
                <li>To operate and maintain your account and maps</li>
                <li>To authenticate you and enforce workspace access control</li>
                <li>To send you transactional emails (password reset, email confirmation)</li>
                <li>To diagnose errors and improve product reliability</li>
              </ul>
              <p>
                We do not sell your data. We do not use your map content to train
                machine-learning models.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Data storage and security
              </h2>
              <p>
                Branchly uses Supabase for authentication and database storage.
                Data is stored on infrastructure provided by Supabase, Inc. You can
                review their security and compliance information at{" "}
                <a
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                  href="https://supabase.com/security"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  supabase.com/security
                </a>
                .
              </p>
              <p>
                Access to your data is protected by row-level security policies.
                Only you and collaborators you have invited can read your map
                content.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Third-party services
              </h2>
              <p>
                We use the following third-party services to operate Branchly:
              </p>
              <ul className="ml-4 list-disc space-y-1.5 text-muted-foreground">
                <li>
                  <strong>Supabase</strong> — authentication, database, and storage
                </li>
              </ul>
              <p>
                We do not integrate advertising networks or social media trackers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Your rights
              </h2>
              <p>
                You may request deletion of your account and associated data at any
                time by contacting us at the address below. We will process your
                request within a reasonable timeframe.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Changes to this policy
              </h2>
              <p>
                We may update this policy as the product evolves. Material changes
                will be communicated via email or an in-app notice. Continued use
                after changes constitutes acceptance.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Contact</h2>
              <p>
                Questions about this policy?{" "}
                <a
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                  href={`mailto:${CONTACT_EMAIL}`}
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </section>
          </div>
        </article>

        <PublicFooter />
      </div>
    </div>
  )
}
