"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileText, Table } from "lucide-react"
import { UserWord } from "@/lib/database"
import jsPDF from "jspdf"
import { getPdfFontForText } from "@/lib/pdfFonts"

interface WordsExportButtonProps {
  words: UserWord[]
}

export function WordsExportButton({ words }: WordsExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const exportToCSV = () => {
    setIsExporting(true)
    try {
      // Create CSV header
      const headers = ["Original", "Transliteration", "Translation", "Language", "Folder", "Added Date"]

      // Create CSV rows
      const rows = words.map(word => [
        word.original || "",
        word.aligneration || "",
        word.translation || "",
        word.language_code || "",
        word.folder || "",
        new Date(word.added_at).toLocaleDateString()
      ])

      // Combine headers and rows
      const csvContent = [
        headers.join(","),
        ...rows.map(row =>
          row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")
        )
      ].join("\n")

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      link.setAttribute("href", url)
      link.setAttribute("download", `my-words-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error exporting to CSV:", error)
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

      const addWordBlock = async (word: UserWord) => {
        const originalText = word.original || "-"
        const alignerationText = word.aligneration || ""
        const translationText = word.translation ? `→ ${word.translation}` : "→ -"
        const metadataParts: string[] = []
        if (word.language_code) metadataParts.push(`Lang: ${word.language_code}`)
        if (word.folder) metadataParts.push(`Folder: ${word.folder}`)
        metadataParts.push(`Added: ${new Date(word.added_at).toLocaleDateString()}`)
        const metadataText = metadataParts.join(" | ")

        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(12)
        const originalFont = await getPdfFontForText(pdf, originalText, word.language_code)
        pdf.setFont(originalFont.family, "normal")
        pdf.setR2L(originalFont.rtl)
        const titleLines = pdf.splitTextToSize(originalText, contentWidth)
        const titleHeight = titleLines.length * lineHeight()

        pdf.setFont("helvetica", "italic")
        pdf.setFontSize(9)
        let alignLines: string[] = []
        let alignFont = { family: "helvetica", rtl: false }
        if (alignerationText) {
          alignFont = await getPdfFontForText(pdf, alignerationText, word.language_code)
          pdf.setFont(alignFont.family, "normal")
          pdf.setR2L(alignFont.rtl)
          alignLines = pdf.splitTextToSize(alignerationText, contentWidth)
        }
        const alignHeight = alignLines.length * lineHeight()

        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(10)
        const translationFont = await getPdfFontForText(pdf, translationText)
        pdf.setFont(translationFont.family, "normal")
        pdf.setR2L(translationFont.rtl)
        const translationLines = pdf.splitTextToSize(translationText, contentWidth)
        const translationHeight = translationLines.length * lineHeight()

        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(8)
        const metaLines = pdf.splitTextToSize(metadataText, contentWidth)
        const metaHeight = metaLines.length * lineHeight()

        const blockHeight =
          titleHeight + alignHeight + translationHeight + metaHeight + 8
        ensureSpace(blockHeight)

        pdf.setFont(originalFont.family, "normal")
        pdf.setFontSize(12)
        pdf.setTextColor(20)
        pdf.text(titleLines, margin, yPosition)
        pdf.setR2L(false)
        yPosition += titleHeight + 1

        if (alignLines.length > 0) {
          pdf.setFont(alignFont.family, "normal")
          pdf.setFontSize(9)
          pdf.setTextColor(90)
          pdf.text(alignLines, margin, yPosition)
          pdf.setR2L(false)
          yPosition += alignHeight + 1
        }

        pdf.setFont(translationFont.family, "normal")
        pdf.setFontSize(10)
        pdf.setTextColor(40)
        pdf.text(translationLines, margin, yPosition)
        pdf.setR2L(false)
        yPosition += translationHeight + 1

        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(8)
        pdf.setTextColor(120)
        pdf.text(metaLines, margin, yPosition)
        yPosition += metaHeight + 3
      }

      // Add title
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(16)
      pdf.setTextColor(20)
      pdf.text("My Words Collection", margin, yPosition)
      yPosition += lineHeight()

      // Add export date
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      pdf.setTextColor(120)
      pdf.text(`Exported ${new Date().toLocaleDateString()}`, margin, yPosition + 4)
      pdf.text(`Total words: ${words.length}`, pageWidth - margin - 35, yPosition + 4)
      yPosition += 12

      // Add words
      for (const [index, word] of words.entries()) {
        await addWordBlock(word)

        if (index < words.length - 1) {
          ensureSpace(6)
          pdf.setDrawColor(220)
          pdf.line(margin, yPosition, pageWidth - margin, yPosition)
          yPosition += 6
        }
      }

      // Save PDF
      pdf.save(`my-words-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (error) {
      console.error("Error exporting to PDF:", error)
    } finally {
      setIsExporting(false)
    }
  }

  if (words.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={isExporting}
          className="bg-[#1A1A19] border-[#2D2D2B] text-[#FAF9F5] hover:bg-[#1A1A19] hover:border-[#2DD4BF]/50 hover:text-[#2DD4BF] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
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
          onClick={exportToCSV}
          className="focus:bg-[#1A1A19] focus:text-[#FAF9F5] [&_svg]:text-[#2DD4BF]"
        >
          <Table className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={exportToPDF}
          className="focus:bg-[#1A1A19] focus:text-[#FAF9F5] [&_svg]:text-[#2DD4BF]"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
