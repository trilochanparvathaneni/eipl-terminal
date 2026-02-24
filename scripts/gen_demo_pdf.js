// Generates a minimal but realistic Ex-Bond sample PDF
// Uses raw PDF 1.4 syntax — zero external dependencies

"use strict"
const fs = require("fs")
const path = require("path")

const lines = [
  "EASTERN INDIA PETROLEUM LIMITED",
  "Ex-Bond Delivery Order",
  "",
  "Document No : EIPL/EXB/2026/00005",
  "Date        : 20-Feb-2026",
  "Port / CFS  : JNPT, Nhava Sheva",
  "",
  "To,",
  "The Customs Officer,",
  "Air Cargo Complex / ICD / CFS",
  "",
  "We hereby request release of the following bonded goods:",
  "",
  "  Bill of Entry No   : 4521876",
  "  Bill of Entry Date : 15-Feb-2026",
  "  IGM No             : 2026/JNPT/00341",
  "  Vessel             : MV EVER GIVEN 026W",
  "  Port of Loading    : Jebel Ali, UAE",
  "",
  "Goods Description:",
  "  Product            : High Speed Diesel (HSD)",
  "  HS Code            : 2710 19 30",
  "  Quantity           : 48,000 KL",
  "  Gross Weight       : 40,320 MT",
  "  No. of Packages    : Bulk Liquid Tanker",
  "  Warehouse Receipt  : WR/JNPT/2026/0082",
  "",
  "Consignee Details:",
  "  Name    : Eastern India Petroleum Limited",
  "  GSTIN   : 27AABCE1234F1Z5",
  "  PAN     : AABCE1234F",
  "  Address : Plot No. 7, JNPT Road, Uran, Raigad - 400 707",
  "",
  "Transporter:",
  "  Company     : Bharat Logistics Pvt Ltd",
  "  Vehicle No  : MH04 BH 7732",
  "  Driver Name : Ramesh Kumar Singh",
  "  DL Number   : MH0420180056789",
  "",
  "Authorized Signatory:",
  "  Name        : Priya Nair",
  "  Designation : Manager - Customs and Compliance",
  "  Date        : 20-Feb-2026",
  "",
  "For Eastern India Petroleum Limited",
  "",
  "Note: Computer generated document. Valid for customs clearance at JNPT only.",
]

function escapePdf(s) {
  // Escape backslash, open-paren, close-paren for PDF string literals
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

// Build content stream (PDF drawing operators)
const lineHeight = 14
const startY = 790
const marginX = 50

const ops = []
ops.push("BT")
ops.push("/F1 13 Tf")
ops.push(`${marginX} ${startY} Td`)
// First line: company name, slightly larger
ops.push(`(${escapePdf(lines[0])}) Tj`)
ops.push("/F1 11 Tf")
ops.push(`0 -18 Td`)
ops.push(`(${escapePdf(lines[1])}) Tj`)
ops.push("/F1 9 Tf")
ops.push(`0 -6 Td`)
ops.push(`(${"-".repeat(78)}) Tj`)

for (let i = 2; i < lines.length; i++) {
  ops.push(`0 -${lineHeight} Td`)
  ops.push(`(${escapePdf(lines[i])}) Tj`)
}
ops.push("ET")

const contentStream = ops.join("\n")

// PDF object helpers
const objectBodies = []

function addObj(body) {
  objectBodies.push(body)
  return objectBodies.length // 1-based ID
}

const catalogId  = addObj("<< /Type /Catalog /Pages 2 0 R >>")
const pagesId    = addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
const pageId     = addObj(
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n" +
  "   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"
)
const streamId   = addObj(
  `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}\nendstream`
)
const fontId     = addObj(
  "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"
)

// Assemble the file
const chunks = []
chunks.push(Buffer.from("%PDF-1.4\n", "latin1"))

const offsets = []
for (let i = 0; i < objectBodies.length; i++) {
  offsets.push(chunks.reduce((s, c) => s + c.length, 0))
  chunks.push(Buffer.from(`${i + 1} 0 obj\n${objectBodies[i]}\nendobj\n`, "latin1"))
}

const xrefOffset = chunks.reduce((s, c) => s + c.length, 0)
const xrefLines = [
  "xref\n",
  `0 ${objectBodies.length + 1}\n`,
  "0000000000 65535 f \n",
  ...offsets.map(off => off.toString().padStart(10, "0") + " 00000 n \n"),
  "trailer\n",
  `<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\n`,
  "startxref\n",
  `${xrefOffset}\n`,
  "%%EOF\n",
]
chunks.push(Buffer.from(xrefLines.join(""), "latin1"))

const outPath = path.join(__dirname, "../public/docs/demo/ex_bond_demo05.pdf")
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, Buffer.concat(chunks))
console.log("Created:", outPath, `(${Buffer.concat(chunks).length} bytes)`)
