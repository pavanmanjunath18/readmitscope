import type { Meta } from '../types'

export default function Footer({ meta }: { meta: Meta }) {
  return (
    <footer className="border-t border-white/10 mt-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 flex flex-col sm:flex-row justify-between gap-3 text-xs text-gray-500">
        <p>
          Sources: {meta.source}; {meta.enrichment_source}. Data is a public U.S.
          Government work; analysis and interpretations are the author's own and do not
          represent CMS.
        </p>
        <p className="whitespace-nowrap">
          Built by Pavan Mallipudi · ReadmitScope US
        </p>
      </div>
    </footer>
  )
}
