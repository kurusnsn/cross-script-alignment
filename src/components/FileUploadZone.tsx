"use client"

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileImage, FileText, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const API_BASE = "/api/backend"

interface UploadedResult {
  extracted_text: string
  aligneration: string
  translation: string
  ipa: string
  source_type: 'image' | 'pdf' | 'text'
  source_language: string
  target_language: string
  filename: string
  file_size: number
}

interface FileUploadZoneProps {
  sourceLang?: string
  targetLang?: string
  onSuccess?: (result: UploadedResult) => void
  className?: string
}

export default function FileUploadZone({
  sourceLang = "",
  targetLang = "en",
  onSuccess,
  className = ""
}: FileUploadZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    setUploadedFile(file)
    setUploading(true)
    setError(null)
    setSuccess(false)

    try {
      // Create FormData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source_lang', sourceLang)
      formData.append('target_lang', targetLang)

      // Upload to backend
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Upload failed: ${response.status}`)
      }

      const result: UploadedResult = await response.json()

      setSuccess(true)
      setError(null)

      // Call success callback
      if (onSuccess) {
        onSuccess(result)
      }

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false)
        setUploadedFile(null)
      }, 3000)

    } catch (err: any) {
      console.error('❌ Upload failed:', err)
      setError(err.message || 'Upload failed')
      setSuccess(false)
    } finally {
      setUploading(false)
    }
  }, [sourceLang, targetLang, onSuccess])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false,
    disabled: uploading
  })

  const handleClearError = () => {
    setError(null)
    setUploadedFile(null)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <Card
        {...getRootProps()}
        className={`
          border-2 cursor-pointer transition-all
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-destructive' : ''}
          ${success ? 'border-green-500' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="p-6 text-center">
          {uploading ? (
            <div className="space-y-3">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
              <p className="text-sm font-medium">Processing {uploadedFile?.name}...</p>
              <p className="text-xs text-[#9CA3AF]">
                Extracting text and alignerating
              </p>
            </div>
          ) : success ? (
            <div className="space-y-3">
              <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
              <p className="text-sm font-medium text-green-600">
                Successfully processed {uploadedFile?.name}
              </p>
              <p className="text-xs text-[#9CA3AF]">
                See results below
              </p>
            </div>
          ) : error ? (
            <div className="space-y-3">
              <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
              <p className="text-sm font-medium text-destructive">Upload failed</p>
              <p className="text-xs text-destructive/80">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearError()
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-4">
                <FileImage className="h-8 w-8 text-[#9CA3AF]/50" />
                <Upload className="h-6 w-6 text-primary" />
                <FileText className="h-8 w-8 text-[#9CA3AF]/50" />
              </div>

              {isDragActive ? (
                <p className="text-sm font-medium text-primary">
                  Drop file here to upload
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Drag & drop file or click to browse
                  </p>
                  <div className="flex items-center justify-center space-x-2">
                    <Badge variant="secondary" className="text-xs">Images (PNG, JPG, WebP)</Badge>
                    <Badge variant="secondary" className="text-xs">PDF</Badge>
                  </div>
                  <p className="text-xs text-[#9CA3AF]">
                    Maximum file size: 5MB
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* File info */}
      {uploadedFile && !uploading && !error && !success && (
        <div className="flex items-center justify-between text-xs text-[#9CA3AF] p-2 bg-[#2A2A28] rounded">
          <div className="flex items-center space-x-2">
            {uploadedFile.type.startsWith('image/') ? (
              <FileImage className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span>{uploadedFile.name}</span>
            <Badge variant="outline" className="text-xs">
              {(uploadedFile.size / 1024).toFixed(1)} KB
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearError}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
