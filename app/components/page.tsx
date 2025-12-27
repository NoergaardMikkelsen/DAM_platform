"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Search, Trash2, Download, Upload, Settings, Copy, Check } from "lucide-react"

// Code example component with copy functionality
function CodeExample({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <div className="mt-4">
      {title && <h4 className="text-xs font-semibold text-gray-700 mb-2">{title}</h4>}
      <div className="relative group">
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
          <code>{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          title="Copy code"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  )
}

export default function ComponentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [alertDialogOpen, setAlertDialogOpen] = useState(false)
  const [useClientColors, setUseClientColors] = useState(false)
  
  // Interactive button state
  const [buttonVariant, setButtonVariant] = useState<"default" | "secondary" | "destructive" | "link">("default")
  const [buttonSize, setButtonSize] = useState<"sm" | "default" | "lg" | "icon">("default")
  const [buttonDisabled, setButtonDisabled] = useState(false)
  const [buttonWithIcon, setButtonWithIcon] = useState(false)

  // Mock tenant colors for demonstration
  const mockTenant = {
    primary_color: "#E55C6A",
    secondary_color: "#D9D9D9",
  }

  // Generate code example based on current button state
  const generateButtonCode = () => {
    const imports = ['import { Button } from "@/components/ui/button"']
    if (buttonWithIcon) {
      if (buttonSize === "icon") {
        imports.push('import { Settings } from "lucide-react"')
      } else {
        imports.push('import { Download } from "lucide-react"')
      }
    }
    
    const props: string[] = []
    if (buttonVariant !== "default") {
      props.push(`variant="${buttonVariant}"`)
    }
    if (buttonSize !== "default") {
      props.push(`size="${buttonSize}"`)
    }
    if (buttonDisabled) {
      props.push("disabled")
    }
    
    const propsString = props.length > 0 ? ` ${props.join(" ")}` : ""
    
    let content = ""
    if (buttonSize === "icon") {
      content = "  <Settings />"
    } else if (buttonWithIcon) {
      content = "  <Download className=\"mr-2 h-4 w-4\" />\n  Button Text"
    } else {
      content = "  Button Text"
    }
    
    return `${imports.join("\n")}\n\n<Button${propsString}>\n${content}\n</Button>`
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Component Library</h1>
            <p className="text-gray-600">Component showcase with code examples for Brand Assets Platform</p>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="color-toggle" className="text-sm text-gray-600 cursor-pointer">
              {useClientColors ? "Client Colors" : "Default Colors"}
            </Label>
            <Switch
              id="color-toggle"
              checked={useClientColors}
              onCheckedChange={setUseClientColors}
            />
          </div>
        </div>

        <Tabs defaultValue="buttons" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6 mb-8">
            <TabsTrigger value="buttons">Buttons</TabsTrigger>
            <TabsTrigger value="inputs">Inputs</TabsTrigger>
            <TabsTrigger value="cards">Cards</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="dialogs">Dialogs</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <TabsContent value="buttons" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Buttons</CardTitle>
                <CardDescription>Interactive button builder - customize and see the code update</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Live Preview */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Live Preview</h3>
                  <div className="flex items-center justify-center p-8 bg-white rounded-lg border border-gray-200">
                    <Button
                      variant={buttonVariant}
                      size={buttonSize}
                      disabled={buttonDisabled}
                      style={useClientColors && buttonVariant === "default" ? { backgroundColor: mockTenant.primary_color, color: 'white' } : undefined}
                      className={useClientColors && buttonVariant === "default" ? "hover:opacity-90" : undefined}
                    >
                      {buttonWithIcon && <Download className="mr-2 h-4 w-4" />}
                      {buttonSize === "icon" ? <Settings /> : "Button Text"}
                    </Button>
                  </div>
                </div>

                {/* Interactive Controls */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-semibold mb-3">Customize</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium text-gray-700 mb-2 block">Variant</Label>
                      <div className="flex flex-wrap gap-2">
                        {(["default", "secondary", "destructive", "link"] as const).map((variant) => (
                          <Button
                            key={variant}
                            variant={buttonVariant === variant ? "default" : "secondary"}
                            size="sm"
                            onClick={() => setButtonVariant(variant)}
                            style={buttonVariant === variant && useClientColors ? { backgroundColor: mockTenant.primary_color, color: 'white' } : undefined}
                            className={buttonVariant === variant && useClientColors ? "hover:opacity-90" : undefined}
                          >
                            {variant.charAt(0).toUpperCase() + variant.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs font-medium text-gray-700 mb-2 block">Size</Label>
                      <div className="flex flex-wrap gap-2">
                        {(["sm", "default", "lg", "icon"] as const).map((size) => (
                          <Button
                            key={size}
                            variant={buttonSize === size ? "default" : "secondary"}
                            size="sm"
                            onClick={() => setButtonSize(size)}
                            style={buttonSize === size && useClientColors ? { backgroundColor: mockTenant.primary_color, color: 'white' } : undefined}
                            className={buttonSize === size && useClientColors ? "hover:opacity-90" : undefined}
                          >
                            {size.charAt(0).toUpperCase() + size.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="disabled-toggle"
                          checked={buttonDisabled}
                          onCheckedChange={(checked) => setButtonDisabled(checked === true)}
                        />
                        <Label htmlFor="disabled-toggle" className="text-xs font-medium text-gray-700 cursor-pointer">
                          Disabled
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="icon-toggle"
                          checked={buttonWithIcon}
                          onCheckedChange={(checked) => setButtonWithIcon(checked === true)}
                        />
                        <Label htmlFor="icon-toggle" className="text-xs font-medium text-gray-700 cursor-pointer">
                          With Icon
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generated Code */}
                <CodeExample 
                  title="Generated Code"
                  code={generateButtonCode()}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inputs" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Inputs</CardTitle>
                <CardDescription>Form input components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="text-input">Text Input</Label>
                  <Input id="text-input" placeholder="Enter text..." />
                  <CodeExample 
                    code={`import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

<Label htmlFor="text-input">Text Input</Label>
<Input id="text-input" placeholder="Enter text..." />`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="search-input">Search Input</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input id="search-input" className="pl-10" placeholder="Search..." />
                  </div>
                  <CodeExample 
                    code={`import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search } from "lucide-react"

<Label htmlFor="search-input">Search Input</Label>
<div className="relative">
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
  <Input id="search-input" className="pl-10" placeholder="Search..." />
</div>`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="textarea">Textarea</Label>
                  <Textarea id="textarea" placeholder="Enter description..." rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Select</Label>
                  <Select>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                      <SelectItem value="option3">Option 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="checkbox1" />
                    <Label htmlFor="checkbox1">Checkbox option</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="checkbox2" defaultChecked />
                    <Label htmlFor="checkbox2">Checked by default</Label>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Radio Group</Label>
                  <RadioGroup defaultValue="option1">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option1" id="radio1" />
                      <Label htmlFor="radio1">Option 1</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option2" id="radio2" />
                      <Label htmlFor="radio2">Option 2</Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cards" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Card Component</CardTitle>
                <CardDescription>Card with header and content</CardDescription>
              </CardHeader>
              <CardContent>
                <p>This is the card content area. You can put any content here.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Another Card</CardTitle>
                <CardDescription>Cards can contain various content types</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Badge>Tag 1</Badge>
                  <Badge variant="secondary">Tag 2</Badge>
                </div>
                <p className="text-sm text-gray-600">Cards are great for grouping related content.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="badges" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
                <CardDescription>Badge variants and styles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3">Variants</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                    <Badge variant="outline">Outline</Badge>
                  </div>
                  <CodeExample 
                    code={`import { Badge } from "@/components/ui/badge"

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>`}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-3">Usage Examples</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge>New</Badge>
                    <Badge variant="secondary">Active</Badge>
                    <Badge variant="destructive">Deleted</Badge>
                    <Badge variant="outline">Draft</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dialogs" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Dialogs & Modals</CardTitle>
                <CardDescription>Dialog and alert dialog components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3">Dialog</h3>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        style={useClientColors ? { backgroundColor: mockTenant.primary_color, color: 'white' } : undefined}
                        className={useClientColors ? "hover:opacity-90" : undefined}
                      >
                        Open Dialog
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Dialog Title</DialogTitle>
                        <DialogDescription>
                          This is a dialog description. You can put any content here.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <p>Dialog content goes here.</p>
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="secondary" 
                          onClick={() => setDialogOpen(false)}
                          style={useClientColors ? { borderColor: mockTenant.secondary_color, color: mockTenant.secondary_color } : undefined}
                          className={useClientColors ? "hover:bg-[#E55C6A]/10" : undefined}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => setDialogOpen(false)}
                          style={useClientColors ? { backgroundColor: mockTenant.primary_color, color: 'white' } : undefined}
                          className={useClientColors ? "hover:opacity-90" : undefined}
                        >
                          Confirm
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-3">Alert Dialog</h3>
                  <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">Open Alert Dialog</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the item.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setAlertDialogOpen(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => setAlertDialogOpen(false)}
                          style={useClientColors ? { backgroundColor: mockTenant.primary_color, color: 'white' } : undefined}
                          className={useClientColors ? "hover:opacity-90" : undefined}
                        >
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="other" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Other Components</CardTitle>
                <CardDescription>Additional UI components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3">Accordion</h3>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>Is it accessible?</AccordionTrigger>
                      <AccordionContent>
                        Yes. It adheres to the WAI-ARIA design pattern.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>Is it styled?</AccordionTrigger>
                      <AccordionContent>
                        Yes. It comes with default styles that match the other components.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-3">Tooltip</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="secondary"
                          style={useClientColors ? { borderColor: mockTenant.secondary_color, color: mockTenant.secondary_color } : undefined}
                          className={useClientColors ? "hover:bg-[#E55C6A]/10" : undefined}
                        >
                          Hover me
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This is a tooltip</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-3">Progress</h3>
                  <div className="space-y-2">
                    <Progress value={33} />
                    <Progress value={66} />
                    <Progress value={100} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-3">Skeleton</h3>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-3">Separator</h3>
                  <div>
                    <p>Content above</p>
                    <Separator className="my-4" />
                    <p>Content below</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

