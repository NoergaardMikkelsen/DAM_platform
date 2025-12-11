import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail } from "lucide-react"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-2xl font-bold text-[#D35D6E]">nørgård mikkelsen ↗</div>
          </div>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-4">
            <Mail className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-center">Check your email</CardTitle>
          <CardDescription className="text-center">
            We've sent you a confirmation email. Please click the link in the email to verify your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full bg-[#D35D6E] hover:bg-[#C24D5E]">
            <a href="/login">Go to login</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
