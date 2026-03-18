"use client"

import { useState } from "react"
import { Download, FileText, Table } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import jsPDF from "jspdf"
import { getPdfFontForText } from "@/lib/pdfFonts"

type TranslationData = {
  original: string
  aligneration: string
  translation: string
  ipa?: string
  timestamp?: Date
}

interface ExportButtonProps {
  data: TranslationData | TranslationData[]
  filename?: string
}

export default function ExportButton({ data, filename = "translations" }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const dataArray = Array.isArray(data) ? data : [data]

  const exportToCSV = () => {
    setIsExporting(true)
    try {
      // Create CSV header
      const headers = ["Original", "Transliteration", "Translation", "IPA", "Timestamp"]
      const csvRows = [headers.join(",")]

      // Add data rows
      dataArray.forEach((item) => {
        const row = [
          `"${item.original.replace(/"/g, '""')}"`,
          `"${item.aligneration.replace(/"/g, '""')}"`,
          `"${item.translation.replace(/"/g, '""')}"`,
          `"${item.ipa?.replace(/"/g, '""') || ''}"`,
          `"${item.timestamp?.toLocaleString() || new Date().toLocaleString()}"`,
        ]
        csvRows.push(row.join(","))
      })

      // Create blob and download
      const csvContent = csvRows.join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filename}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting CSV:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const exportToPDF = async () => {
    setIsExporting(true)
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 16
      const contentWidth = pageWidth - margin * 2
      let yPosition = margin

      const lineHeight = () =>
        (pdf.getFontSize() * pdf.getLineHeightFactor()) / pdf.internal.scaleFactor

      const ensureSpace = (height: number) => {
        if (yPosition + height > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
        }
      }

      const addSection = async (label: string, value?: string) => {
        const safeValue = value && value.trim().length > 0 ? value : "-"
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(9)
        const labelHeight = lineHeight()
        pdf.setTextColor(120)

        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(11)
        const { family, rtl } = await getPdfFontForText(pdf, safeValue)
        pdf.setFont(family, "normal")
        pdf.setR2L(rtl)
        const lines = pdf.splitTextToSize(safeValue, contentWidth)
        const valueHeight = lines.length * lineHeight()

        const sectionHeight = labelHeight + valueHeight + 2
        ensureSpace(sectionHeight)

        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(9)
        pdf.setTextColor(120)
        pdf.text(label.toUpperCase(), margin, yPosition)
        yPosition += labelHeight

        pdf.setFont(family, "normal")
        pdf.setFontSize(11)
        pdf.setTextColor(20)
        pdf.text(lines, margin, yPosition)
        pdf.setR2L(false)
        yPosition += valueHeight + 2
      }

      // Add title
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(16)
      pdf.setTextColor(20)
      pdf.text("Translation Export", margin, yPosition)
      yPosition += lineHeight()

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      pdf.setTextColor(120)
      pdf.text(`Exported ${new Date().toLocaleString()}`, margin, yPosition + 4)
      yPosition += 10

      for (const [index, item] of dataArray.entries()) {
        // Add item number if multiple items
        if (dataArray.length > 1) {
          pdf.setFont("helvetica", "bold")
          pdf.setFontSize(12)
          pdf.setTextColor(20)
          const headerHeight = lineHeight() + 2
          ensureSpace(headerHeight)
          pdf.text(`Translation ${index + 1}`, margin, yPosition)
          yPosition += headerHeight
        }

        await addSection("Original", item.original)
        await addSection("Transliteration", item.aligneration)
        await addSection("Translation", item.translation)
        if (item.ipa) {
          await addSection("IPA", item.ipa)
        }

        // Timestamp
        if (item.timestamp) {
          pdf.setFont("helvetica", "normal")
          pdf.setFontSize(8)
          pdf.setTextColor(120)
          const stampHeight = lineHeight() + 2
          ensureSpace(stampHeight)
          pdf.text(`Timestamp: ${item.timestamp.toLocaleString()}`, margin, yPosition)
          yPosition += stampHeight
        }

        // Add spacing and separator between items
        yPosition += 2
        if (index < dataArray.length - 1) {
          ensureSpace(6)
          pdf.setDrawColor(220)
          pdf.line(margin, yPosition, pageWidth - margin, yPosition)
          yPosition += 6
        }
      }

      // Save PDF
      pdf.save(`${filename}.pdf`)
    } catch (error) {
      console.error("Error exporting PDF:", error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          className="rounded-lg bg-[#1A1A19] border-[#2D2D2B] text-[#FAF9F5] hover:bg-[#1A1A19] hover:border-[#2DD4BF]/50 hover:text-[#2DD4BF] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-[#0F0F0D] border-[#2D2D2B] text-[#FAF9F5] shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
      >
        <DropdownMenuItem
          onClick={exportToPDF}
          className="focus:bg-[#1A1A19] focus:text-[#FAF9F5] [&_svg]:text-[#2DD4BF]"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={exportToCSV}
          className="focus:bg-[#1A1A19] focus:text-[#FAF9F5] [&_svg]:text-[#2DD4BF]"
        >
          <Table className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
