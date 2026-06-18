import { Lightbulb } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * A "key insight" callout that turns a chart into a story beat:
 * one bold takeaway sentence + supporting detail, with the real number highlighted.
 */
export default function Insight({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 flex gap-3 rounded-xl border border-vital/25 bg-vital/[0.06] p-4">
      <Lightbulb size={18} className="mt-0.5 shrink-0 text-vital" />
      <p className="text-sm leading-relaxed text-gray-300">
        <span className="font-semibold text-vital-mint">Key insight — </span>
        {children}
      </p>
    </div>
  )
}
