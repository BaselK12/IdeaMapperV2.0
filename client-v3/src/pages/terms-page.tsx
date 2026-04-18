import { ArrowLeft, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { PublicFooter } from "@/components/layout/public-footer"

const LAST_UPDATED = "April 2025"
const CONTACT_EMAIL = "hello@ideamapper.app"

export function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: {LAST_UPDATED}
            </p>
          </header>

          <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Acceptance of terms
              </h2>
              <p>
                By creating an account or using Branchly you agree to these
                Terms of Service. If you do not agree, do not use the product.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Use of the service
              </h2>
              <p>
                Branchly is a collaborative mind-mapping tool. You may use
                Branchly for personal or professional purposes subject to these
                terms. You must be at least 16 years old to create an account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Account responsibilities
              </h2>
              <p>
                You are responsible for maintaining the security of your account
                credentials. Use a strong password and do not share your account
                with others. Notify us immediately if you suspect unauthorized
                access.
              </p>
              <p>
                You are responsible for all activity that occurs under your account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Acceptable use
              </h2>
              <p>You agree not to use Branchly to:</p>
              <ul className="ml-4 list-disc space-y-1.5 text-muted-foreground">
                <li>
                  Violate any applicable law or regulation
                </li>
                <li>
                  Upload or share content that is harmful, abusive, or infringes
                  the rights of others
                </li>
                <li>
                  Attempt to gain unauthorized access to other accounts or systems
                </li>
                <li>
                  Interfere with or disrupt the integrity or performance of the
                  service
                </li>
                <li>
                  Use the service for large-scale automated scraping or data
                  extraction
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Your content
              </h2>
              <p>
                You retain ownership of the maps and content you create in
                Branchly. By using the service you grant us a limited license to
                store and display your content for the purpose of operating the
                product.
              </p>
              <p>
                We do not claim ownership of your content and do not use it for
                any purpose beyond operating the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Service availability
              </h2>
              <p>
                We aim to keep Branchly available and reliable, but we do not
                guarantee uninterrupted uptime. We may modify, suspend, or
                discontinue the service with reasonable notice where possible.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Disclaimer of warranties
              </h2>
              <p>
                Branchly is provided "as is" without warranties of any kind,
                express or implied. We do not warrant that the service will be
                error-free, uninterrupted, or suitable for any particular purpose.
                Your use of the service is at your own risk.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Limitation of liability
              </h2>
              <p>
                To the maximum extent permitted by law, Branchly and its
                contributors shall not be liable for any indirect, incidental,
                special, or consequential damages arising from your use of or
                inability to use the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Changes to these terms
              </h2>
              <p>
                We may update these terms as the product evolves. Material changes
                will be communicated via email or an in-app notice. Continued use
                after changes constitutes acceptance of the revised terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Contact</h2>
              <p>
                Questions about these terms?{" "}
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
