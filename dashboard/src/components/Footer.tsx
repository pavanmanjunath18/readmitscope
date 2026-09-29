import { Github } from 'lucide-react'
import { REPO_URL } from '../format'
import type { Meta } from '../types'

export default function Footer({ meta }: { meta: Meta }) {
  return (
    <footer className="border-t border-white/10 mt-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 flex flex-col sm:flex-row justify-between gap-3 text-xs text-gray-400">
        <p>
          Sources: {meta.source}; {meta.enrichment_source}. Data is a public U.S.
          Government work; analysis and interpretations are the author's own and do not
          represent CMS.
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:shrink-0">
          Built by Pavan Mallipudi · ReadmitScope US ·
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-gray-300 hover:text-vital transition"
          >
            <Github size={13} aria-hidden /> GitHub
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </p>
      </div>
    </footer>
  )
}
