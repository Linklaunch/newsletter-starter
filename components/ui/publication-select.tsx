import type {PublicationId} from '@/publications/types'
import {PUBLICATION_IDS, PUBLICATION_PICKER_LABEL} from '@/publications/display'
import {cn} from '@/lib/utils'

/**
 * Publication picker shared by the console, stats, and promo pages  -  replaces three
 * hand-copied native `<select>`s that each repeated the same option copy. Kept
 * as a native select (accessible, zero-dep); labels come from PUBLICATION_PICKER_LABEL.
 */
export function PublicationSelect({
  value,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel = 'Publication'
}: {
  value: PublicationId
  onChange: (publication: PublicationId) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}): React.JSX.Element {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value as PublicationId)}
      className={cn(
        'rounded-md border border-border bg-background px-2 py-1.5 text-sm',
        className
      )}>
      {PUBLICATION_IDS.map(id => (
        <option key={id} value={id}>
          {PUBLICATION_PICKER_LABEL[id]}
        </option>
      ))}
    </select>
  )
}
