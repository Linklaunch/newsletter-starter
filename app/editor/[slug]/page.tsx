import {EditorPage} from './editor-page'

interface PageProps {
  params: Promise<{slug: string}>
}

export default async function Page({params}: PageProps) {
  const {slug} = await params
  return <EditorPage slug={slug} />
}
