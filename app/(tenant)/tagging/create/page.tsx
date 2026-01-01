"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CreateTagPage() {
  const router = useRouter()

  useEffect(() => {
    // Tag creation is only allowed via upload modal
    // Redirect to tagging page
    router.replace("/tagging")
  }, [router])

  return null
}
