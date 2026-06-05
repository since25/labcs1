import { parseFreezerLocation } from "./labService.js";

export function analyzeBoxArchive({ caption = "", location = "", photos = [], user }) {
  const freezerLocation = parseFreezerLocation(location);
  const candidates = extractSamplesFromText(caption);

  if (!candidates.length) {
    candidates.push({
      name: "待识别冻存盒",
      type: guessType(caption),
      count: 1,
      wells: "待复核",
      confidence: "low",
      status: "待复核"
    });
  }

  return {
    summary: {
      box: freezerLocation.box,
      photoCount: photos.length,
      sampleKinds: candidates.length,
      totalTubes: candidates.reduce((sum, item) => sum + item.count, 0),
      ownerUserId: user.id
    },
    samples: candidates.map((candidate) => ({
      ...candidate,
      ownerUserId: user.id,
      createdByUserId: user.id,
      project: "拍照快速归档",
      freezerId: freezerLocation.freezerId,
      shelf: freezerLocation.shelf,
      stack: freezerLocation.stack,
      rackLevel: freezerLocation.rackLevel,
      depth: freezerLocation.depth,
      box: freezerLocation.box,
      note: `Telegram 拍照归档；分析置信度：${candidate.confidence}`
    }))
  };
}

function extractSamplesFromText(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sampleCodes = [...normalized.matchAll(/\b(?:EK|L|D|A|B|C)?\d{1,3}[A-Z]?\b/g)].map((match) => match[0]);
  const uniqueCodes = [...new Set(sampleCodes)].filter((code) => !/^20\d{6}$/.test(code));

  if (!uniqueCodes.length) return [];

  return uniqueCodes.slice(0, 20).map((code) => ({
    name: normalized.includes("IVT") || normalized.includes("mRNA") ? `IVT-mRNA ${code}` : code,
    type: guessType(normalized),
    count: 1,
    wells: "待复核",
    confidence: "medium",
    status: "待确认"
  }));
}

function guessType(text) {
  if (/ivt|mrna|mRNA/i.test(text)) return "IVT-mRNA";
  if (/rna/i.test(text)) return "RNA";
  if (/质粒|plasmid/i.test(text)) return "质粒";
  if (/细胞|293|a549|jurkat/i.test(text)) return "细胞冻存管";
  return "冷冻样品";
}
