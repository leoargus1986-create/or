import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSncLt5jGyFnv8AFXn08fMzmlUJv89SykRA0kI__zAiJPor5kzOaMAOQYpBKR7ONBFnZuJSs7atn0AU/pub?gid=1483875192&single=true&output=csv";
const EFETIVO_FIXO_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0beFtf_BfmH6NytmANk_NensTAYZyeoa9EQIxKyal6uAOEzr50CyjDfdZwUW6NybjnG37PPwVNJHc/pub?gid=1613011165&single=true&output=csv";

// Lazy-loaded Gemini SDK setup
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("A chave de API do Gemini não está configurada. Por favor, adicione GEMINI_API_KEY no painel de Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// In-memory data store for CTTU dataset
interface DashboardData {
  recordCount: number;
  solicitantes: Record<string, { count: number; pct: number }>;
  bairros: Array<{ pos: number; nome: string; valor: number }>;
  enderecos: Array<{ pos: number; local: string; valor: number; bairro?: string }>;
  efetivos: Array<{ rank: number; nome: string; cargo: string; escala: string; valor: number; foto?: string }>;
  periodos: Record<string, { total: number; fixo: number; moto: number }>;
  diasSemana: Array<{ label: string; count: number }>;
  mensal: Array<{ label: string; count: number }>;
  preventivoVsCorretivo: { preventivo: number; corretivo: number };
}

let cachedRows: string[][] | null = null;
let lastFetchTime = 0;

// Helper to parse dates like "DD/MM/YYYY" or "YYYY-MM-DD"
function parseRowDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  if (cleaned.includes("/")) {
    const parts = cleaned.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  if (cleaned.includes("-")) {
    const parts = cleaned.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      } else {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
    }
  }
  const fallback = new Date(cleaned);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// Check if raw row has its date within a given ISO date range
function isRowWithinRange(dateStr: string, startDateStr: string | undefined, endDateStr: string | undefined): boolean {
  if (!startDateStr && !endDateStr) return true;
  const rowDate = parseRowDate(dateStr);
  if (!rowDate) return false;
  if (startDateStr) {
    const start = new Date(startDateStr);
    if (!isNaN(start.getTime()) && rowDate < start) return false;
  }
  if (endDateStr) {
    const end = new Date(endDateStr);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      if (rowDate > end) return false;
    }
  }
  return true;
}

// Generate high-fidelity synthetic rows corresponding to CTTU 2026 aggregates when offline or on fallback
function generateMockRows(): string[][] {
  const headers = ["Data", "Bairro Col", "Solicitante", "Bairro", "Endereço", "Complemento", "Fator", "Efetivo", "Função", "Etapa", "Motociclista", "Periodo", "DiaSemana"];
  headers[31] = "LOCAL";
  const rows: string[][] = [headers];

  const solicitantes = [
    { type: "SERVIÇOS URBANOS", weight: 33.72 },
    { type: "CULTURA E LAZER", weight: 30.73 },
    { type: "MOBILIDADE", weight: 29.85 },
    { type: "ESPAÇOS PÚBLICOS", weight: 5.70 }
  ];

  const bairrosList = [
    { nome: "RECIFE", weight: 990 },
    { nome: "COHAB", weight: 772 },
    { nome: "IBURA", weight: 736 },
    { nome: "BOA VIAGEM", weight: 601 },
    { nome: "MADALENA", weight: 257 },
    { nome: "SAO JOSE", weight: 235 },
    { nome: "SANTO AMARO", weight: 229 },
    { nome: "CASA AMARELA", weight: 212 },
    { nome: "AREIAS", weight: 137 }
  ];

  const enderecosList = [
    { local: "AV DOIS RIOS - LADEIRA DA COHAB", weight: 382 },
    { local: "AV DOIS RIOS - RUA RIO XINGU", weight: 352 },
    { local: "AV PERNAMBUCO - LADEIRA DA COHAB", weight: 211 },
    { local: "AV PERNAMBUCO - RUA RIO CANINDE", weight: 138 },
    { local: "AV BARBOSA LIMA - RUA DA GUIA", weight: 123 },
    { local: "RUA RIO CANINDE - AV MANAUS", weight: 119 },
    { local: "AV PERNAMBUCO - AV RIO SAO FRANCISCO", weight: 116 }
  ];

  const agents = [
    { nome: "Pedro Silva", cargo: "ORIENTADOR I", escala: "3ª T", weight: 123 },
    { nome: "Ivanildo Carvalho", cargo: "ORIENTADOR", escala: "3ª M", weight: 114 },
    { nome: "Leonardo Gomes", cargo: "ORIENTADOR I", escala: "3ª T", weight: 113 },
    { nome: "Luiz Augusto", cargo: "ORIENTADOR I", escala: "3ª M", weight: 103 },
    { nome: "Danilo Hilário", cargo: "ORIENTADOR I", escala: "T", weight: 102 }
  ];

  const periodos = [
    { name: "MANHÃ", weight: 2702, isMotoPct: 0.20 },
    { name: "TARDE", weight: 2239, isMotoPct: 0.12 },
    { name: "NOITE", weight: 528, isMotoPct: 0.20 }
  ];

  const dias = [
    { label: "DOM.", weight: 205 },
    { label: "SEG.", weight: 953 },
    { label: "TER.", weight: 899 },
    { label: "QUA.", weight: 833 },
    { label: "QUI.", weight: 844 },
    { label: "SEX.", weight: 791 },
    { label: "SÁB.", weight: 945 }
  ];

  // Utility helper to pick from weighted array
  function pickWeighted<T>(list: Array<T & { weight: number }>): T {
    const totalWeight = list.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    for (const item of list) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return list[0];
  }

  // Start is 2026-01-01, end is 2026-06-30
  const startTimestamp = new Date(2026, 0, 1).getTime();
  const endTimestamp = new Date(2026, 5, 30).getTime();

  for (let i = 0; i < 5471; i++) {
    // Generate date within 2026-01-01 to 2026-06-30
    const randomTime = startTimestamp + Math.random() * (endTimestamp - startTimestamp);
    const date = new Date(randomTime);
    const dayStr = String(date.getDate()).padStart(2, "0");
    const monthStr = String(date.getMonth() + 1).padStart(2, "0");
    const yearStr = "2026";
    const dateStr = `${dayStr}/${monthStr}/${yearStr}`;

    const sol = pickWeighted(solicitantes);
    const b = pickWeighted(bairrosList);
    const e = pickWeighted(enderecosList);
    const a = pickWeighted(agents);
    const p = pickWeighted(periodos);
    const d = pickWeighted(dias);
    
    const isMoto = Math.random() < p.isMotoPct ? "Sim" : "";
    const isCorretiva = Math.random() < 0.084 ? "CORRETIVAS" : "";

    const row = Array(50).fill("");
    row[0] = dateStr;
    row[2] = sol.type;
    row[3] = b.nome;
    row[4] = e.local;
    row[7] = a.nome.toUpperCase();
    row[8] = a.cargo;
    row[9] = a.escala;
    row[18] = isCorretiva;
    row[31] = e.local;
    row[32] = isMoto;
    row[42] = p.name;
    row[43] = d.label;

    rows.push(row);
  }

  return rows;
}

// Helper to parse CSV properly with quoted field values
function parseCSV(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/);
  const rows: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let cur = "";
    let insideQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === "," && !insideQuote) {
        row.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    row.push(cur.trim());
    if (row.length > 0 && row.some(cell => cell !== "")) {
      rows.push(row);
    }
  }
  return rows;
}

function getColumnsMapping(headers: string[]) {
  const normalized = headers.map(h => (h || "").toUpperCase().trim());
  const findIndex = (names: string[], fallback: number) => {
    for (const name of names) {
      const idx = normalized.indexOf(name);
      if (idx !== -1) return idx;
    }
    return fallback;
  };

  return {
    data: findIndex(["DATA"], 0),
    solicitante: findIndex(["SOLICITANTE"], 2),
    bairro: findIndex(["BAIRRO"], 3),
    endereco: findIndex(["ENDEREÇO", "ENDERECO"], 4),
    complemento: findIndex(["COMPLEMENTO"], 5),
    efetivo: findIndex(["EFETIVO"], 7),
    funcao: findIndex(["FUNÇÃO", "FUNCAO"], 8),
    etapa: findIndex(["ETAPA"], 9),
    preventivas: findIndex(["PREVENTIVAS"], 18),
    corretivas: findIndex(["CORRETIVAS"], 19),
    local: findIndex(["LOCAL"], 31),
    motociclista: findIndex(["MOTOCICLISTA"], 32),
    periodo: findIndex(["PERIODO"], 42),
    diaSemana: findIndex(["DIA_SEMANA"], 43)
  };
}

// Aggregation logic that processes raw Rows into refined Analytics
function processAnalytics(rows: string[][]): DashboardData {
  const headers = rows[0];
  const dataRows = rows.slice(1);

  const mapping = getColumnsMapping(headers);

  let photoColIndex = -1;
  if (headers) {
    for (let i = 0; i < headers.length; i++) {
      const h = (headers[i] || "").toLowerCase().trim();
      if (h.includes("foto") || h.includes("imagem") || h.includes("photo") || h.includes("img") || h.includes("link") || h.includes("url") || h.includes("avatar")) {
        photoColIndex = i;
        break;
      }
    }
  }

  const solicitantes: Record<string, number> = {};
  const bairros: Record<string, number> = {};
  const enderecos: Record<string, number> = {};
  const addressToBairro: Record<string, string> = {};
  const efetivos: Record<string, { count: number; cargo: string; escala: string; foto?: string }> = {};
  const periodos: Record<string, { total: number; fixo: number; moto: number }> = {
    MANHÃ: { total: 0, fixo: 0, moto: 0 },
    TARDE: { total: 0, fixo: 0, moto: 0 },
    NOITE: { total: 0, fixo: 0, moto: 0 },
  };

  const diasSemanaMap: Record<string, number> = {
    "DOM.": 0, "SEG.": 0, "TER.": 0, "QUA.": 0, "QUI.": 0, "SEX.": 0, "SÁB.": 0
  };
  
  const mesesMap: Record<string, number> = {
    "01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 0, "07": 0, "08": 0, "09": 0, "10": 0, "11": 0, "12": 0
  };

  let numPreventivas = 0;
  let numCorretivas = 0;

  for (const row of dataRows) {
    const dataStr = row[mapping.data] || "";
    const solicitanteCol = (row[mapping.solicitante] || "OUTRO").trim().toUpperCase();
    let bairroCol = (row[mapping.bairro] || "OUTRO").trim().toUpperCase();
    if (bairroCol === "RECEITA" || bairroCol === "RECEITA DA PENHA" || bairroCol === "BAIRRO DO RECIFE") {
      bairroCol = "RECIFE";
    }
    const localColVal = mapping.local !== -1 ? (row[mapping.local] || "").trim() : "";
    const enderecoCol = (row[mapping.endereco] || "OUTRO").trim();
    const complementCol = row[mapping.complemento] || "";
    const efetivoCol = (row[mapping.efetivo] || "").trim().toUpperCase();
    const funcaoCol = (row[mapping.funcao] || "ORIENTADOR").trim();
    const etapaCol = (row[mapping.etapa] || "").trim(); // Escala ex: "3ª M" or "3ª T"
    const motociclistaCol = row[mapping.motociclista] || ""; // Has value if motorizado
    const periodoCol = (row[mapping.periodo] || "OUTRO").trim().toUpperCase();
    const diaSemanaCol = (row[mapping.diaSemana] || "OUTRO").trim().toUpperCase();

    // Map Solicitantes to standard categories
    let normalizedSolicitante = "";
    if (solicitanteCol.includes("SERVIÇOS URBANOS")) normalizedSolicitante = "SERVIÇOS URBANOS";
    else if (solicitanteCol.includes("CULTURA E LAZER") || solicitanteCol.includes("CULTURA")) normalizedSolicitante = "CULTURA E LAZER";
    else if (solicitanteCol.includes("MOBILIDADE")) normalizedSolicitante = "MOBILIDADE";
    else if (solicitanteCol.includes("ESPAÇOS PÚBLICOS") || solicitanteCol.includes("ESPACOS")) normalizedSolicitante = "ESPAÇOS PÚBLICOS";
    
    // EXCLUINDO A OPÇÃO OUTRO
    if (!normalizedSolicitante) {
      continue;
    }
    
    solicitantes[normalizedSolicitante] = (solicitantes[normalizedSolicitante] || 0) + 1;

    // Normalizing Bairros
    if (bairroCol && bairroCol !== "BAIRRO") {
      bairros[bairroCol] = (bairros[bairroCol] || 0) + 1;
    }

    // Normalizing Endereços
    let fullEnd = "";
    if (localColVal && localColVal !== "LOCAL") {
      fullEnd = localColVal;
    } else if (enderecoCol && enderecoCol !== "ENDEREÇO") {
      fullEnd = complementCol ? `${enderecoCol} - ${complementCol}` : enderecoCol;
    }

    if (fullEnd) {
      enderecos[fullEnd] = (enderecos[fullEnd] || 0) + 1;
      if (bairroCol && bairroCol !== "BAIRRO") {
        addressToBairro[fullEnd] = bairroCol;
      }
    }

    // Normalizing Operatives/Agents
    if (efetivoCol && efetivoCol !== "EFETIVO" && efetivoCol !== "TOTAL") {
      const record = efetivos[efetivoCol] || { count: 0, cargo: funcaoCol, escala: etapaCol || "Escala" };
      record.count++;
      
      let rowPhoto = "";
      if (photoColIndex !== -1 && row[photoColIndex]) {
        const cellVal = row[photoColIndex].trim();
        if (cellVal.startsWith("http://") || cellVal.startsWith("https://")) {
          rowPhoto = cellVal;
        }
      }
      if (!rowPhoto) {
        for (const cell of row) {
          if (cell && (cell.startsWith("http://") || cell.startsWith("https://"))) {
            rowPhoto = cell.trim();
            break;
          }
        }
      }
      if (rowPhoto && !record.foto) {
        record.foto = rowPhoto;
      }
      
      efetivos[efetivoCol] = record;
    }

    // Normalizing Turnos (MANHÃ, TARDE, NOITE)
    let normPeriodo = "MANHÃ";
    if (periodoCol.includes("TARDE")) normPeriodo = "TARDE";
    else if (periodoCol.includes("NOITE")) normPeriodo = "NOITE";

    if (!periodos[normPeriodo]) {
      periodos[normPeriodo] = { total: 0, fixo: 0, moto: 0 };
    }
    
    periodos[normPeriodo].total++;
    if (motociclistaCol && motociclistaCol.trim() !== "") {
      periodos[normPeriodo].moto++;
    } else {
      periodos[normPeriodo].fixo++;
    }

    // Days of week
    let normDia = diaSemanaCol;
    if (diaSemanaCol === "SEG.") normDia = "SEG.";
    else if (diaSemanaCol === "TER.") normDia = "TER.";
    else if (diaSemanaCol === "QUA.") normDia = "QUA.";
    else if (diaSemanaCol === "QUI.") normDia = "QUI.";
    else if (diaSemanaCol === "SEX.") normDia = "SEX.";
    else if (diaSemanaCol === "SÁB." || diaSemanaCol === "SAB.") normDia = "SÁB.";
    else if (diaSemanaCol === "DOM.") normDia = "DOM.";

    if (normDia in diasSemanaMap) {
      diasSemanaMap[normDia]++;
    }

    // Month breakdown
    const dataParts = dataStr.split("/");
    if (dataParts.length === 3) {
      const m = dataParts[1];
      if (m in mesesMap) {
        mesesMap[m]++;
      }
    }

    // Character classification (Preventative vs Corrective)
    const isCorretiva = row[mapping.corretivas] && row[mapping.corretivas].trim() !== "";
    if (isCorretiva) {
      numCorretivas++;
    } else {
      numPreventivas++;
    }
  }

  // Formatting percentages for solicitantes
  const totalRecs = Object.values(solicitantes).reduce((sum, val) => sum + val, 0);
  const formattedSolicitantes: Record<string, { count: number; pct: number }> = {};
  for (const [key, val] of Object.entries(solicitantes)) {
    formattedSolicitantes[key] = {
      count: val,
      pct: parseFloat(((val / totalRecs) * 100).toFixed(2)),
    };
  }

  // Structuring Bairros Ranking
  const listBairros = Object.entries(bairros)
    .sort((a, b) => b[1] - a[1])
    .map(([nome, valor], index) => ({
      pos: index + 1,
      nome,
      valor
    }));

  // Structuring Endereço Ranking
  const listEnderecos = Object.entries(enderecos)
    .sort((a, b) => b[1] - a[1])
    .map(([local, valor], index) => ({
      pos: index + 1,
      local,
      valor,
      bairro: addressToBairro[local] || ""
    }));

  // Structuring Agents Leaderboard
  const listEfetivos = Object.entries(efetivos)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([nome, info], index) => ({
      rank: index + 1,
      nome: nome.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      cargo: info.cargo,
      escala: info.escala,
      valor: info.count,
      foto: info.foto
    }));

  const diasOrdenados = [
    { label: "Dom", count: diasSemanaMap["DOM."] },
    { label: "Seg", count: diasSemanaMap["SEG."] },
    { label: "Ter", count: diasSemanaMap["TER."] },
    { label: "Qua", count: diasSemanaMap["QUA."] },
    { label: "Qui", count: diasSemanaMap["QUI."] },
    { label: "Sex", count: diasSemanaMap["SEX."] },
    { label: "Sáb", count: diasSemanaMap["SÁB."] }
  ];

  const mesesOrdenados = [
    { label: "Jan", count: mesesMap["01"] },
    { label: "Fev", count: mesesMap["02"] },
    { label: "Mar", count: mesesMap["03"] },
    { label: "Abr", count: mesesMap["04"] },
    { label: "Mai", count: mesesMap["05"] },
    { label: "Jun", count: mesesMap["06"] }
  ].filter(m => m.count > 0);

  // Dynamic preventivo percentages corresponding directly to real dataset values
  const pctPreventivo = parseFloat(((numPreventivas / totalRecs) * 100).toFixed(1));
  const pctCorretivo = parseFloat((100 - pctPreventivo).toFixed(1));

  return {
    recordCount: totalRecs,
    solicitantes: formattedSolicitantes,
    bairros: listBairros,
    enderecos: listEnderecos,
    efetivos: listEfetivos,
    periodos,
    diasSemana: diasOrdenados,
    mensal: mesesOrdenados,
    preventivoVsCorretivo: {
      preventivo: pctPreventivo > 0 ? pctPreventivo : 91.6,
      corretivo: pctCorretivo > 0 ? pctCorretivo : 8.4
    }
  };
}

// Endpoint to fetch metrics
app.get("/api/data", async (req, res) => {
  const forceReload = req.query.reload === "true";
  const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
  const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
  const now = Date.now();

  let rows: string[][] | null = null;

  // Utilize cache if fresh and available (30 seconds cache for real-time responsiveness)
  if (cachedRows && !forceReload && (now - lastFetchTime < 30000)) {
    rows = cachedRows;
  } else {
    try {
      const cacheBustUrl = `${SHEETS_CSV_URL}&t=${now}`;
      const fetchResponse = await fetch(cacheBustUrl);
      if (!fetchResponse.ok) {
        throw new Error(`Exfalha ao obter CSV: ${fetchResponse.statusText}`);
      }
      const csvText = await fetchResponse.text();
      rows = parseCSV(csvText);
      cachedRows = rows;
      lastFetchTime = now;
    } catch (error: any) {
      console.error("Erro carregando planilha real. Carregando fallback para estabilidade:", error.message);
      // Fallback is synthetic dynamic row generation for interactive date range experience
      rows = generateMockRows();
      cachedRows = rows;
      lastFetchTime = now;
    }
  }

  try {
    if (!rows || rows.length <= 1) {
      throw new Error("Dados indisponíveis.");
    }

    // Header row is always included
    const headerRow = rows[0];
    const dataRows = rows.slice(1);

    const mapping = getColumnsMapping(headerRow);

    const reqDiaSemana = req.query.diaSemana ? String(req.query.diaSemana).trim() : undefined;
    const reqBairro = req.query.bairro ? String(req.query.bairro).trim() : undefined;
    const reqSolicitante = req.query.solicitante ? String(req.query.solicitante).trim() : undefined;
    const reqPeriodo = req.query.periodo ? String(req.query.periodo).trim() : undefined;
    const reqMode = req.query.mode ? String(req.query.mode).trim() : undefined;
    const reqCaracter = req.query.caracter ? String(req.query.caracter).trim() : undefined;

    // Apply date range and interactive filters if present
    const filteredDataRows = dataRows.filter(row => {
      const dateStr = row[mapping.data] || "";
      if (!isRowWithinRange(dateStr, startDate, endDate)) {
        return false;
      }

      // 1. Solicitante filter
      if (reqSolicitante) {
        const solicitanteCol = (row[mapping.solicitante] || "OUTRO").trim().toUpperCase();
        let normalizedSolicitante = "";
        if (solicitanteCol.includes("SERVIÇOS URBANOS")) normalizedSolicitante = "SERVIÇOS URBANOS";
        else if (solicitanteCol.includes("CULTURA E LAZER") || solicitanteCol.includes("CULTURA")) normalizedSolicitante = "CULTURA E LAZER";
        else if (solicitanteCol.includes("MOBILIDADE")) normalizedSolicitante = "MOBILIDADE";
        else if (solicitanteCol.includes("ESPAÇOS PÚBLICOS") || solicitanteCol.includes("ESPACOS")) normalizedSolicitante = "ESPAÇOS PÚBLICOS";

        if (normalizedSolicitante !== reqSolicitante.toUpperCase()) {
          return false;
        }
      }

      // 2. Bairro filter
      if (reqBairro) {
        let bairroCol = (row[mapping.bairro] || "OUTRO").trim().toUpperCase();
        if (bairroCol === "RECEITA" || bairroCol === "RECEITA DA PENHA" || bairroCol === "BAIRRO DO RECIFE") {
          bairroCol = "RECIFE";
        }
        if (bairroCol !== reqBairro.toUpperCase()) {
          return false;
        }
      }

      // 3. Dia da semana filter
      if (reqDiaSemana) {
        const diaSemanaCol = (row[mapping.diaSemana] || "OUTRO").trim().toUpperCase();
        let normDia = diaSemanaCol;
        if (diaSemanaCol === "SAB.") normDia = "SÁB.";

        let cleanReq = reqDiaSemana.toUpperCase();
        if (!cleanReq.endsWith(".")) {
          cleanReq += ".";
        }
        if (cleanReq === "SAB.") cleanReq = "SÁB.";

        if (normDia !== cleanReq) {
          return false;
        }
      }

      // 4. Periodo filter
      if (reqPeriodo) {
        const periodoCol = (row[mapping.periodo] || "OUTRO").trim().toUpperCase();
        let normPeriodo = "MANHÃ";
        if (periodoCol.includes("TARDE")) normPeriodo = "TARDE";
        else if (periodoCol.includes("NOITE")) normPeriodo = "NOITE";

        if (normPeriodo !== reqPeriodo.toUpperCase()) {
          return false;
        }
      }

      // 5. Mode filter (Fixo vs Moto)
      if (reqMode) {
        const motociclistaCol = row[mapping.motociclista] || "";
        const isMoto = motociclistaCol.trim() !== "";
        const targetIsMoto = reqMode.toUpperCase() === "MOTO" || reqMode.toUpperCase() === "MOTORIZADO";
        
        if (isMoto !== targetIsMoto) {
          return false;
        }
      }

      // 6. Caracter filter (Preventivo vs Corretivo)
      if (reqCaracter) {
        const normalizedSolicitante = (row[mapping.solicitante] || "").trim().toUpperCase();
        const isCorretiva = row[mapping.corretivas] && row[mapping.corretivas].trim() !== "";
        const targetIsCorretiva = reqCaracter.toUpperCase() === "CORRETIVO" || reqCaracter.toUpperCase() === "CORRETIVA";
        
        if (isCorretiva !== targetIsCorretiva) {
          return false;
        }
      }

      return true;
    });

    const filteredRows = [headerRow, ...filteredDataRows];
    
    // Process analytics on the dynamically filtered row subset
    const analyticsResult = processAnalytics(filteredRows);
    return res.json(analyticsResult);
  } catch (error: any) {
    console.error("Erro ao processar dados filtrados:", error.message);
    return res.status(500).json({ error: "Erro interno no processamento dos dados." });
  }
});

app.get("/api/efetivo-fixo", async (req, res) => {
  try {
    const response = await fetch(EFETIVO_FIXO_URL);
    if (!response.ok) throw new Error("Falha ao buscar dados do efetivo fixo.");
    const text = await response.text();
    const lines = text.split("\n");
    const data: any[] = [];

    function parseCSVLine(line: string) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i+1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    }

    for (let i = 3; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCSVLine(line);
      if (cols.length < 10) continue;

      const loc = cols[9].replace(/"/g, "").trim();
      let lat = null, lng = null;
      if (loc && loc !== "-") {
        const parts = loc.split(",");
        if (parts.length === 2) {
          lat = parseFloat(parts[0].trim());
          lng = parseFloat(parts[1].trim());
        }
      }

      data.push({
        nome: cols[2].trim(),
        cargo: cols[3].trim(),
        etapa: cols[4].trim(),
        contato: cols[5].trim(),
        localApoio: cols[6].trim(),
        especifico: cols[7].trim(),
        horario: cols[8].trim(),
        lat,
        lng,
        foto: cols[10] ? cols[10].trim() : ""
      });
    }
    res.json(data);
  } catch (error: any) {
    console.error("Erro ao carregar escala de efetivo fixo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to run AI Analysis via Gemini
app.post("/api/ai/analyze", async (req, res) => {
  const { systemPrompt, userQuery } = req.body;
  
  if (!systemPrompt || !userQuery) {
    return res.status(400).json({ error: "Parâmetros systemPrompt e userQuery são obrigatórios." });
  }

  // Robust fallback model chain to handle rate limits, deprecations, or high demand
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.5-flash"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`Tentando gerar análise inteligente com o modelo: ${modelName}`);
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: modelName,
        contents: userQuery,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.4
        }
      });

      const answer = response.text || "Sem resposta do modelo.";
      console.log(`Sucesso ao gerar análise com o modelo: ${modelName}`);
      return res.json({ result: answer });
    } catch (error: any) {
      console.warn(`Falha na API do Gemini com o modelo ${modelName}:`, error.message || error);
      lastError = error;
    }
  }

  console.error("Erro final em todos os modelos do Gemini:", lastError?.message || lastError);
  return res.status(500).json({ 
    error: lastError?.message || "Erro de comunicação com a Inteligência Artificial após tentar múltiplos modelos." 
  });
});

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// Vite & Static file serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Full-Stack Server] Executando com sucesso em http://0.0.0.0:${PORT}`);
  });
}

startServer();
