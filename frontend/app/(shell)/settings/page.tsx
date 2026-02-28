"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/common/page-header"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Trash2 } from "lucide-react"

export default function SettingsPage() {
  const [mockMode, setMockMode] = useState(true)

  return (
    <>
      <PageHeader title="Settings" description="Manage organization and data sources" />

      <div className="max-w-2xl space-y-6">
        {/* Org Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
            <CardDescription>Your organization details (read-only in MVP)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input value="My Startup Inc." disabled />
            </div>
            <div className="space-y-2">
              <Label>Organization ID</Label>
              <Input value="org_demo_001" disabled className="font-mono text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Data Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Sources</CardTitle>
            <CardDescription>Status of connected data sources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">CSV Upload</p>
                <p className="text-xs text-muted-foreground">Transactions & invoices</p>
              </div>
              <Badge variant="default">Connected</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Bank API</p>
                <p className="text-xs text-muted-foreground">Direct bank connection</p>
              </div>
              <Badge variant="secondary">V1</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Questionnaire</p>
                <p className="text-xs text-muted-foreground">Manual data entry</p>
              </div>
              <Badge variant="secondary">V1</Badge>
            </div>
          </CardContent>
        </Card>

        {/* API Config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Backend Base URL</Label>
              <Input
                value={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}
                disabled
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Mock API Mode</p>
                <p className="text-xs text-muted-foreground">
                  Use sample data instead of real backend
                </p>
              </div>
              <Switch
                checked={mockMode}
                onCheckedChange={setMockMode}
              />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your organization data including transactions,
                    invoices, and forecasts. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
