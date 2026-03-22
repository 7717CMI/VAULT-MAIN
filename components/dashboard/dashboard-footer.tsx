import Link from "next/link"
import { Phone, MapPin, Mail } from "lucide-react"

export function DashboardFooter() {
  return (
    <footer>
      {/* Contact Bar */}
      <div className="border-t bg-secondary">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-4 lg:grid-cols-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Phone className="size-5 shrink-0 text-accent" />
            <div>
              <p className="text-xs font-bold">United States</p>
              <a href="tel:+12524771362" className="text-xs text-muted-foreground hover:text-accent">+1-252-477-1362</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="size-5 shrink-0 text-accent" />
            <div>
              <p className="text-xs font-bold">United Kingdom</p>
              <a href="tel:+442039578553" className="text-xs text-muted-foreground hover:text-accent">+44-203-957-8553</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="size-5 shrink-0 text-accent" />
            <div>
              <p className="text-xs font-bold">Australia</p>
              <a href="tel:+61879247805" className="text-xs text-muted-foreground hover:text-accent">+61-8-7924-7805</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="size-5 shrink-0 text-accent" />
            <div>
              <p className="text-xs font-bold">India</p>
              <a href="tel:+918482850837" className="text-xs text-muted-foreground hover:text-accent">+91-848-285-0837</a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="bg-[#2d3436] text-gray-300">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {/* Business Enquiry & Offices */}
            <div className="lg:col-span-2">
              <h4 className="mb-4 text-sm font-bold text-white">For Business Enquiry:</h4>
              <a href="mailto:sales@coherentmarketinsights.com" className="mb-6 flex items-center gap-2 text-sm hover:text-accent">
                <Mail className="size-4" />
                sales@coherentmarketinsights.com
              </a>

              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-xs font-bold text-white">U.S. Office:</p>
                  <p className="mt-1 flex items-start gap-2 text-xs leading-relaxed">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    Coherent Market Insights Pvt Ltd, 533 Airport Boulevard, Suite 400, Burlingame, CA 94010, United States.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">UK Office:</p>
                  <p className="mt-1 flex items-start gap-2 text-xs leading-relaxed">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    Coherent Market Insights Pvt Ltd, Office 15811, 182-184 High Street North, East Ham, London E6 2JA, United Kingdom.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">India Office (Headquarters):</p>
                  <p className="mt-1 flex items-start gap-2 text-xs leading-relaxed">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    Coherent Market Insights Pvt Ltd, 401, 4th Floor, Bremen Business Center, Aundh, Pune, Maharashtra 411007, India.
                  </p>
                </div>
              </div>
            </div>

            {/* Menu */}
            <div>
              <h4 className="mb-4 text-sm font-bold text-white">Menu</h4>
              <ul className="space-y-2.5 text-xs">
                <li><a href="https://www.coherentmarketinsights.com/aboutus" target="_blank" rel="noopener noreferrer" className="hover:text-accent">About Us</a></li>
                <li><a href="https://www.coherentmarketinsights.com/industries" target="_blank" rel="noopener noreferrer" className="hover:text-accent">Industries</a></li>
                <li><a href="https://www.coherentmarketinsights.com/services" target="_blank" rel="noopener noreferrer" className="hover:text-accent">Services</a></li>
                <li><a href="https://www.coherentmarketinsights.com/contact-us" target="_blank" rel="noopener noreferrer" className="hover:text-accent">Contact Us</a></li>
              </ul>
            </div>

            {/* Reader Club */}
            <div>
              <h4 className="mb-4 text-sm font-bold text-white">Reader Club</h4>
              <ul className="space-y-2.5 text-xs">
<li><Link href="#" className="hover:text-accent">Blogs</Link></li>
                <li><Link href="#" className="hover:text-accent">Guest Post Placement</Link></li>
                <li><Link href="#" className="hover:text-accent">News</Link></li>
                <li><Link href="#" className="hover:text-accent">Careers</Link></li>
              </ul>
            </div>

            {/* Help & Connect */}
            <div>
              <h4 className="mb-4 text-sm font-bold text-white">Help</h4>
              <ul className="space-y-2.5 text-xs">
                <li><Link href="#" className="hover:text-accent">Become Reseller</Link></li>
                <li><Link href="#" className="hover:text-accent">How To Order</Link></li>
                <li><Link href="#" className="hover:text-accent">Terms and Conditions</Link></li>
                <li><Link href="#" className="hover:text-accent">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-accent">Disclaimer</Link></li>
                <li><Link href="#" className="hover:text-accent">Sitemap</Link></li>
                <li><Link href="#" className="hover:text-accent">Feeds</Link></li>
              </ul>

              <div className="mt-6">
                <p className="text-xs font-bold text-white">HR Contact:</p>
                <a href="tel:+917262891127" className="mt-1 flex items-center gap-2 text-xs hover:text-accent">
                  <Phone className="size-3.5" />
                  +91-7262891127
                </a>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-xs font-bold text-white">Connect With Us:</p>
                <div className="flex gap-2">
                  <a href="https://www.linkedin.com/company/coherent-market-insights/" target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-accent hover:text-white" aria-label="LinkedIn">
                    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </a>
                  <a href="https://x.com/CoherentMI" target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-accent hover:text-white" aria-label="X">
                    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                  <a href="https://www.facebook.com/CoherentMarketInsights/" target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-accent hover:text-white" aria-label="Facebook">
                    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                  <a href="https://www.pinterest.com/coherentmarketinsights/" target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-accent hover:text-white" aria-label="Pinterest">
                    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>
                  </a>
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-xs font-bold text-white">Secure Payment By:</p>
                <div className="flex gap-2">
                  <div className="rounded bg-white px-2 py-1 text-[10px] font-bold text-blue-800">VISA</div>
                  <div className="rounded bg-white px-2 py-1 text-[10px] font-bold text-orange-500">DISCOVER</div>
                  <div className="rounded bg-white px-2 py-1 text-[10px] font-bold text-red-600">MasterCard</div>
                  <div className="rounded bg-white px-2 py-1 text-[10px] font-bold text-blue-600">AMEX</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 bg-[#232b2d]">
          <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8">
            <p className="text-center text-xs text-gray-500">
              &copy; {new Date().getFullYear()} Coherent Market Insights Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
