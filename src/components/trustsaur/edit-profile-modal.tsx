'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile, useUpdateNickname } from './profile-data-access'

export function EditProfileModal({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: profile } = useProfile(wallet)
  const updateNickname = useUpdateNickname()
  const [nickname, setNickname] = useState('')

  // Reset to the current saved value every time the modal opens — render-time
  // state adjustment on a prop change (see connect-wallet-modal.tsx for the
  // same pattern) rather than an effect, to avoid the extra render.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setNickname(profile?.nickname ?? '')
  }

  async function save() {
    try {
      await updateNickname.mutateAsync(nickname.trim())
      onOpenChange(false)
    } catch {
      // updateNickname.error already surfaces the message below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="What should people see instead of your wallet address?"
            maxLength={24}
            disabled={updateNickname.isPending}
          />
          <p className="text-xs text-muted-foreground">
            1-24 characters: letters, numbers, spaces, - or _. Leave blank to show your wallet address instead.
          </p>
          {updateNickname.error && (
            <p className="text-xs text-red-400">{(updateNickname.error as Error).message}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={save}
            disabled={updateNickname.isPending}
            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400"
          >
            {updateNickname.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
