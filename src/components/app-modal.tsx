import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ReactNode } from 'react'

export function AppModal({
  children,
  title,
  trigger,
  submit,
  submitDisabled,
  submitLabel,
}: {
  children: ReactNode
  title: string
  trigger?: ReactNode
  submit?: () => void
  submitDisabled?: boolean
  submitLabel?: string
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger ?? <Button variant="outline">{title}</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">{children}</div>
        <DialogFooter>
          {submit ? (
            <Button
              type="submit"
              onClick={submit}
              disabled={submitDisabled}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400"
            >
              {submitLabel || 'Save'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
