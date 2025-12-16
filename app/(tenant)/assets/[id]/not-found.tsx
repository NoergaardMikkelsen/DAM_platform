import { Button } from "@/components/ui/button"
import { FileX } from "lucide-react"
import Link from "next/link"

export default function AssetNotFound() {
  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center p-8">
      <FileX className="mb-4 h-16 w-16 text-gray-400" />
      <h2 className="mb-2 text-2xl font-bold text-gray-900">Asset Not Found</h2>
      <p className="mb-6 text-gray-600">The asset you're looking for doesn't exist or has been removed.</p>
      <Link href="/assets">
        <Button className="bg-[#DF475C] hover:bg-[#C82333] rounded-[25px]">Back to Assets</Button>
      </Link>
    </div>
  )
}
