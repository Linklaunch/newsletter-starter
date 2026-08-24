import {Button} from '@/components/ui/button'
import {Page, PageSection} from '@/components/ui/app-shell'
import {H2, Muted} from '@/components/ui/typography'

const COPY: Record<string, {emoji: string; title: string}> = {
  '1': {emoji: '🔥', title: 'Glad you loved it.'},
  '2': {emoji: '🙂', title: 'Thanks. We will keep improving it.'},
  '3': {emoji: '😴', title: 'Thanks for letting us know.'}
}

export default async function FeedbackPage({
  searchParams
}: {
  searchParams: Promise<{rating?: string}>
}): Promise<React.JSX.Element> {
  const params = await searchParams
  const copy = COPY[params.rating ?? ''] ?? {
    emoji: '🙂',
    title: 'Thanks for your feedback.'
  }
  return (
    <Page className="mx-auto flex min-h-dvh w-full max-w-2xl items-center justify-center p-6">
      <PageSection className="w-full text-center">
        <div className="mb-5 text-6xl" aria-hidden="true">
          {copy.emoji}
        </div>
        <H2 className="mb-2 text-2xl">{copy.title}</H2>
        <Muted>
          Your feedback is anonymous and helps improve future issues.
        </Muted>
        <Button asChild className="mt-6">
          <a href="/">Return to Newsletter Starter</a>
        </Button>
      </PageSection>
    </Page>
  )
}
