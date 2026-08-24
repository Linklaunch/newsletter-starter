import {PromoEditorPage} from './promo-editor-page'

interface PageProps {
  params: Promise<{id: string}>
}

export default async function Page({params}: PageProps) {
  const {id} = await params
  return <PromoEditorPage id={id} />
}
