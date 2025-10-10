export interface ParsedCSVData {
  headers: string[];
  rows: Record<string, any>[];
  identifierColumn: string; // 'phone' or 'email'
  errors: string[];
}

export function parseCSV(
  csvText: string,
  requireIdentifier: 'phone' | 'email'
): ParsedCSVData {
  const errors: string[] = [];
  const lines = csvText.trim().split('\n');
  
  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      identifierColumn: '',
      errors: ['CSV file is empty']
    };
  }

  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Find identifier column
  const identifierColumn = headers.find(h => 
    h.toLowerCase() === requireIdentifier ||
    h.toLowerCase() === requireIdentifier + 's' ||
    (requireIdentifier === 'phone' && (h.toLowerCase() === 'phone_number' || h.toLowerCase() === 'mobile'))
  );

  if (!identifierColumn) {
    errors.push(`Required identifier column '${requireIdentifier}' not found in CSV headers`);
    return { headers, rows: [], identifierColumn: '', errors };
  }

  // Parse rows
  const rows: Record<string, any>[] = [];
  const seenIdentifiers = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length !== headers.length) {
      errors.push(`Row ${i}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
      continue;
    }

    const row: Record<string, any> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });

    // Validate identifier
    const identifier = row[identifierColumn];
    if (!identifier || identifier.trim() === '') {
      errors.push(`Row ${i}: Missing ${requireIdentifier}`);
      continue;
    }

    if (!validateCSVRow(row, requireIdentifier, identifierColumn)) {
      errors.push(`Row ${i}: Invalid ${requireIdentifier} format: ${identifier}`);
      continue;
    }

    // Check for duplicates
    if (seenIdentifiers.has(identifier)) {
      errors.push(`Row ${i}: Duplicate ${requireIdentifier}: ${identifier}`);
    }
    seenIdentifiers.add(identifier);

    rows.push(row);
  }

  return {
    headers,
    rows,
    identifierColumn,
    errors
  };
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values.map(v => v.replace(/^"|"$/g, ''));
}

export function validateCSVRow(
  row: Record<string, any>,
  identifierType: 'phone' | 'email',
  identifierColumn: string
): boolean {
  const value = row[identifierColumn];
  
  if (identifierType === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  } else {
    // Phone validation - accept various formats
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    return phoneRegex.test(value.replace(/\s/g, ''));
  }
}

export function generateCSVTemplate(
  identifierType: 'phone' | 'email',
  variableColumns: string[]
): string {
  const headers = [identifierType, ...variableColumns];
  const sampleRows = [
    identifierType === 'phone' 
      ? ['+11234567890', ...variableColumns.map(() => 'sample_value')]
      : ['user@example.com', ...variableColumns.map(() => 'sample_value')],
    identifierType === 'phone'
      ? ['+19876543210', ...variableColumns.map(() => 'sample_value')]
      : ['contact@example.com', ...variableColumns.map(() => 'sample_value')]
  ];

  const csvLines = [
    headers.join(','),
    ...sampleRows.map(row => row.join(','))
  ];

  return csvLines.join('\n');
}
