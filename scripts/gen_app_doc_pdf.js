"use strict"

const fs = require("fs")
const path = require("path")
const { jsPDF } = require("jspdf")

const inputPath = path.join(__dirname, "../docs/app-features-flow-roles.md")
const outputPath = path.join(__dirname, "../public/docs/EIPL-Terminal-Ops-Features-Flow-Roles.pdf")

function normalize(line) {
  return line.replace(/\r/g, "")
}

function stripMarkdown(line) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
}

function buildPdf(markdown) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 46
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ensureSpace = (h = 14) => {
    if (y + h > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  const writeWrapped = (text, opts = {}) => {
    const size = opts.size || 11
    const gap = opts.gap || 16
    const color = opts.color || [17, 24, 39]
    const style = opts.style || "normal"
    doc.setFont("helvetica", style)
    doc.setFontSize(size)
    doc.setTextColor(color[0], color[1], color[2])
    const lines = doc.splitTextToSize(text, contentWidth)
    for (const line of lines) {
      ensureSpace(gap)
      doc.text(line, margin, y)
      y += gap
    }
  }

  writeWrapped("EIPL Terminal Ops", { size: 18, style: "bold", gap: 22 })
  writeWrapped("Features, Roles, and Flowcharts", { size: 13, style: "bold", gap: 18, color: [55, 65, 81] })
  writeWrapped(`Generated: ${new Date().toISOString().slice(0, 10)}`, { size: 10, gap: 14, color: [75, 85, 99] })
  y += 8

  const lines = markdown.split("\n").map(normalize)
  let inCode = false

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.startsWith("```")) {
      inCode = !inCode
      if (!inCode) y += 3
      continue
    }

    if (inCode) {
      writeWrapped(stripMarkdown(line), { size: 9, gap: 12, style: "normal", color: [31, 41, 55] })
      continue
    }

    if (!line.trim()) {
      y += 8
      ensureSpace()
      continue
    }

    if (line.startsWith("### ")) {
      y += 5
      writeWrapped(stripMarkdown(line), { size: 12, style: "bold", gap: 16, color: [17, 24, 39] })
      continue
    }

    if (line.startsWith("## ")) {
      y += 6
      writeWrapped(stripMarkdown(line), { size: 13, style: "bold", gap: 18, color: [17, 24, 39] })
      continue
    }

    if (line.startsWith("# ")) {
      y += 8
      writeWrapped(stripMarkdown(line), { size: 15, style: "bold", gap: 20, color: [17, 24, 39] })
      continue
    }

    if (line.startsWith("- ")) {
      writeWrapped(`• ${stripMarkdown(line.slice(2))}`, { size: 11, gap: 15 })
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      writeWrapped(stripMarkdown(line), { size: 11, gap: 15 })
      continue
    }

    if (line.startsWith("|")) {
      writeWrapped(stripMarkdown(line), { size: 9, gap: 12, color: [55, 65, 81] })
      continue
    }

    writeWrapped(stripMarkdown(line), { size: 11, gap: 15 })
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  doc.save(outputPath)
}

if (!fs.existsSync(inputPath)) {
  console.error(`Input markdown not found: ${inputPath}`)
  process.exit(1)
}

const markdown = fs.readFileSync(inputPath, "utf8")
buildPdf(markdown)
console.log(`Created: ${outputPath}`)
