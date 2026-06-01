import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import * as xlsx from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json());

// API Routes
app.post('/api/upload-oee', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const detailSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('detail')) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[detailSheetName];
    
    // Get all rows as arrays to manually find the header
    const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    // Find the header row (the one containing 'Machine', 'OEE', 'OME', or 'Shift')
    let headerIdx = -1;
    for (let i = 0; i < Math.min(100, rows.length); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;
        const rowStr = row.map(c => String(c || '')).join(' ').toLowerCase();
        // Look for common industrial headers
        if (
          (rowStr.includes('machine') || rowStr.includes('m/c')) && 
          (rowStr.includes('shift') || rowStr.includes('oee') || rowStr.includes('ome') || rowStr.includes('good count'))
        ) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx === -1) {
      return res.status(400).json({ error: 'Could not detect the header row. Please ensure columns like "Machine", "Shift", and "Good Count" exist.' });
    }

    const headers = rows[headerIdx].map(h => String(h || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim());
    const dataRows = rows.slice(headerIdx + 1);

    const cleanedData = dataRows.map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        if (h && h !== 'null') obj[h] = row[i];
      });

      const cleanNum = (val: any) => {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'string') {
          return parseFloat(val.replace(/[%,]/g, '')) || 0;
        }
        return parseFloat(val) || 0;
      };

      const getVal = (possibleKeys: string[]) => {
        const key = possibleKeys.find(k => obj[k] !== undefined);
        return key ? obj[key] : null;
      };

      const rawOee = getVal(['OEE', 'OME', 'OEE (%)', 'OEE%', 'Plant OEE']);
      let oee = cleanNum(rawOee);
      if (oee > 0 && oee <= 1) oee *= 100;

      const targetCount = cleanNum(getVal(['Target Count', 'TargetQty', 'Planned Count', 'Target Prdn', 'Target Shot/Shift']));
      const goodCount = cleanNum(getVal(['Good Count', 'GoodQty', 'OK Count', 'Good', 'Good Prdn']));
      
      // Calculate bad count if not explicitly provided
      let badCount = cleanNum(getVal(['Bad Count', 'Reject Count', 'NG Count', 'Bad', 'Rej Qty', 'Rej Qty']));
      if (badCount === 0 && targetCount > goodCount) {
        badCount = targetCount - goodCount;
      }

      const machineName = String(getVal(['Machine', 'M/c', 'Machine Name', 'Line', 'Asset', 'Unit']) || 'Unknown');

      return {
        machine: machineName,
        shift: String(getVal(['Shift', 'SHIFT', 'Shift Name', 'Group']) || 'N/A'),
        oee: oee,
        ar: cleanNum(getVal(['AR', 'Availability', 'Avail %'])) <= 1 ? cleanNum(getVal(['AR', 'Availability', 'Avail %'])) * 100 : cleanNum(getVal(['AR', 'Availability', 'Avail %'])),
        pr: cleanNum(getVal(['PR', 'Performance', 'Perf %'])) <= 1 ? cleanNum(getVal(['PR', 'Performance', 'Perf %'])) * 100 : cleanNum(getVal(['PR', 'Performance', 'Perf %'])),
        qr: cleanNum(getVal(['QR', 'Quality', 'Qual %'])) <= 1 ? cleanNum(getVal(['QR', 'Quality', 'Qual %'])) * 100 : cleanNum(getVal(['QR', 'Quality', 'Qual %'])),
        runMin: cleanNum(getVal(['M/c Run Min', 'Run time (min)', 'Run Min', 'Actual Run Min'])),
        availMin: cleanNum(getVal(['M/c Available Min', 'Available time (min)', 'Avail Min', 'Planned Run Min', 'M/c Act Planned Min'])),
        targetCount: targetCount,
        goodCount: goodCount,
        badCount: badCount,
        partWt: cleanNum(getVal(['Part Wt', 'Weight', 'Part Weight', 'Unit Wt'])),
        qualityLossMin: cleanNum(getVal(['Quality Loss Mins', 'Quality Loss', 'Rej Mins'])),
        date: String(getVal(['Date', 'Date Time', 'DATE', 'Production Date', 'month']) || new Date().toISOString())
      };
    }).filter(d => d.machine !== 'Unknown' && (d.oee > 0 || d.availMin > 0));

    console.log(`[Upload] Successfully processed ${cleanedData.length} valid entries using header index ${headerIdx}`);
    res.json({ data: cleanedData });
  } catch (error: any) {
    console.error('Excel parsing error:', error);
    res.status(500).json({ error: 'Server could not read file. Detail: ' + error.message });
  }
});

app.post('/api/predict-failure', async (req, res) => {
  const { machineData } = req.body;
  if (!machineData) return res.status(400).json({ error: 'Missing machine data' });

  try {
    const prompt = `Analyze the following OEE and machine performance data to predict potential failures or maintenance needs. Give a concise risk score from 0-100 and a brief explanation with recommendations.
    
    Data: ${JSON.stringify(machineData)}
    
    Return the response in JSON format:
    {
      "riskScore": number,
      "riskLevel": "Low" | "Medium" | "High" | "Critical",
      "explanation": string,
      "recommendations": string[]
    }`;

    const result = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = result.text || '{}';
    try {
      res.json(JSON.parse(text));
    } catch (e) {
      // Fallback for non-strict JSON output
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        res.json(JSON.parse(jsonMatch[0]));
      } else {
        throw new Error('Invalid JSON from model');
      }
    }
  } catch (error: any) {
    console.error('Gemini failure prediction error:', error);
    res.status(500).json({ 
      error: 'AI analysis failed',
      riskScore: 50,
      riskLevel: "Medium",
      explanation: "Unable to reach diagnostic engine. Manual inspection recommended.",
      recommendations: ["Check machine vibration", "Review last maintenance log"]
    });
  }
});

// OEE Planner prediction endpoint
app.post('/api/planner-predict', async (req, res) => {
  const { machine, shift, targetCount, partWt, goodCount, badCount } = req.body;
  
  // Calculate OEE base values
  const totalCount = goodCount + badCount;
  const qr = totalCount > 0 ? (goodCount / totalCount) * 100 : 0;
  
  // For AR/PR we might need more info but we can heuristically predict based on machine history if we had it.
  // Since we don't have a persistent DB in this simple script, we'll use Gemini to "simulate" a Random Forest prediction
  // based on the provided inputs and "typical" industrial patterns.
  
  try {
    const prompt = `Act as an industrial OEE prediction model. Predict the likely OEE for a machine with these inputs:
    Machine: ${machine}
    Shift: ${shift}
    Target Count: ${targetCount}
    Part Weight: ${partWt}g
    Expected Good Count: ${goodCount}
    Expected Bad Count: ${badCount}
    
    Calculated QR: ${qr.toFixed(2)}%
    
    Estimate realistic AR and PR based on industrial benchmarks and these specific counts.
    Return JSON: { "predictedOEE": number, "predictedAR": number, "predictedPR": number, "insights": string }`;

    const result = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = result.text || '{}';
    try {
      res.json(JSON.parse(text));
    } catch (e) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        res.json(JSON.parse(jsonMatch[0]));
      } else {
        res.json({ insights: "Performance appears standard for this configuration." });
      }
    }
  } catch (error) {
    res.status(500).json({ error: 'Prediction failed', insights: "Simulation engine offline." });
  }
});

// Vite middleware for dev
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

setupServer();
