import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">北科課程</h1>
      <p className="text-muted-foreground mt-2 text-sm">資料層建置中。</p>
    </div>
  )
}
