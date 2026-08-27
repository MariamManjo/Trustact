'use client'

import { useState } from 'react'
import { TrustactFeature } from '@/components/trustsaur/trustsaur-feature'
import { OnboardingIntro } from '@/components/trustsaur/onboarding-intro'

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(true)

  if (showOnboarding) {
    return <OnboardingIntro onComplete={() => setShowOnboarding(false)} />
  }

  return <TrustactFeature />
}
