import * as xlsx from 'xlsx';

export function parseOeeExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = xlsx.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const detailSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('detail')) || workbook.SheetNames[0];
        const sheet = workbook.Sheets[detailSheetName];
        
        // Convert raw rows to array
        const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
        
        // Find header index
        let headerIdx = -1;
        for (let i = 0; i < Math.min(100, rows.length); i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row)) continue;
          const rowStr = row.map(c => String(c || '')).join(' ').toLowerCase();
          if (
            (rowStr.includes('machine') || rowStr.includes('m/c')) && 
            (rowStr.includes('shift') || rowStr.includes('oee') || rowStr.includes('ome') || rowStr.includes('good count'))
          ) {
            headerIdx = i;
            break;
          }
        }
        
        if (headerIdx === -1) {
          throw new Error('Could not detect the header row. Please ensure columns like "Machine", "Shift", and "Good Count" exist.');
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
          
          let badCount = cleanNum(getVal(['Bad Count', 'Reject Count', 'NG Count', 'Bad', 'Rej Qty']));
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
        
        resolve(cleanedData);
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => {
      reject(new Error('FileReader failed to read file.'));
    };
    reader.readAsArrayBuffer(file);
  });
}
