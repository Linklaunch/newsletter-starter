import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'

export default function AccessDeniedPage(): React.JSX.Element {
  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-6">
      <Alert variant="destructive" className="max-w-md px-6 py-5 text-center">
        <AlertTitle className="text-xl font-bold">Access denied</AlertTitle>
        <AlertDescription className="mt-2">
          Your account is not authorized to use this console. Contact an
          administrator for access.
        </AlertDescription>
        <div className="mt-4">
          <Button asChild variant="outline">
            <a href="/api/auth/sign-out">Sign out</a>
          </Button>
        </div>
      </Alert>
    </div>
  )
}
